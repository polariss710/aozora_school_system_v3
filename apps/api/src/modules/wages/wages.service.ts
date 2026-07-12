import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActualLessonStatus,
  AuditRiskLevel,
  Prisma,
  RecordStatus,
  StudentSettlementStatus,
  TeacherWageAdjustmentStatus,
  TeacherWageSnapshotStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { resolveOperationalBusinessEntityId } from "../business-entities/business-ownership.policy";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  ConfirmTeacherWageAdjustmentsBody,
  ImportTeacherAttendanceAdjustmentsBody,
  ListTeacherWageRulesQuery,
  ListTeacherWageSnapshotsQuery,
  LockTeacherWageBody,
  PreviewTeacherWageBody,
  RevokeTeacherWageSnapshotBody,
  TeacherWageRuleBody,
  TeacherAttendanceWorkbookBody,
  TeacherAttendanceWorkbookImportBody,
  UpdateTeacherWageAdjustmentsBody,
} from "./wages.types";

const defaultLimit = 100;
const maxLimit = 500;

const wageRuleSelect = {
  id: true,
  teacherId: true,
  businessEntityId: true,
  hourlyRateJpy: true,
  status: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, code: true, name: true } },
  businessEntity: { select: { id: true, code: true, name: true } },
} satisfies Prisma.TeacherWageRuleSelect;

const wageSnapshotSelect = {
  id: true,
  teacherId: true,
  yearMonth: true,
  businessEntityId: true,
  version: true,
  lessonCount: true,
  totalLessonHours: true,
  baseWageJpy: true,
  transportationFeeJpy: true,
  classroomFeeJpy: true,
  manualAdjustmentJpy: true,
  totalWageJpy: true,
  status: true,
  adjustmentStatus: true,
  calculationSnapshot: true,
  expenseRecordId: true,
  replacesId: true,
  lockedAt: true,
  revokedAt: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, code: true, name: true } },
  businessEntity: { select: { id: true, code: true, name: true } },
  details: {
    orderBy: [{ actualDate: "asc" }],
    select: {
      id: true,
      actualLessonId: true,
      actualDate: true,
      durationHours: true,
      hourlyRateJpy: true,
      lessonWageJpy: true,
      teacherWageEligible: true,
      includedInWage: true,
      studentNameSnapshot: true,
      subjectNameSnapshot: true,
      contentSnapshot: true,
    },
  },
} satisfies Prisma.TeacherWageSnapshotSelect;

type WageRuleSnapshot = Prisma.TeacherWageRuleGetPayload<{
  select: typeof wageRuleSelect;
}>;

type WageSnapshot = Prisma.TeacherWageSnapshotGetPayload<{
  select: typeof wageSnapshotSelect;
}>;

type NormalizedWageKey = {
  teacherId: string;
  yearMonth: string;
  businessEntityId: string;
};

type NormalizedAttendanceWorkbookRow = {
  snapshotId: string;
  detailId: string;
  transportationFeeJpy: number;
  classroomFeeJpy: number;
};

@Injectable()
export class WagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listRules(query: ListTeacherWageRulesQuery) {
    const where = this.buildRuleWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.teacherWageRule.findMany({
        where,
        orderBy: [{ teacher: { name: "asc" } }, { businessEntity: { name: "asc" } }],
        take: limit,
        select: wageRuleSelect,
      }),
      this.prisma.teacherWageRule.count({ where }),
    ]);

    return { items, total, limit };
  }

  async upsertRule(body: TeacherWageRuleBody, actorUserId: string) {
    const input = await this.normalizeRuleInput(body);
    const existing = await this.prisma.teacherWageRule.findUnique({
      where: {
        teacherId_businessEntityId: {
          teacherId: input.teacherId,
          businessEntityId: input.businessEntityId,
        },
      },
      select: wageRuleSelect,
    });

    const rule = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.teacherWageRule.update({
            where: { id: existing.id },
            data: {
              hourlyRateJpy: input.hourlyRateJpy,
              memo: input.memo,
              status: RecordStatus.active,
            },
            select: wageRuleSelect,
          })
        : await tx.teacherWageRule.create({
            data: { ...input, status: RecordStatus.active },
            select: wageRuleSelect,
          });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: existing ? "teacher_wage_rule.update" : "teacher_wage_rule.create",
          targetType: "teacher_wage_rule",
          targetId: saved.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: existing,
          afterSnapshot: saved,
        },
        tx,
      );

      return saved;
    });

    return { rule };
  }

  async updateRule(id: string, body: TeacherWageRuleBody, actorUserId: string) {
    const before = await this.findRule(id);
    const hourlyRateJpy =
      body.hourlyRateJpy === undefined
        ? before.hourlyRateJpy
        : this.normalizeJpyAmount(body.hourlyRateJpy, "hourlyRateJpy");
    const memo =
      body.memo === undefined ? before.memo : this.normalizeOptionalString(body.memo);

    const rule = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherWageRule.update({
        where: { id },
        data: { hourlyRateJpy, memo },
        select: wageRuleSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher_wage_rule.update",
          targetType: "teacher_wage_rule",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { rule };
  }

  async listSnapshots(query: ListTeacherWageSnapshotsQuery) {
    const where = this.buildSnapshotWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.teacherWageSnapshot.findMany({
        where,
        orderBy: [{ yearMonth: "desc" }, { teacher: { name: "asc" } }, { version: "desc" }],
        take: limit,
        select: wageSnapshotSelect,
      }),
      this.prisma.teacherWageSnapshot.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getSnapshot(id: string) {
    const snapshot = await this.findSnapshot(id);

    return { snapshot };
  }

  async previewTeacherWage(body: PreviewTeacherWageBody) {
    const key = this.normalizeWageKey(body);
    const preview = await this.buildPreview(key);

    return { preview };
  }

  async lockTeacherWage(body: LockTeacherWageBody, actorUserId: string) {
    const key = this.normalizeWageKey(body);
    const memo = this.normalizeOptionalString(body.memo);
    const preview = await this.buildPreview(key);

    if (preview.blockingIssues.length > 0) {
      throw new BadRequestException(preview.blockingIssues.join(" "));
    }

    const latest = await this.prisma.teacherWageSnapshot.findFirst({
      where: key,
      orderBy: { version: "desc" },
      select: wageSnapshotSelect,
    });

    if (latest && latest.status !== TeacherWageSnapshotStatus.revoked) {
      if (latest.status === TeacherWageSnapshotStatus.expense_created || latest.expenseRecordId) {
        throw new BadRequestException("Wage snapshot already generated expense.");
      }

      throw new BadRequestException(
        "Active wage snapshot already exists. Revoke it before relocking.",
      );
    }

    if (latest?.expenseRecordId) {
      throw new BadRequestException("Wage snapshot already generated expense.");
    }

    const nextVersion = (latest?.version ?? 0) + 1;

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const data = {
        teacherId: key.teacherId,
        yearMonth: key.yearMonth,
        businessEntityId: key.businessEntityId,
        version: nextVersion,
        lessonCount: preview.lessonCount,
        totalLessonHours: new Prisma.Decimal(preview.totalLessonHours),
        baseWageJpy: preview.baseWageJpy,
        transportationFeeJpy: 0,
        classroomFeeJpy: 0,
        manualAdjustmentJpy: 0,
        totalWageJpy: preview.baseWageJpy,
        status: TeacherWageSnapshotStatus.locked,
        adjustmentStatus: TeacherWageAdjustmentStatus.none,
        calculationSnapshot: preview,
        replacesId: latest?.id ?? null,
        lockedAt: new Date(),
        revokedAt: null,
        memo: memo ?? null,
      };

      const saved = await tx.teacherWageSnapshot.create({
        data,
        select: wageSnapshotSelect,
      });

      await tx.teacherWageSnapshotDetail.createMany({
        data: preview.details.map((detail) => ({
          snapshotId: saved.id,
          actualLessonId: detail.actualLessonId,
          actualDate: new Date(detail.actualDate),
          durationHours: new Prisma.Decimal(detail.durationHours),
          hourlyRateJpy: detail.hourlyRateJpy,
          lessonWageJpy: detail.lessonWageJpy,
          teacherWageEligible: detail.teacherWageEligible,
          includedInWage: detail.includedInWage,
          studentNameSnapshot: detail.studentNameSnapshot,
          subjectNameSnapshot: detail.subjectNameSnapshot,
          contentSnapshot: detail.contentSnapshot,
        })),
      });

      const reloaded = await tx.teacherWageSnapshot.findUniqueOrThrow({
        where: { id: saved.id },
        select: wageSnapshotSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: latest ? "teacher_wage_snapshot.relock" : "teacher_wage_snapshot.lock",
          targetType: "teacher_wage_snapshot",
          targetId: saved.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: latest,
          afterSnapshot: reloaded,
        },
        tx,
      );

      return reloaded;
    });

    return { snapshot };
  }

  async updateAdjustments(
    id: string,
    body: UpdateTeacherWageAdjustmentsBody,
    actorUserId: string,
  ) {
    const before = await this.findSnapshot(id);
    this.assertSnapshotAdjustable(before);

    const transportationFeeJpy =
      body.transportationFeeJpy === undefined
        ? before.transportationFeeJpy
        : this.normalizeJpyAmount(body.transportationFeeJpy, "transportationFeeJpy");
    const classroomFeeJpy =
      body.classroomFeeJpy === undefined
        ? before.classroomFeeJpy
        : this.normalizeJpyAmount(body.classroomFeeJpy, "classroomFeeJpy");
    const manualAdjustmentJpy =
      body.manualAdjustmentJpy === undefined
        ? before.manualAdjustmentJpy
        : this.normalizeJpySignedAmount(body.manualAdjustmentJpy, "manualAdjustmentJpy");
    const memo =
      body.memo === undefined ? before.memo : this.normalizeOptionalString(body.memo);
    const totalWageJpy = this.confirmJpy(
      before.baseWageJpy +
        transportationFeeJpy +
        classroomFeeJpy +
        manualAdjustmentJpy,
    );

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherWageSnapshot.update({
        where: { id },
        data: {
          transportationFeeJpy,
          classroomFeeJpy,
          manualAdjustmentJpy,
          totalWageJpy,
          memo,
          adjustmentStatus: TeacherWageAdjustmentStatus.manual_adjusted,
        },
        select: wageSnapshotSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher_wage_snapshot.adjust",
          targetType: "teacher_wage_snapshot",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { snapshot };
  }

  async exportAttendanceWorkbook(
    body: TeacherAttendanceWorkbookBody,
    actorUserId: string,
  ) {
    const key = this.normalizeAttendanceWorkbookKey(body);
    const before = await this.findAttendanceWorkbookSnapshots(key);
    before.forEach((snapshot) => this.assertAttendanceWorkbookExportable(snapshot));

    const snapshots = await this.prisma.$transaction(async (tx) => {
      const saved: WageSnapshot[] = [];

      for (const snapshot of before) {
        const updated =
          snapshot.adjustmentStatus === TeacherWageAdjustmentStatus.none
            ? await tx.teacherWageSnapshot.update({
                where: { id: snapshot.id },
                data: { adjustmentStatus: TeacherWageAdjustmentStatus.exported },
                select: wageSnapshotSelect,
              })
            : snapshot;

        await this.auditService.recordEvent(
          {
            actorUserId,
            action: "teacher_attendance_workbook.export",
            targetType: "teacher_wage_snapshot",
            targetId: snapshot.id,
            riskLevel: AuditRiskLevel.medium,
            beforeSnapshot: snapshot,
            afterSnapshot: updated,
          },
          tx,
        );
        saved.push(updated);
      }

      return saved;
    });

    return { exportPayload: this.buildAttendanceWorkbookExportPayload(snapshots) };
  }

  async previewAttendanceWorkbookImport(body: TeacherAttendanceWorkbookImportBody) {
    const key = this.normalizeAttendanceWorkbookKey(body);
    const snapshots = await this.findAttendanceWorkbookSnapshots(key);
    const rows = this.normalizeAttendanceWorkbookRows(body.rows);
    const importSource = this.normalizeOptionalString(body.importSource) ?? "xlsx_upload";

    return {
      preview: this.buildAttendanceWorkbookImportPreview(snapshots, rows, importSource),
    };
  }

  async confirmAttendanceWorkbookImport(
    body: TeacherAttendanceWorkbookImportBody,
    actorUserId: string,
  ) {
    const key = this.normalizeAttendanceWorkbookKey(body);
    const before = await this.findAttendanceWorkbookSnapshots(key);
    const rows = this.normalizeAttendanceWorkbookRows(body.rows);
    const importSource = this.normalizeOptionalString(body.importSource) ?? "xlsx_upload";
    const preview = this.buildAttendanceWorkbookImportPreview(before, rows, importSource);

    const snapshots = await this.prisma.$transaction(async (tx) => {
      const saved: WageSnapshot[] = [];

      for (const group of preview.groups) {
        const previous = before.find((snapshot) => snapshot.id === group.snapshotId)!;
        const updated = await tx.teacherWageSnapshot.update({
          where: { id: group.snapshotId },
          data: {
            transportationFeeJpy: group.after.transportationFeeJpy,
            classroomFeeJpy: group.after.classroomFeeJpy,
            totalWageJpy: group.after.totalWageJpy,
            adjustmentStatus: TeacherWageAdjustmentStatus.imported,
          },
          select: wageSnapshotSelect,
        });

        await this.auditService.recordEvent(
          {
            actorUserId,
            action: "teacher_attendance_workbook.import",
            targetType: "teacher_wage_snapshot",
            targetId: group.snapshotId,
            riskLevel: AuditRiskLevel.high,
            beforeSnapshot: previous,
            afterSnapshot: { snapshot: updated, importSource, workbookPreview: group },
          },
          tx,
        );
        saved.push(updated);
      }

      return saved;
    });

    return { snapshots, preview };
  }

  async exportAttendanceSheet(id: string, actorUserId: string) {
    const before = await this.findSnapshot(id);
    this.assertSnapshotExportable(before);

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const shouldMarkExported =
        before.status === TeacherWageSnapshotStatus.locked &&
        before.adjustmentStatus === TeacherWageAdjustmentStatus.none;

      const updated = shouldMarkExported
        ? await tx.teacherWageSnapshot.update({
            where: { id },
            data: { adjustmentStatus: TeacherWageAdjustmentStatus.exported },
            select: wageSnapshotSelect,
          })
        : before;

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher_wage_snapshot.attendance_export",
          targetType: "teacher_wage_snapshot",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { exportPayload: this.buildAttendanceExportPayload(snapshot), snapshot };
  }

  async previewAttendanceImport(
    id: string,
    body: ImportTeacherAttendanceAdjustmentsBody,
  ) {
    const snapshot = await this.findSnapshot(id);
    this.assertSnapshotAttendanceImportable(snapshot);
    const input = this.normalizeAttendanceImportInput(body, snapshot);

    return {
      preview: this.buildAttendanceImportPreview(snapshot, input),
    };
  }

  async confirmAttendanceImport(
    id: string,
    body: ImportTeacherAttendanceAdjustmentsBody,
    actorUserId: string,
  ) {
    const before = await this.findSnapshot(id);
    this.assertSnapshotAttendanceImportable(before);
    const input = this.normalizeAttendanceImportInput(body, before);
    const preview = this.buildAttendanceImportPreview(before, input);

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherWageSnapshot.update({
        where: { id },
        data: {
          transportationFeeJpy: input.transportationFeeJpy,
          classroomFeeJpy: input.classroomFeeJpy,
          manualAdjustmentJpy: input.manualAdjustmentJpy,
          totalWageJpy: preview.after.totalWageJpy,
          memo: input.memo,
          adjustmentStatus: TeacherWageAdjustmentStatus.imported,
        },
        select: wageSnapshotSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher_wage_snapshot.attendance_import",
          targetType: "teacher_wage_snapshot",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: { snapshot: updated, importSource: input.importSource, preview },
        },
        tx,
      );

      return updated;
    });

    return { snapshot, preview };
  }

  async confirmAdjustments(
    id: string,
    body: ConfirmTeacherWageAdjustmentsBody,
    actorUserId: string,
  ) {
    const before = await this.findSnapshot(id);
    this.assertSnapshotAdjustable(before);
    const memo =
      body.memo === undefined ? before.memo : this.normalizeOptionalString(body.memo);

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherWageSnapshot.update({
        where: { id },
        data: {
          adjustmentStatus: TeacherWageAdjustmentStatus.confirmed,
          status: TeacherWageSnapshotStatus.adjustment_confirmed,
          memo,
        },
        select: wageSnapshotSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher_wage_snapshot.confirm_adjustments",
          targetType: "teacher_wage_snapshot",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { snapshot };
  }

  async revokeSnapshot(
    id: string,
    body: RevokeTeacherWageSnapshotBody,
    actorUserId: string,
  ) {
    const before = await this.findSnapshot(id);

    if (before.status === TeacherWageSnapshotStatus.expense_created) {
      throw new BadRequestException("Wage snapshot already generated expense.");
    }

    if (before.status === TeacherWageSnapshotStatus.revoked) {
      return { snapshot: before };
    }

    const reason = this.normalizeOptionalString(body.reason);

    const snapshot = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherWageSnapshot.update({
        where: { id },
        data: {
          status: TeacherWageSnapshotStatus.revoked,
          revokedAt: new Date(),
        },
        select: wageSnapshotSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "teacher_wage_snapshot.revoke",
          targetType: "teacher_wage_snapshot",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          reason,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { snapshot };
  }

  private async buildPreview(key: NormalizedWageKey) {
    const [teacher, businessEntity, rule, actualLessons] = await Promise.all([
      this.prisma.teacher.findFirst({
        where: { id: key.teacherId, status: RecordStatus.active },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.businessEntity.findFirst({
        where: { id: key.businessEntityId, status: RecordStatus.active },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.teacherWageRule.findFirst({
        where: {
          teacherId: key.teacherId,
          businessEntityId: key.businessEntityId,
          status: RecordStatus.active,
        },
        select: wageRuleSelect,
      }),
      this.prisma.studentActualLesson.findMany({
        where: {
          teacherId: key.teacherId,
          businessEntityId: key.businessEntityId,
          yearMonth: key.yearMonth,
          status: ActualLessonStatus.completed,
        },
        orderBy: [{ actualDate: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          actualDate: true,
          durationHours: true,
          content: true,
          teacherWageEligible: true,
          studentId: true,
          student: { select: { name: true } },
          subject: { select: { name: true } },
        },
      }),
    ]);

    if (!teacher) {
      throw new BadRequestException("Active teacher is required.");
    }

    if (!businessEntity) {
      throw new BadRequestException("Active business entity is required.");
    }

    const hourlyRateJpy = rule?.hourlyRateJpy ?? 0;
    const details = actualLessons.map((lesson) => {
      const includedInWage = lesson.teacherWageEligible && Boolean(rule);
      const durationHours = lesson.durationHours.toNumber();
      const lessonWageJpy = includedInWage
        ? this.confirmJpy(durationHours * hourlyRateJpy)
        : 0;

      return {
        actualLessonId: lesson.id,
        actualDate: lesson.actualDate.toISOString().slice(0, 10),
        durationHours,
        hourlyRateJpy,
        lessonWageJpy,
        teacherWageEligible: lesson.teacherWageEligible,
        includedInWage,
        studentNameSnapshot: lesson.student.name,
        subjectNameSnapshot: lesson.subject.name,
        contentSnapshot: lesson.content,
      };
    });
    const includedDetails = details.filter((detail) => detail.includedInWage);
    const includedStudentIds = [
      ...new Set(
        actualLessons
          .filter((lesson) => lesson.teacherWageEligible)
          .map((lesson) => lesson.studentId),
      ),
    ];
    const lockedStudentSettlements =
      includedStudentIds.length === 0
        ? []
        : await this.prisma.studentMonthlySettlement.findMany({
            where: {
              studentId: { in: includedStudentIds },
              yearMonth: key.yearMonth,
              status: StudentSettlementStatus.locked,
            },
            select: { studentId: true },
          });
    const lockedStudentIds = new Set(
      lockedStudentSettlements.map((settlement) => settlement.studentId),
    );
    const unlockedStudentCount = includedStudentIds.filter(
      (studentId) => !lockedStudentIds.has(studentId),
    ).length;
    const baseWageJpy = this.confirmJpy(
      includedDetails.reduce((sum, detail) => sum + detail.lessonWageJpy, 0),
    );
    const totalLessonHours = includedDetails.reduce(
      (sum, detail) => sum + detail.durationHours,
      0,
    );
    const blockingIssues = [
      ...(!rule ? ["Active teacher wage rule is required."] : []),
      ...(actualLessons.length === 0
        ? ["No completed actual lessons exist for this teacher/month/business entity."]
        : []),
      ...(unlockedStudentCount > 0
        ? ["Student monthly settlements must be locked before teacher wage settlement."]
        : []),
    ];

    return {
      teacher,
      businessEntity,
      teacherId: key.teacherId,
      yearMonth: key.yearMonth,
      businessEntityId: key.businessEntityId,
      wageRule: rule
        ? {
            id: rule.id,
            hourlyRateJpy: rule.hourlyRateJpy,
          }
        : null,
      lessonCount: includedDetails.length,
      totalLessonHours: this.confirmHours(totalLessonHours),
      baseWageJpy,
      transportationFeeJpy: 0,
      classroomFeeJpy: 0,
      manualAdjustmentJpy: 0,
      totalWageJpy: baseWageJpy,
      details,
      sourceActualLessonIds: actualLessons.map((lesson) => lesson.id),
      includedActualLessonIds: includedDetails.map(
        (detail) => detail.actualLessonId,
      ),
      blockingIssues,
      calculationPolicy: {
        source: "student_actual_lessons",
        wageRule: "teacher_id + business_entity_id active hourly rate",
        teacherWageEligible:
          "false actual lessons are snapshotted but not included in wage",
        jpyPrecision: 0,
      },
    };
  }

  private normalizeAttendanceWorkbookKey(body: TeacherAttendanceWorkbookBody) {
    return {
      teacherId: this.normalizeRequiredString(body.teacherId, "teacherId"),
      yearMonth: this.normalizeYearMonth(body.yearMonth),
    };
  }

  private async findAttendanceWorkbookSnapshots(key: {
    teacherId: string;
    yearMonth: string;
  }) {
    const snapshots = await this.prisma.teacherWageSnapshot.findMany({
      where: {
        teacherId: key.teacherId,
        yearMonth: key.yearMonth,
        status: { not: TeacherWageSnapshotStatus.revoked },
      },
      orderBy: [{ businessEntity: { name: "asc" } }, { version: "desc" }],
      select: wageSnapshotSelect,
    });

    if (snapshots.length === 0) {
      throw new BadRequestException(
        "No active teacher wage snapshots exist for this teacher/month.",
      );
    }

    const entityIds = snapshots.map((snapshot) => snapshot.businessEntityId);
    if (new Set(entityIds).size !== entityIds.length) {
      throw new BadRequestException(
        "Multiple active wage snapshot versions exist for one business entity.",
      );
    }

    return snapshots;
  }

  private assertAttendanceWorkbookExportable(snapshot: WageSnapshot) {
    this.assertSnapshotExportable(snapshot);

    if (snapshot.status !== TeacherWageSnapshotStatus.locked) {
      throw new BadRequestException(
        "Only locked wage snapshots can be exported to attendance workbook.",
      );
    }

    if (
      snapshot.adjustmentStatus !== TeacherWageAdjustmentStatus.none &&
      snapshot.adjustmentStatus !== TeacherWageAdjustmentStatus.exported
    ) {
      throw new BadRequestException(
        "Wage snapshot already has adjustments and cannot start Excel workflow.",
      );
    }
  }

  private assertAttendanceWorkbookImportable(snapshot: WageSnapshot) {
    this.assertSnapshotAttendanceImportable(snapshot);

    if (
      snapshot.adjustmentStatus !== TeacherWageAdjustmentStatus.exported &&
      snapshot.adjustmentStatus !== TeacherWageAdjustmentStatus.imported
    ) {
      throw new BadRequestException(
        "Attendance workbook must be exported before import.",
      );
    }
  }

  private buildAttendanceWorkbookExportPayload(snapshots: WageSnapshot[]) {
    const first = snapshots[0];
    const rows = snapshots
      .flatMap((snapshot) =>
        snapshot.details.map((detail) => ({
          snapshotId: snapshot.id,
          detailId: detail.id,
          businessEntityId: snapshot.businessEntityId,
          businessEntityCode: snapshot.businessEntity.code,
          businessEntityName: snapshot.businessEntity.name,
          actualDate: detail.actualDate.toISOString().slice(0, 10),
          studentName: detail.studentNameSnapshot ?? "",
          subjectName: detail.subjectNameSnapshot ?? "",
          content: detail.contentSnapshot,
          durationHours: detail.durationHours.toNumber(),
          lessonWageJpy: detail.lessonWageJpy,
          includedInWage: detail.includedInWage,
          transportationFeeJpy: 0,
          classroomFeeJpy: 0,
        })),
      )
      .sort((left, right) =>
        left.businessEntityName.localeCompare(right.businessEntityName, "zh-CN") ||
        left.actualDate.localeCompare(right.actualDate) ||
        left.studentName.localeCompare(right.studentName, "zh-CN") ||
        left.detailId.localeCompare(right.detailId),
      )
      .map((row, index) => ({ rowNo: index + 1, ...row }));

    return {
      kind: "teacher_attendance_workbook",
      schemaVersion: 1,
      teacher: first.teacher,
      yearMonth: first.yearMonth,
      sortPolicy: ["businessEntityName", "actualDate", "studentName"],
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        version: snapshot.version,
        businessEntity: snapshot.businessEntity,
        lessonCount: snapshot.lessonCount,
        totalLessonHours: snapshot.totalLessonHours.toNumber(),
        baseWageJpy: snapshot.baseWageJpy,
      })),
      rows,
      policy: {
        editableFields: ["transportationFeeJpy", "classroomFeeJpy"],
        immutableFieldsAreNotImported: true,
        oneWorkbookPerTeacherMonth: true,
      },
    };
  }

  private normalizeAttendanceWorkbookRows(value: unknown) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 1000) {
      throw new BadRequestException("Attendance workbook rows are required.");
    }

    const seenDetailIds = new Set<string>();
    return value.map((row, index): NormalizedAttendanceWorkbookRow => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new BadRequestException(`Attendance workbook row ${index + 1} is invalid.`);
      }

      const input = row as Record<string, unknown>;
      const detailId = this.normalizeRequiredString(input.detailId, `rows[${index}].detailId`);
      if (seenDetailIds.has(detailId)) {
        throw new BadRequestException(`Duplicate attendance detail row: ${detailId}.`);
      }
      seenDetailIds.add(detailId);

      return {
        snapshotId: this.normalizeRequiredString(input.snapshotId, `rows[${index}].snapshotId`),
        detailId,
        transportationFeeJpy: this.normalizeJpyAmount(
          input.transportationFeeJpy ?? 0,
          `rows[${index}].transportationFeeJpy`,
        ),
        classroomFeeJpy: this.normalizeJpyAmount(
          input.classroomFeeJpy ?? 0,
          `rows[${index}].classroomFeeJpy`,
        ),
      };
    });
  }

  private buildAttendanceWorkbookImportPreview(
    snapshots: WageSnapshot[],
    rows: NormalizedAttendanceWorkbookRow[],
    importSource: string,
  ) {
    snapshots.forEach((snapshot) => this.assertAttendanceWorkbookImportable(snapshot));

    const expectedDetails = snapshots.flatMap((snapshot) =>
      snapshot.details.map((detail) => ({ snapshotId: snapshot.id, detailId: detail.id })),
    );
    const expectedByDetailId = new Map(
      expectedDetails.map((detail) => [detail.detailId, detail.snapshotId]),
    );

    if (rows.length !== expectedDetails.length) {
      throw new BadRequestException(
        "Attendance workbook detail rows do not match exported snapshot details.",
      );
    }

    for (const row of rows) {
      if (expectedByDetailId.get(row.detailId) !== row.snapshotId) {
        throw new BadRequestException(
          "Attendance workbook detail mapping does not match exported snapshots.",
        );
      }
    }

    const groups = snapshots.map((snapshot) => {
      const snapshotRows = rows.filter((row) => row.snapshotId === snapshot.id);
      const transportationFeeJpy = snapshotRows.reduce(
        (sum, row) => sum + row.transportationFeeJpy,
        0,
      );
      const classroomFeeJpy = snapshotRows.reduce(
        (sum, row) => sum + row.classroomFeeJpy,
        0,
      );
      const totalWageJpy = this.confirmJpy(
        snapshot.baseWageJpy +
          transportationFeeJpy +
          classroomFeeJpy +
          snapshot.manualAdjustmentJpy,
      );

      return {
        snapshotId: snapshot.id,
        businessEntity: snapshot.businessEntity,
        rowCount: snapshotRows.length,
        before: {
          transportationFeeJpy: snapshot.transportationFeeJpy,
          classroomFeeJpy: snapshot.classroomFeeJpy,
          totalWageJpy: snapshot.totalWageJpy,
        },
        after: {
          transportationFeeJpy,
          classroomFeeJpy,
          totalWageJpy,
        },
      };
    });

    return {
      teacher: snapshots[0].teacher,
      yearMonth: snapshots[0].yearMonth,
      importSource,
      rowCount: rows.length,
      groups,
      totalTransportationFeeJpy: groups.reduce(
        (sum, group) => sum + group.after.transportationFeeJpy,
        0,
      ),
      totalClassroomFeeJpy: groups.reduce(
        (sum, group) => sum + group.after.classroomFeeJpy,
        0,
      ),
      totalWageJpy: groups.reduce((sum, group) => sum + group.after.totalWageJpy, 0),
    };
  }

  private assertSnapshotAdjustable(snapshot: WageSnapshot) {
    if (
      snapshot.status === TeacherWageSnapshotStatus.expense_created ||
      snapshot.expenseRecordId
    ) {
      throw new BadRequestException("Wage snapshot already generated expense.");
    }

    if (snapshot.status === TeacherWageSnapshotStatus.revoked) {
      throw new BadRequestException("Revoked wage snapshot cannot be adjusted.");
    }

    if (
      snapshot.status !== TeacherWageSnapshotStatus.locked ||
      snapshot.adjustmentStatus === TeacherWageAdjustmentStatus.confirmed
    ) {
      throw new BadRequestException("Confirmed wage adjustments cannot be edited.");
    }
  }

  private assertSnapshotExportable(snapshot: WageSnapshot) {
    if (
      snapshot.status === TeacherWageSnapshotStatus.expense_created ||
      snapshot.expenseRecordId
    ) {
      throw new BadRequestException("Wage snapshot already generated expense.");
    }

    if (snapshot.status === TeacherWageSnapshotStatus.revoked) {
      throw new BadRequestException("Revoked wage snapshot cannot be exported.");
    }
  }

  private assertSnapshotAttendanceImportable(snapshot: WageSnapshot) {
    this.assertSnapshotAdjustable(snapshot);

    if (snapshot.status !== TeacherWageSnapshotStatus.locked) {
      throw new BadRequestException("Only locked wage snapshot can import attendance adjustments.");
    }

    if (
      snapshot.adjustmentStatus === TeacherWageAdjustmentStatus.confirmed
    ) {
      throw new BadRequestException("Confirmed wage snapshot cannot import attendance adjustments.");
    }
  }

  private buildAttendanceExportPayload(snapshot: WageSnapshot) {
    return {
      kind: "teacher_attendance_adjustment_sheet",
      snapshotId: snapshot.id,
      teacher: snapshot.teacher,
      businessEntity: snapshot.businessEntity,
      yearMonth: snapshot.yearMonth,
      status: snapshot.status,
      adjustmentStatus: snapshot.adjustmentStatus,
      readonlySummary: {
        lessonCount: snapshot.lessonCount,
        totalLessonHours: snapshot.totalLessonHours.toNumber(),
        baseWageJpy: snapshot.baseWageJpy,
        currentTransportationFeeJpy: snapshot.transportationFeeJpy,
        currentClassroomFeeJpy: snapshot.classroomFeeJpy,
        currentManualAdjustmentJpy: snapshot.manualAdjustmentJpy,
        currentTotalWageJpy: snapshot.totalWageJpy,
      },
      writableFields: {
        transportationFeeJpy: snapshot.transportationFeeJpy,
        classroomFeeJpy: snapshot.classroomFeeJpy,
        manualAdjustmentJpy: snapshot.manualAdjustmentJpy,
        memo: snapshot.memo,
      },
      rows: snapshot.details.map((detail, index) => ({
        rowNo: index + 1,
        detailId: detail.id,
        actualLessonId: detail.actualLessonId,
        actualDate: detail.actualDate.toISOString().slice(0, 10),
        studentName: detail.studentNameSnapshot,
        subjectName: detail.subjectNameSnapshot,
        durationHours: detail.durationHours.toNumber(),
        hourlyRateJpy: detail.hourlyRateJpy,
        lessonWageJpy: detail.lessonWageJpy,
        teacherWageEligible: detail.teacherWageEligible,
        includedInWage: detail.includedInWage,
        content: detail.contentSnapshot,
      })),
      policy: {
        editableFields: [
          "transportationFeeJpy",
          "classroomFeeJpy",
          "manualAdjustmentJpy",
          "memo",
        ],
        lessonRowsAreReadonly: true,
        jpyPrecision: 0,
      },
    };
  }

  private normalizeAttendanceImportInput(
    body: ImportTeacherAttendanceAdjustmentsBody,
    current: WageSnapshot,
  ) {
    const transportationFeeJpy =
      body.transportationFeeJpy === undefined
        ? current.transportationFeeJpy
        : this.normalizeJpyAmount(body.transportationFeeJpy, "transportationFeeJpy");
    const classroomFeeJpy =
      body.classroomFeeJpy === undefined
        ? current.classroomFeeJpy
        : this.normalizeJpyAmount(body.classroomFeeJpy, "classroomFeeJpy");
    const manualAdjustmentJpy =
      body.manualAdjustmentJpy === undefined
        ? current.manualAdjustmentJpy
        : this.normalizeJpySignedAmount(body.manualAdjustmentJpy, "manualAdjustmentJpy");
    const memo =
      body.memo === undefined ? current.memo : this.normalizeOptionalString(body.memo);
    const importSource =
      this.normalizeOptionalString(body.importSource) ?? "structured_payload";

    return {
      transportationFeeJpy,
      classroomFeeJpy,
      manualAdjustmentJpy,
      memo,
      importSource,
    };
  }

  private buildAttendanceImportPreview(
    snapshot: WageSnapshot,
    input: ReturnType<WagesService["normalizeAttendanceImportInput"]>,
  ) {
    const totalWageJpy = this.confirmJpy(
      snapshot.baseWageJpy +
        input.transportationFeeJpy +
        input.classroomFeeJpy +
        input.manualAdjustmentJpy,
    );

    return {
      snapshotId: snapshot.id,
      importSource: input.importSource,
      before: {
        baseWageJpy: snapshot.baseWageJpy,
        transportationFeeJpy: snapshot.transportationFeeJpy,
        classroomFeeJpy: snapshot.classroomFeeJpy,
        manualAdjustmentJpy: snapshot.manualAdjustmentJpy,
        totalWageJpy: snapshot.totalWageJpy,
        adjustmentStatus: snapshot.adjustmentStatus,
      },
      after: {
        baseWageJpy: snapshot.baseWageJpy,
        transportationFeeJpy: input.transportationFeeJpy,
        classroomFeeJpy: input.classroomFeeJpy,
        manualAdjustmentJpy: input.manualAdjustmentJpy,
        totalWageJpy,
        adjustmentStatus: TeacherWageAdjustmentStatus.imported,
      },
      changed:
        snapshot.transportationFeeJpy !== input.transportationFeeJpy ||
        snapshot.classroomFeeJpy !== input.classroomFeeJpy ||
        snapshot.manualAdjustmentJpy !== input.manualAdjustmentJpy,
    };
  }

  private async findRule(id: string): Promise<WageRuleSnapshot> {
    const rule = await this.prisma.teacherWageRule.findUnique({
      where: { id },
      select: wageRuleSelect,
    });

    if (!rule) {
      throw new NotFoundException("Teacher wage rule not found.");
    }

    return rule;
  }

  private async findSnapshot(id: string): Promise<WageSnapshot> {
    const snapshot = await this.prisma.teacherWageSnapshot.findUnique({
      where: { id },
      select: wageSnapshotSelect,
    });

    if (!snapshot) {
      throw new NotFoundException("Teacher wage snapshot not found.");
    }

    return snapshot;
  }

  private async normalizeRuleInput(body: TeacherWageRuleBody) {
    const teacherId = this.normalizeRequiredString(body.teacherId, "teacherId");
    const businessEntityId = await resolveOperationalBusinessEntityId(
      this.prisma,
      this.normalizeOptionalString(body.businessEntityId),
    );

    await this.assertActiveTeacherAndBusinessEntity(teacherId, businessEntityId);

    return {
      teacherId,
      businessEntityId,
      hourlyRateJpy: this.normalizeJpyAmount(body.hourlyRateJpy, "hourlyRateJpy"),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeWageKey(body: PreviewTeacherWageBody): NormalizedWageKey {
    return {
      teacherId: this.normalizeRequiredString(body.teacherId, "teacherId"),
      yearMonth: this.normalizeYearMonth(body.yearMonth),
      businessEntityId: this.normalizeRequiredString(
        body.businessEntityId,
        "businessEntityId",
      ),
    };
  }

  private async assertActiveTeacherAndBusinessEntity(
    teacherId: string,
    businessEntityId: string,
  ) {
    const [teacher, businessEntity] = await Promise.all([
      this.prisma.teacher.findFirst({
        where: { id: teacherId, status: RecordStatus.active },
        select: { id: true },
      }),
      this.prisma.businessEntity.findFirst({
        where: { id: businessEntityId, status: RecordStatus.active },
        select: { id: true },
      }),
    ]);

    if (!teacher) {
      throw new BadRequestException("Active teacher is required.");
    }

    if (!businessEntity) {
      throw new BadRequestException("Active business entity is required.");
    }
  }

  private buildRuleWhere(query: ListTeacherWageRulesQuery): Prisma.TeacherWageRuleWhereInput {
    const teacherId = this.normalizeOptionalString(query.teacherId);
    const businessEntityId = this.normalizeOptionalString(query.businessEntityId);
    const status = this.normalizeRecordStatus(query.status);

    return {
      ...(teacherId ? { teacherId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
      ...(status ? { status } : {}),
    };
  }

  private buildSnapshotWhere(
    query: ListTeacherWageSnapshotsQuery,
  ): Prisma.TeacherWageSnapshotWhereInput {
    const teacherId = this.normalizeOptionalString(query.teacherId);
    const businessEntityId = this.normalizeOptionalString(query.businessEntityId);
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const status = this.normalizeSnapshotStatus(query.status);
    const adjustmentStatus = this.normalizeAdjustmentStatus(query.adjustmentStatus);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(teacherId ? { teacherId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
      ...(yearMonth ? { yearMonth } : {}),
      ...(status ? { status } : {}),
      ...(adjustmentStatus ? { adjustmentStatus } : {}),
      ...(keyword
        ? {
            teacher: {
              OR: [
                { code: { contains: keyword, mode: "insensitive" } },
                { name: { contains: keyword, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
  }

  private normalizeRecordStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(RecordStatus).includes(status as RecordStatus)) {
      return status as RecordStatus;
    }

    return undefined;
  }

  private normalizeSnapshotStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(TeacherWageSnapshotStatus).includes(
        status as TeacherWageSnapshotStatus,
      )
    ) {
      return status as TeacherWageSnapshotStatus;
    }

    return undefined;
  }

  private normalizeAdjustmentStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(TeacherWageAdjustmentStatus).includes(
        status as TeacherWageAdjustmentStatus,
      )
    ) {
      return status as TeacherWageAdjustmentStatus;
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

  private normalizeYearMonth(value: unknown) {
    const yearMonth = this.normalizeRequiredString(value, "yearMonth");

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new BadRequestException("yearMonth must be YYYY-MM.");
    }

    return yearMonth;
  }

  private normalizeOptionalYearMonth(value: unknown) {
    const yearMonth = this.normalizeOptionalString(value);

    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return undefined;
    }

    return yearMonth;
  }

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private normalizeOptionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private normalizeJpyAmount(value: unknown, field: string) {
    const numeric = this.normalizeNumber(value, field);

    if (numeric < 0) {
      throw new BadRequestException(`${field} must not be negative.`);
    }

    return this.confirmJpy(numeric);
  }

  private normalizeJpySignedAmount(value: unknown, field: string) {
    return this.confirmJpy(this.normalizeNumber(value, field));
  }

  private normalizeNumber(value: unknown, field: string) {
    const numeric =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(numeric)) {
      throw new BadRequestException(`${field} must be a valid number.`);
    }

    return numeric;
  }

  private confirmJpy(amount: number) {
    return this.moneyService.confirmAmount({
      amount,
      currency: "JPY",
    });
  }

  private confirmHours(hours: number) {
    return new Prisma.Decimal(hours).toDecimalPlaces(2).toNumber();
  }
}
