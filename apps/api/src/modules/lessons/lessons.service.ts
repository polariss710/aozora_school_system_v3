import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActualLessonStatus,
  AuditRiskLevel,
  PlannedLessonStatus,
  Prisma,
  RecordStatus,
  StudentSettlementStatus,
  TeacherWageSnapshotStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  ActualLessonWriteBody,
  BatchPlannedLessonsBody,
  DeleteFreshPlannedLessonBody,
  ListLessonsQuery,
  NormalizedBatchPlannedLessonRule,
  NormalizedBatchPlannedLessonsInput,
  NormalizedActualLessonInput,
  NormalizedPlannedLessonInput,
  PlannedLessonWriteBody,
} from "./lessons.types";

const defaultLimit = 100;
const maxLimit = 500;
const maxBatchPlannedLessonCount = 500;
const batchPlannedLessonSourceType = "batch_planned_lesson_generation";

const relationSelect = {
  id: true,
  code: true,
  name: true,
} as const;

const plannedLessonSelect = {
  id: true,
  studentId: true,
  teacherId: true,
  subjectId: true,
  businessEntityId: true,
  yearMonth: true,
  weekAnchorDate: true,
  lessonNo: true,
  plannedStartTime: true,
  plannedEndTime: true,
  durationHours: true,
  plannedFeeJpy: true,
  content: true,
  memo: true,
  status: true,
  sourceType: true,
  sourceId: true,
  createdAt: true,
  updatedAt: true,
  student: { select: relationSelect },
  teacher: { select: relationSelect },
  subject: { select: relationSelect },
  businessEntity: { select: relationSelect },
  actualLesson: {
    select: {
      id: true,
      actualDate: true,
      status: true,
    },
  },
} satisfies Prisma.StudentPlannedLessonSelect;

const actualLessonSelect = {
  id: true,
  plannedLessonId: true,
  studentId: true,
  teacherId: true,
  subjectId: true,
  businessEntityId: true,
  yearMonth: true,
  actualDate: true,
  startTime: true,
  endTime: true,
  durationHours: true,
  content: true,
  memo: true,
  status: true,
  teacherWageEligible: true,
  sourceType: true,
  sourceId: true,
  plannedLesson: {
    select: {
      id: true,
      yearMonth: true,
      weekAnchorDate: true,
      lessonNo: true,
      status: true,
    },
  },
  student: { select: relationSelect },
  teacher: { select: relationSelect },
  subject: { select: relationSelect },
  businessEntity: { select: relationSelect },
} satisfies Prisma.StudentActualLessonSelect;

type PlannedLessonSnapshot = Prisma.StudentPlannedLessonGetPayload<{
  select: typeof plannedLessonSelect;
}>;

type ActualLessonSnapshot = Prisma.StudentActualLessonGetPayload<{
  select: typeof actualLessonSelect;
}>;

type GeneratedBatchPlannedLessonInput = NormalizedPlannedLessonInput & {
  ruleIndex: number;
};

@Injectable()
export class LessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listPlannedLessons(query: ListLessonsQuery) {
    const where = this.buildPlannedWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.studentPlannedLesson.findMany({
        where,
        orderBy: [
          { weekAnchorDate: "asc" },
          { lessonNo: "asc" },
          { student: { name: "asc" } },
        ],
        take: limit,
        select: plannedLessonSelect,
      }),
      this.prisma.studentPlannedLesson.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getPlannedLesson(id: string) {
    const plannedLesson = await this.findPlannedLesson(id);

    return { plannedLesson };
  }

  async createPlannedLesson(
    body: PlannedLessonWriteBody,
    actorUserId: string,
  ) {
    const input = this.normalizeCreatePlannedInput(body);
    await this.assertActiveReferences(input);
    await this.assertStudentSettlementOpen(input.studentId, input.yearMonth);

    const plannedLesson = await this.prisma.$transaction(async (tx) => {
      const created = await tx.studentPlannedLesson.create({
        data: {
          ...input,
          durationHours: new Prisma.Decimal(input.durationHours),
          status: PlannedLessonStatus.scheduled,
        },
        select: plannedLessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_planned_lesson.create",
          targetType: "student_planned_lesson",
          targetId: created.id,
          riskLevel: AuditRiskLevel.medium,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { plannedLesson };
  }

  async previewBatchPlannedLessons(body: BatchPlannedLessonsBody) {
    const input = this.normalizeBatchPlannedLessonsInput(body);
    await this.assertActiveBatchReferences(input);
    const generatedInputs = this.buildBatchPlannedLessonInputs(input);
    await this.assertBatchStudentSettlementsOpen(generatedInputs);
    const conflicts = await this.findBatchPlannedLessonConflicts(generatedInputs);

    return this.buildBatchPreview(input, generatedInputs, conflicts);
  }

  async createBatchPlannedLessons(
    body: BatchPlannedLessonsBody,
    actorUserId: string,
  ) {
    const input = this.normalizeBatchPlannedLessonsInput(body);
    await this.assertActiveBatchReferences(input);

    if (input.sourceId) {
      const existing = await this.prisma.studentPlannedLesson.findMany({
        where: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
        orderBy: [
          { weekAnchorDate: "asc" },
          { lessonNo: "asc" },
          { subject: { sortOrder: "asc" } },
        ],
        select: plannedLessonSelect,
      });

      if (existing.length > 0) {
        return {
          plannedLessons: existing,
          createdCount: 0,
          idempotent: true,
        };
      }
    }

    const generatedInputs = this.buildBatchPlannedLessonInputs(input);
    await this.assertBatchStudentSettlementsOpen(generatedInputs);
    const conflicts = await this.findBatchPlannedLessonConflicts(generatedInputs);

    if (conflicts.length > 0) {
      throw new BadRequestException(
        "Batch planned lessons conflict with existing planned lessons.",
      );
    }

    const plannedLessons = await this.prisma.$transaction(async (tx) => {
      const created: PlannedLessonSnapshot[] = [];

      for (const generatedInput of generatedInputs) {
        const { ruleIndex: _ruleIndex, ...lessonInput } = generatedInput;
        const plannedLesson = await tx.studentPlannedLesson.create({
          data: {
            ...lessonInput,
            durationHours: new Prisma.Decimal(lessonInput.durationHours),
            status: PlannedLessonStatus.scheduled,
          },
          select: plannedLessonSelect,
        });
        created.push(plannedLesson);
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_planned_lesson.batch_create",
          targetType: "student_planned_lesson_batch",
          targetId: input.sourceId ?? `batch:${created[0]?.id ?? "empty"}`,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: {
            input,
            createdCount: created.length,
            plannedLessonIds: created.map((lesson) => lesson.id),
          },
        },
        tx,
      );

      return created;
    });

    return {
      plannedLessons,
      createdCount: plannedLessons.length,
      idempotent: false,
    };
  }

  async updatePlannedLesson(
    id: string,
    body: PlannedLessonWriteBody,
    actorUserId: string,
  ) {
    const before = await this.findPlannedLesson(id);
    this.assertPlannedLessonEditable(before);
    const input = this.normalizeUpdatePlannedInput(body, before);
    await this.assertActiveReferences(input);
    await this.assertStudentSettlementOpen(before.studentId, before.yearMonth);
    await this.assertStudentSettlementOpen(input.studentId, input.yearMonth);

    const plannedLesson = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentPlannedLesson.update({
        where: { id },
        data: {
          ...input,
          durationHours: new Prisma.Decimal(input.durationHours),
        },
        select: plannedLessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_planned_lesson.update",
          targetType: "student_planned_lesson",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { plannedLesson };
  }

  async deleteFreshPlannedLesson(
    id: string,
    body: DeleteFreshPlannedLessonBody,
    actorUserId: string,
  ) {
    const expectedUpdatedAt = this.normalizeExpectedUpdatedAt(
      body.expectedUpdatedAt,
    );

    if (!this.normalizeBoolean(body.confirmDelete, "confirmDelete")) {
      throw new BadRequestException("confirmDelete must be true.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const before = await tx.studentPlannedLesson.findUnique({
        where: { id },
        select: plannedLessonSelect,
      });

      if (!before) {
        throw new NotFoundException("Planned lesson not found.");
      }

      this.assertFreshPlannedLessonDeleteCandidate(before);
      this.assertExpectedUpdatedAtMatches(before, expectedUpdatedAt);
      await this.assertNoDownstreamPlannedLessonReferences(before, tx);

      await tx.studentPlannedLesson.delete({
        where: { id },
        select: { id: true },
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_planned_lesson.delete_fresh",
          targetType: "student_planned_lesson",
          targetId: before.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: {
            deleted: true,
            deletedPlannedLesson: this.buildDeletedPlannedLessonSummary(before),
          },
        },
        tx,
      );

      return {
        deletedPlannedLesson: this.buildDeletedPlannedLessonSummary(before),
      };
    });

    return result;
  }

  async cancelPlannedLesson(id: string, actorUserId: string) {
    const before = await this.findPlannedLesson(id);
    this.assertPlannedLessonEditable(before);
    await this.assertStudentSettlementOpen(before.studentId, before.yearMonth);

    return this.changePlannedStatus(
      before,
      PlannedLessonStatus.cancelled,
      "student_planned_lesson.cancel",
      actorUserId,
      AuditRiskLevel.high,
    );
  }

  async restorePlannedLesson(id: string, actorUserId: string) {
    const before = await this.findPlannedLesson(id);
    await this.assertStudentSettlementOpen(before.studentId, before.yearMonth);

    if (before.actualLesson) {
      throw new BadRequestException(
        "Planned lesson already has an actual lesson.",
      );
    }

    return this.changePlannedStatus(
      before,
      PlannedLessonStatus.scheduled,
      "student_planned_lesson.restore",
      actorUserId,
      AuditRiskLevel.medium,
    );
  }

  async markMakeupPending(id: string, actorUserId: string) {
    const before = await this.findPlannedLesson(id);
    this.assertPlannedLessonEditable(before);
    await this.assertStudentSettlementOpen(before.studentId, before.yearMonth);

    return this.changePlannedStatus(
      before,
      PlannedLessonStatus.makeup_pending,
      "student_planned_lesson.mark_makeup_pending",
      actorUserId,
      AuditRiskLevel.medium,
    );
  }

  async generateActualLesson(
    id: string,
    body: ActualLessonWriteBody,
    actorUserId: string,
  ) {
    const plannedBefore = await this.findPlannedLesson(id);

    if (plannedBefore.actualLesson) {
      throw new BadRequestException("Actual lesson already exists.");
    }

    if (plannedBefore.status === PlannedLessonStatus.cancelled) {
      throw new BadRequestException("Cancelled planned lesson cannot generate actual lesson.");
    }

    if (plannedBefore.status !== PlannedLessonStatus.makeup_pending) {
      await this.assertStudentSettlementOpen(
        plannedBefore.studentId,
        plannedBefore.yearMonth,
      );
    }

    const input = this.normalizeActualInputFromPlanned(body, plannedBefore);
    await this.assertActiveTeacher(input.teacherId);
    await this.assertTeacherWageSnapshotOpen(
      input.teacherId,
      input.yearMonth,
      plannedBefore.businessEntityId,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const actualLesson = await tx.studentActualLesson.create({
        data: {
          plannedLessonId: plannedBefore.id,
          studentId: plannedBefore.studentId,
          teacherId: input.teacherId,
          subjectId: plannedBefore.subjectId,
          businessEntityId: plannedBefore.businessEntityId,
          yearMonth: input.yearMonth,
          actualDate: input.actualDate,
          startTime: input.startTime,
          endTime: input.endTime,
          durationHours: new Prisma.Decimal(input.durationHours),
          content: input.content,
          memo: input.memo,
          teacherWageEligible: input.teacherWageEligible,
          status: ActualLessonStatus.completed,
          sourceType: "planned_lesson",
          sourceId: plannedBefore.id,
        },
        select: actualLessonSelect,
      });

      const nextStatus =
        plannedBefore.status === PlannedLessonStatus.makeup_pending
          ? PlannedLessonStatus.makeup_completed
          : PlannedLessonStatus.actual_created;

      const plannedLesson = await tx.studentPlannedLesson.update({
        where: { id: plannedBefore.id },
        data: { status: nextStatus },
        select: plannedLessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_actual_lesson.generate",
          targetType: "student_actual_lesson",
          targetId: actualLesson.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: plannedBefore,
          afterSnapshot: { plannedLesson, actualLesson },
        },
        tx,
      );

      return { plannedLesson, actualLesson };
    });

    return result;
  }

  async listActualLessons(query: ListLessonsQuery) {
    const where = this.buildActualWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.studentActualLesson.findMany({
        where,
        orderBy: [
          { actualDate: "asc" },
          { startTime: "asc" },
          { student: { name: "asc" } },
        ],
        take: limit,
        select: actualLessonSelect,
      }),
      this.prisma.studentActualLesson.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getActualLesson(id: string) {
    const actualLesson = await this.findActualLesson(id);

    return { actualLesson };
  }

  async updateActualLesson(
    id: string,
    body: ActualLessonWriteBody,
    actorUserId: string,
  ) {
    const before = await this.findActualLesson(id);
    this.assertActualLessonEditable(before);
    await this.assertActualLessonStudentSettlementOpen(before);
    const input = this.normalizeUpdateActualInput(body, before);
    await this.assertActiveTeacher(input.teacherId);
    await this.assertTeacherWageSnapshotOpen(
      before.teacherId,
      before.yearMonth,
      before.businessEntityId,
    );
    await this.assertTeacherWageSnapshotOpen(
      input.teacherId,
      input.yearMonth,
      before.businessEntityId,
    );

    const actualLesson = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentActualLesson.update({
        where: { id },
        data: {
          teacherId: input.teacherId,
          yearMonth: input.yearMonth,
          actualDate: input.actualDate,
          startTime: input.startTime,
          endTime: input.endTime,
          durationHours: new Prisma.Decimal(input.durationHours),
          content: input.content,
          memo: input.memo,
          teacherWageEligible: input.teacherWageEligible,
        },
        select: actualLessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_actual_lesson.update",
          targetType: "student_actual_lesson",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { actualLesson };
  }

  async cancelActualLesson(id: string, actorUserId: string) {
    const before = await this.findActualLesson(id);
    this.assertActualLessonEditable(before);

    if (!before.plannedLessonId || !before.plannedLesson) {
      throw new BadRequestException("Actual lesson has no planned lesson binding.");
    }

    await this.assertActualLessonStudentSettlementOpen(before);
    await this.assertTeacherWageSnapshotOpen(
      before.teacherId,
      before.yearMonth,
      before.businessEntityId,
    );

    const restoredPlannedStatus =
      before.plannedLesson.status === PlannedLessonStatus.makeup_completed
        ? PlannedLessonStatus.makeup_pending
        : PlannedLessonStatus.scheduled;

    const result = await this.prisma.$transaction(async (tx) => {
      const actualLesson = await tx.studentActualLesson.update({
        where: { id },
        data: {
          status: ActualLessonStatus.cancelled,
          plannedLessonId: null,
          memo: before.memo,
        },
        select: actualLessonSelect,
      });

      const plannedLesson = await tx.studentPlannedLesson.update({
        where: { id: before.plannedLessonId! },
        data: { status: restoredPlannedStatus },
        select: plannedLessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_actual_lesson.cancel",
          targetType: "student_actual_lesson",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: { plannedLesson, actualLesson },
        },
        tx,
      );

      return { plannedLesson, actualLesson };
    });

    return result;
  }

  private async changePlannedStatus(
    before: PlannedLessonSnapshot,
    status: PlannedLessonStatus,
    action: string,
    actorUserId: string,
    riskLevel: AuditRiskLevel,
  ) {
    if (before.status === status) {
      return { plannedLesson: before };
    }

    const plannedLesson = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentPlannedLesson.update({
        where: { id: before.id },
        data: { status },
        select: plannedLessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action,
          targetType: "student_planned_lesson",
          targetId: before.id,
          riskLevel,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { plannedLesson };
  }

  private async findPlannedLesson(id: string): Promise<PlannedLessonSnapshot> {
    const plannedLesson = await this.prisma.studentPlannedLesson.findUnique({
      where: { id },
      select: plannedLessonSelect,
    });

    if (!plannedLesson) {
      throw new NotFoundException("Planned lesson not found.");
    }

    return plannedLesson;
  }

  private async findActualLesson(id: string): Promise<ActualLessonSnapshot> {
    const actualLesson = await this.prisma.studentActualLesson.findUnique({
      where: { id },
      select: actualLessonSelect,
    });

    if (!actualLesson) {
      throw new NotFoundException("Actual lesson not found.");
    }

    return actualLesson;
  }

  private assertPlannedLessonEditable(plannedLesson: PlannedLessonSnapshot) {
    if (plannedLesson.actualLesson) {
      throw new BadRequestException(
        "Planned lesson with actual lesson cannot be edited.",
      );
    }

    if (
      plannedLesson.status === PlannedLessonStatus.actual_created ||
      plannedLesson.status === PlannedLessonStatus.makeup_completed
    ) {
      throw new BadRequestException("Planned lesson is already completed.");
    }
  }

  private assertFreshPlannedLessonDeleteCandidate(
    plannedLesson: PlannedLessonSnapshot,
  ) {
    if (plannedLesson.status !== PlannedLessonStatus.scheduled) {
      throw new BadRequestException(
        "Only fresh scheduled planned lesson can be deleted.",
      );
    }

    if (plannedLesson.actualLesson) {
      throw new BadRequestException(
        "Planned lesson with actual lesson cannot be deleted.",
      );
    }
  }

  private assertExpectedUpdatedAtMatches(
    plannedLesson: PlannedLessonSnapshot,
    expectedUpdatedAt: Date,
  ) {
    if (plannedLesson.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new ConflictException(
        "Planned lesson was updated by another operation. Please reload before deleting.",
      );
    }
  }

  private async assertNoDownstreamPlannedLessonReferences(
    plannedLesson: PlannedLessonSnapshot,
    client: Prisma.TransactionClient,
  ) {
    const [actualLessonCount, settlements, tuitionBills, wageDetailCount] =
      await Promise.all([
        client.studentActualLesson.count({
          where: {
            OR: [
              { plannedLessonId: plannedLesson.id },
              { sourceType: "planned_lesson", sourceId: plannedLesson.id },
            ],
          },
        }),
        client.studentMonthlySettlement.findMany({
          where: {
            studentId: plannedLesson.studentId,
            yearMonth: plannedLesson.yearMonth,
          },
          select: {
            id: true,
            status: true,
            calculationSnapshot: true,
          },
        }),
        client.studentTuitionBill.findMany({
          where: {
            studentId: plannedLesson.studentId,
            yearMonth: plannedLesson.yearMonth,
          },
          select: {
            id: true,
            status: true,
            incomeRecordId: true,
            calculationSnapshot: true,
          },
        }),
        client.teacherWageSnapshotDetail.count({
          where: {
            actualLesson: {
              OR: [
                { plannedLessonId: plannedLesson.id },
                { sourceType: "planned_lesson", sourceId: plannedLesson.id },
              ],
            },
          },
        }),
      ]);

    if (actualLessonCount > 0) {
      throw new BadRequestException(
        "Planned lesson has downstream actual lesson reference.",
      );
    }

    const referencingSettlement = settlements.find((settlement) =>
      this.snapshotReferencesPlannedLesson(
        settlement.calculationSnapshot,
        [
          "sourceLessonIds",
          "billableLessonIds",
          "cancelledLessonIds",
          "plannedLessonIds",
        ],
        plannedLesson.id,
      ),
    );

    if (referencingSettlement) {
      throw new BadRequestException(
        "Planned lesson is referenced by student monthly settlement.",
      );
    }

    const referencingTuitionBill = tuitionBills.find((tuitionBill) =>
      this.snapshotReferencesPlannedLesson(
        tuitionBill.calculationSnapshot,
        ["plannedLessonIds"],
        plannedLesson.id,
      ),
    );

    if (referencingTuitionBill) {
      throw new BadRequestException(
        "Planned lesson is referenced by tuition bill snapshot.",
      );
    }

    if (wageDetailCount > 0) {
      throw new BadRequestException(
        "Planned lesson is referenced by teacher wage snapshot.",
      );
    }
  }

  private snapshotReferencesPlannedLesson(
    snapshot: Prisma.JsonValue,
    keys: string[],
    plannedLessonId: string,
  ) {
    return keys.some((key) =>
      this.getSnapshotStringArray(snapshot, key).includes(plannedLessonId),
    );
  }

  private getSnapshotStringArray(snapshot: Prisma.JsonValue, key: string) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return [];
    }

    const value = (snapshot as Record<string, unknown>)[key];

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string");
  }

  private buildDeletedPlannedLessonSummary(
    plannedLesson: PlannedLessonSnapshot,
  ) {
    return {
      id: plannedLesson.id,
      studentId: plannedLesson.studentId,
      teacherId: plannedLesson.teacherId,
      subjectId: plannedLesson.subjectId,
      businessEntityId: plannedLesson.businessEntityId,
      yearMonth: plannedLesson.yearMonth,
      weekAnchorDate: this.formatDate(plannedLesson.weekAnchorDate),
      lessonNo: plannedLesson.lessonNo,
      plannedFeeJpy: plannedLesson.plannedFeeJpy,
      status: plannedLesson.status,
      sourceType: plannedLesson.sourceType,
      sourceId: plannedLesson.sourceId,
    };
  }

  private assertActualLessonEditable(actualLesson: ActualLessonSnapshot) {
    if (actualLesson.status !== ActualLessonStatus.completed) {
      throw new BadRequestException("Only completed actual lesson can be edited.");
    }
  }

  private async assertActualLessonStudentSettlementOpen(
    actualLesson: ActualLessonSnapshot,
  ) {
    const plannedLesson = actualLesson.plannedLesson;

    if (!plannedLesson) {
      await this.assertStudentSettlementOpen(
        actualLesson.studentId,
        actualLesson.yearMonth,
      );
      return;
    }

    if (plannedLesson.status === PlannedLessonStatus.makeup_completed) {
      return;
    }

    await this.assertStudentSettlementOpen(
      actualLesson.studentId,
      plannedLesson.yearMonth,
    );
  }

  private async assertActiveReferences(input: NormalizedPlannedLessonInput) {
    const [student, teacher, subject, businessEntity] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: input.studentId, status: RecordStatus.active },
        select: { id: true },
      }),
      this.prisma.teacher.findFirst({
        where: { id: input.teacherId, status: RecordStatus.active },
        select: { id: true },
      }),
      this.prisma.subject.findFirst({
        where: { id: input.subjectId, status: RecordStatus.active },
        select: { id: true },
      }),
      this.prisma.businessEntity.findFirst({
        where: { id: input.businessEntityId, status: RecordStatus.active },
        select: { id: true },
      }),
    ]);

    if (!student) {
      throw new BadRequestException("Active student is required.");
    }
    if (!teacher) {
      throw new BadRequestException("Active teacher is required.");
    }
    if (!subject) {
      throw new BadRequestException("Active subject is required.");
    }
    if (!businessEntity) {
      throw new BadRequestException("Active business entity is required.");
    }
  }

  private async assertActiveTeacher(teacherId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, status: RecordStatus.active },
      select: { id: true },
    });

    if (!teacher) {
      throw new BadRequestException("Active teacher is required.");
    }
  }

  private async assertStudentSettlementOpen(studentId: string, yearMonth: string) {
    const settlement = await this.prisma.studentMonthlySettlement.findUnique({
      where: {
        studentId_yearMonth: {
          studentId,
          yearMonth,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (settlement?.status === StudentSettlementStatus.locked) {
      throw new BadRequestException(
        "Student monthly settlement is locked for this student/month.",
      );
    }
  }

  private async assertBatchStudentSettlementsOpen(
    inputs: GeneratedBatchPlannedLessonInput[],
  ) {
    const monthKeys = [
      ...new Set(
        inputs.map((input) => `${input.studentId}:${input.yearMonth}`),
      ),
    ];

    await Promise.all(
      monthKeys.map((key) => {
        const [studentId, yearMonth] = key.split(":");

        return this.assertStudentSettlementOpen(studentId, yearMonth);
      }),
    );
  }

  private async assertActiveBatchReferences(input: NormalizedBatchPlannedLessonsInput) {
    const [student, businessEntity] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: input.studentId, status: RecordStatus.active },
        select: { id: true },
      }),
      this.prisma.businessEntity.findFirst({
        where: { id: input.businessEntityId, status: RecordStatus.active },
        select: { id: true },
      }),
    ]);

    if (!student) {
      throw new BadRequestException("Active student is required.");
    }
    if (!businessEntity) {
      throw new BadRequestException("Active business entity is required.");
    }

    const teacherIds = [...new Set(input.rules.map((rule) => rule.teacherId))];
    const subjectIds = [...new Set(input.rules.map((rule) => rule.subjectId))];

    const [teacherCount, subjectCount] = await Promise.all([
      this.prisma.teacher.count({
        where: { id: { in: teacherIds }, status: RecordStatus.active },
      }),
      this.prisma.subject.count({
        where: { id: { in: subjectIds }, status: RecordStatus.active },
      }),
    ]);

    if (teacherCount !== teacherIds.length) {
      throw new BadRequestException("All teachers must be active.");
    }
    if (subjectCount !== subjectIds.length) {
      throw new BadRequestException("All subjects must be active.");
    }
  }

  private async assertTeacherWageSnapshotOpen(
    teacherId: string,
    yearMonth: string,
    businessEntityId: string,
  ) {
    const lockedSnapshot = await this.prisma.teacherWageSnapshot.findFirst({
      where: {
        teacherId,
        yearMonth,
        businessEntityId,
        status: {
          in: [
            TeacherWageSnapshotStatus.locked,
            TeacherWageSnapshotStatus.adjustment_confirmed,
            TeacherWageSnapshotStatus.expense_created,
          ],
        },
      },
      select: { id: true },
    });

    if (lockedSnapshot) {
      throw new BadRequestException(
        "Actual lesson belongs to locked teacher wage snapshot.",
      );
    }
  }

  private normalizeBatchPlannedLessonsInput(
    body: BatchPlannedLessonsBody,
  ): NormalizedBatchPlannedLessonsInput {
    const startWeekAnchorDate = this.normalizeDate(
      body.startWeekAnchorDate,
      "startWeekAnchorDate",
    );
    const endWeekAnchorDate = this.normalizeDate(
      body.endWeekAnchorDate,
      "endWeekAnchorDate",
    );
    this.assertMonday(startWeekAnchorDate);
    this.assertMonday(endWeekAnchorDate);

    if (endWeekAnchorDate < startWeekAnchorDate) {
      throw new BadRequestException(
        "endWeekAnchorDate must be on or after startWeekAnchorDate.",
      );
    }

    const rules = this.normalizeBatchRules(body.rules);
    const weekCount = this.getMondayAnchors(startWeekAnchorDate, endWeekAnchorDate).length;
    const totalCount = rules.reduce(
      (sum, rule) => sum + rule.weeklyCount * weekCount,
      0,
    );

    if (totalCount < 1) {
      throw new BadRequestException("Batch must generate at least one planned lesson.");
    }

    if (totalCount > maxBatchPlannedLessonCount) {
      throw new BadRequestException(
        `Batch planned lesson count must be ${maxBatchPlannedLessonCount} or fewer.`,
      );
    }

    return {
      studentId: this.normalizeRequiredString(body.studentId, "studentId"),
      businessEntityId: this.normalizeRequiredString(
        body.businessEntityId,
        "businessEntityId",
      ),
      startWeekAnchorDate,
      endWeekAnchorDate,
      rules,
      sourceType:
        this.normalizeOptionalString(body.sourceType)?.toLowerCase() ??
        batchPlannedLessonSourceType,
      sourceId: this.normalizeOptionalString(body.sourceId),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeBatchRules(value: unknown): NormalizedBatchPlannedLessonRule[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException("rules must be a non-empty array.");
    }

    if (value.length > 20) {
      throw new BadRequestException("rules must contain 20 items or fewer.");
    }

    return value.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new BadRequestException("Each rule must be an object.");
      }

      const rule = item as Record<string, unknown>;

      return {
        teacherId: this.normalizeRequiredString(rule.teacherId, `rules[${index}].teacherId`),
        subjectId: this.normalizeRequiredString(rule.subjectId, `rules[${index}].subjectId`),
        weeklyCount: this.normalizeWeeklyCount(rule.weeklyCount, `rules[${index}].weeklyCount`),
        firstLessonNo:
          this.normalizeOptionalPositiveInteger(rule.firstLessonNo, `rules[${index}].firstLessonNo`) ??
          1,
        plannedStartTime: this.normalizeOptionalTime(rule.plannedStartTime),
        plannedEndTime: this.normalizeOptionalTime(rule.plannedEndTime),
        durationHours: this.normalizeHours(rule.durationHours, `rules[${index}].durationHours`),
        plannedFeeJpy: this.normalizeJpyAmount(rule.plannedFeeJpy, `rules[${index}].plannedFeeJpy`),
        content: this.normalizeOptionalString(rule.content),
        memo: this.normalizeOptionalString(rule.memo),
      };
    });
  }

  private buildBatchPlannedLessonInputs(
    input: NormalizedBatchPlannedLessonsInput,
  ): GeneratedBatchPlannedLessonInput[] {
    const weekAnchors = this.getMondayAnchors(
      input.startWeekAnchorDate,
      input.endWeekAnchorDate,
    );
    const generated: GeneratedBatchPlannedLessonInput[] = [];

    input.rules.forEach((rule, ruleIndex) => {
      let lessonNo = rule.firstLessonNo;

      for (const weekAnchorDate of weekAnchors) {
        for (let repetition = 0; repetition < rule.weeklyCount; repetition += 1) {
          generated.push({
            studentId: input.studentId,
            teacherId: rule.teacherId,
            subjectId: rule.subjectId,
            businessEntityId: input.businessEntityId,
            yearMonth: this.toYearMonth(weekAnchorDate),
            weekAnchorDate,
            lessonNo,
            plannedStartTime: rule.plannedStartTime,
            plannedEndTime: rule.plannedEndTime,
            durationHours: rule.durationHours,
            plannedFeeJpy: rule.plannedFeeJpy,
            content: rule.content,
            memo: rule.memo ?? input.memo,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            ruleIndex,
          });
          lessonNo += 1;
        }
      }
    });

    return generated;
  }

  private async findBatchPlannedLessonConflicts(
    generatedInputs: GeneratedBatchPlannedLessonInput[],
  ) {
    const conditions = generatedInputs
      .filter((input) => input.lessonNo !== null)
      .map((input) => ({
        studentId: input.studentId,
        subjectId: input.subjectId,
        weekAnchorDate: input.weekAnchorDate,
        lessonNo: input.lessonNo,
        status: { not: PlannedLessonStatus.cancelled },
      }));

    if (conditions.length === 0) {
      return [];
    }

    return this.prisma.studentPlannedLesson.findMany({
      where: { OR: conditions },
      orderBy: [
        { weekAnchorDate: "asc" },
        { lessonNo: "asc" },
        { subject: { sortOrder: "asc" } },
      ],
      take: maxBatchPlannedLessonCount,
      select: plannedLessonSelect,
    });
  }

  private buildBatchPreview(
    input: NormalizedBatchPlannedLessonsInput,
    generatedInputs: GeneratedBatchPlannedLessonInput[],
    conflicts: PlannedLessonSnapshot[],
  ) {
    return {
      summary: {
        startWeekAnchorDate: this.formatDate(input.startWeekAnchorDate),
        endWeekAnchorDate: this.formatDate(input.endWeekAnchorDate),
        weekCount: this.getMondayAnchors(
          input.startWeekAnchorDate,
          input.endWeekAnchorDate,
        ).length,
        ruleCount: input.rules.length,
        plannedLessonCount: generatedInputs.length,
        conflictCount: conflicts.length,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
      items: generatedInputs.map((item) => ({
        ...item,
        weekAnchorDate: this.formatDate(item.weekAnchorDate),
      })),
      conflicts,
    };
  }

  private normalizeCreatePlannedInput(
    body: PlannedLessonWriteBody,
  ): NormalizedPlannedLessonInput {
    const weekAnchorDate = this.normalizeDate(body.weekAnchorDate, "weekAnchorDate");
    this.assertMonday(weekAnchorDate);

    return {
      studentId: this.normalizeRequiredString(body.studentId, "studentId"),
      teacherId: this.normalizeRequiredString(body.teacherId, "teacherId"),
      subjectId: this.normalizeRequiredString(body.subjectId, "subjectId"),
      businessEntityId: this.normalizeRequiredString(
        body.businessEntityId,
        "businessEntityId",
      ),
      yearMonth: this.toYearMonth(weekAnchorDate),
      weekAnchorDate,
      lessonNo: this.normalizeOptionalPositiveInteger(body.lessonNo, "lessonNo"),
      plannedStartTime: this.normalizeOptionalTime(body.plannedStartTime),
      plannedEndTime: this.normalizeOptionalTime(body.plannedEndTime),
      durationHours: this.normalizeHours(body.durationHours, "durationHours"),
      plannedFeeJpy: this.normalizeJpyAmount(body.plannedFeeJpy, "plannedFeeJpy"),
      content: this.normalizeOptionalString(body.content),
      memo: this.normalizeOptionalString(body.memo),
      sourceType:
        this.normalizeOptionalString(body.sourceType)?.toLowerCase() ?? "manual",
      sourceId: this.normalizeOptionalString(body.sourceId),
    };
  }

  private normalizeUpdatePlannedInput(
    body: PlannedLessonWriteBody,
    current: PlannedLessonSnapshot,
  ): NormalizedPlannedLessonInput {
    const weekAnchorDate =
      body.weekAnchorDate === undefined
        ? current.weekAnchorDate
        : this.normalizeDate(body.weekAnchorDate, "weekAnchorDate");
    this.assertMonday(weekAnchorDate);

    return {
      studentId:
        body.studentId === undefined
          ? current.studentId
          : this.normalizeRequiredString(body.studentId, "studentId"),
      teacherId:
        body.teacherId === undefined
          ? current.teacherId
          : this.normalizeRequiredString(body.teacherId, "teacherId"),
      subjectId:
        body.subjectId === undefined
          ? current.subjectId
          : this.normalizeRequiredString(body.subjectId, "subjectId"),
      businessEntityId:
        body.businessEntityId === undefined
          ? current.businessEntityId
          : this.normalizeRequiredString(
              body.businessEntityId,
              "businessEntityId",
            ),
      yearMonth: this.toYearMonth(weekAnchorDate),
      weekAnchorDate,
      lessonNo:
        body.lessonNo === undefined
          ? current.lessonNo
          : this.normalizeOptionalPositiveInteger(body.lessonNo, "lessonNo"),
      plannedStartTime:
        body.plannedStartTime === undefined
          ? current.plannedStartTime
          : this.normalizeOptionalTime(body.plannedStartTime),
      plannedEndTime:
        body.plannedEndTime === undefined
          ? current.plannedEndTime
          : this.normalizeOptionalTime(body.plannedEndTime),
      durationHours:
        body.durationHours === undefined
          ? current.durationHours.toString()
          : this.normalizeHours(body.durationHours, "durationHours"),
      plannedFeeJpy:
        body.plannedFeeJpy === undefined
          ? current.plannedFeeJpy
          : this.normalizeJpyAmount(body.plannedFeeJpy, "plannedFeeJpy"),
      content:
        body.content === undefined
          ? current.content
          : this.normalizeOptionalString(body.content),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
      sourceType:
        body.sourceType === undefined
          ? current.sourceType
          : (this.normalizeOptionalString(body.sourceType)?.toLowerCase() ??
            "manual"),
      sourceId:
        body.sourceId === undefined
          ? current.sourceId
          : this.normalizeOptionalString(body.sourceId),
    };
  }

  private normalizeActualInputFromPlanned(
    body: ActualLessonWriteBody,
    plannedLesson: PlannedLessonSnapshot,
  ): NormalizedActualLessonInput {
    const actualDate = this.normalizeDate(body.actualDate, "actualDate");

    return {
      teacherId:
        body.teacherId === undefined
          ? plannedLesson.teacherId
          : this.normalizeRequiredString(body.teacherId, "teacherId"),
      yearMonth: this.toYearMonth(actualDate),
      actualDate,
      startTime: this.normalizeOptionalTime(body.startTime),
      endTime: this.normalizeOptionalTime(body.endTime),
      durationHours:
        body.durationHours === undefined
          ? plannedLesson.durationHours.toString()
          : this.normalizeHours(body.durationHours, "durationHours"),
      content:
        body.content === undefined
          ? plannedLesson.content
          : this.normalizeOptionalString(body.content),
      memo:
        body.memo === undefined
          ? plannedLesson.memo
          : this.normalizeOptionalString(body.memo),
      teacherWageEligible:
        body.teacherWageEligible === undefined
          ? true
          : this.normalizeBoolean(body.teacherWageEligible, "teacherWageEligible"),
    };
  }

  private normalizeUpdateActualInput(
    body: ActualLessonWriteBody,
    current: ActualLessonSnapshot,
  ): NormalizedActualLessonInput {
    const actualDate =
      body.actualDate === undefined
        ? current.actualDate
        : this.normalizeDate(body.actualDate, "actualDate");

    return {
      teacherId:
        body.teacherId === undefined
          ? current.teacherId
          : this.normalizeRequiredString(body.teacherId, "teacherId"),
      yearMonth: this.toYearMonth(actualDate),
      actualDate,
      startTime:
        body.startTime === undefined
          ? current.startTime
          : this.normalizeOptionalTime(body.startTime),
      endTime:
        body.endTime === undefined
          ? current.endTime
          : this.normalizeOptionalTime(body.endTime),
      durationHours:
        body.durationHours === undefined
          ? current.durationHours.toString()
          : this.normalizeHours(body.durationHours, "durationHours"),
      content:
        body.content === undefined
          ? current.content
          : this.normalizeOptionalString(body.content),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
      teacherWageEligible:
        body.teacherWageEligible === undefined
          ? current.teacherWageEligible
          : this.normalizeBoolean(body.teacherWageEligible, "teacherWageEligible"),
    };
  }

  private buildPlannedWhere(
    query: ListLessonsQuery,
  ): Prisma.StudentPlannedLessonWhereInput {
    const status = this.normalizePlannedStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...this.buildSharedWhere(query),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { content: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { student: { name: { contains: keyword, mode: "insensitive" } } },
              { teacher: { name: { contains: keyword, mode: "insensitive" } } },
              { subject: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private buildActualWhere(
    query: ListLessonsQuery,
  ): Prisma.StudentActualLessonWhereInput {
    const status = this.normalizeActualStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...this.buildSharedWhere(query),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { content: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { student: { name: { contains: keyword, mode: "insensitive" } } },
              { teacher: { name: { contains: keyword, mode: "insensitive" } } },
              { subject: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private buildSharedWhere(query: ListLessonsQuery) {
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const studentId = this.normalizeOptionalString(query.studentId);
    const teacherId = this.normalizeOptionalString(query.teacherId);
    const subjectId = this.normalizeOptionalString(query.subjectId);
    const businessEntityId = this.normalizeOptionalString(query.businessEntityId);

    return {
      ...(yearMonth ? { yearMonth } : {}),
      ...(studentId ? { studentId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
    };
  }

  private normalizePlannedStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(PlannedLessonStatus).includes(status as PlannedLessonStatus)
    ) {
      return status as PlannedLessonStatus;
    }

    return undefined;
  }

  private normalizeActualStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(ActualLessonStatus).includes(status as ActualLessonStatus)
    ) {
      return status as ActualLessonStatus;
    }

    return undefined;
  }

  private normalizeLimit(value: unknown) {
    if (typeof value !== "string") {
      return defaultLimit;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return defaultLimit;
    }

    return Math.min(parsed, maxLimit);
  }

  private normalizeDate(value: unknown, field: string) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid date.`);
    }

    return date;
  }

  private assertMonday(date: Date) {
    if (date.getUTCDay() !== 1) {
      throw new BadRequestException("weekAnchorDate must be a Monday.");
    }
  }

  private toYearMonth(date: Date) {
    return date.toISOString().slice(0, 7);
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private normalizeExpectedUpdatedAt(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("expectedUpdatedAt is required.");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        "expectedUpdatedAt must be a valid ISO datetime.",
      );
    }

    return date;
  }

  private getMondayAnchors(start: Date, end: Date) {
    const anchors: Date[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      anchors.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    return anchors;
  }

  private normalizeOptionalYearMonth(value: unknown) {
    const yearMonth = this.normalizeOptionalString(value);

    if (!yearMonth) {
      return undefined;
    }

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return undefined;
    }

    return yearMonth;
  }

  private normalizeOptionalTime(value: unknown) {
    const time = this.normalizeOptionalString(value);

    if (!time) {
      return null;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new BadRequestException("Time must be HH:mm.");
    }

    return time;
  }

  private normalizeHours(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
      throw new BadRequestException(`${field} must be greater than 0.`);
    }

    return parsed.toFixed(2);
  }

  private normalizeJpyAmount(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer.`);
    }

    return parsed;
  }

  private normalizeOptionalPositiveInteger(value: unknown, field: string) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${field} must be a positive integer.`);
    }

    return parsed;
  }

  private normalizeWeeklyCount(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 14) {
      throw new BadRequestException(`${field} must be an integer from 1 to 14.`);
    }

    return parsed;
  }

  private normalizeBoolean(value: unknown, field: string) {
    if (typeof value !== "boolean") {
      throw new BadRequestException(`${field} must be boolean.`);
    }

    return value;
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private normalizeOptionalString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("Expected a string value.");
    }

    return value.trim() || null;
  }
}
