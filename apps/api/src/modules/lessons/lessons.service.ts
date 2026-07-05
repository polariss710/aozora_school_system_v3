import {
  BadRequestException,
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
  TeacherWageSnapshotStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  ActualLessonWriteBody,
  ListLessonsQuery,
  NormalizedActualLessonInput,
  NormalizedPlannedLessonInput,
  PlannedLessonWriteBody,
} from "./lessons.types";

const defaultLimit = 100;
const maxLimit = 500;

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

  async updatePlannedLesson(
    id: string,
    body: PlannedLessonWriteBody,
    actorUserId: string,
  ) {
    const before = await this.findPlannedLesson(id);
    this.assertPlannedLessonEditable(before);
    const input = this.normalizeUpdatePlannedInput(body, before);
    await this.assertActiveReferences(input);

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

  async cancelPlannedLesson(id: string, actorUserId: string) {
    const before = await this.findPlannedLesson(id);
    this.assertPlannedLessonEditable(before);

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
