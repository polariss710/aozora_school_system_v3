import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditRiskLevel,
  CashRequestStatus,
  IncomeRecordStatus,
  PlannedLessonStatus,
  Prisma,
  RecordStatus,
  StudentSettlementStatus,
  TuitionBillStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  GenerateTuitionBillBody,
  ListTuitionBillsQuery,
  VoidTuitionBillBody,
} from "./tuition-billing.types";

const defaultLimit = 100;
const maxLimit = 500;
const tuitionSourceType = "student_tuition_bill";

const tuitionBillSelect = {
  id: true,
  studentId: true,
  yearMonth: true,
  version: true,
  plannedLessonCount: true,
  plannedAmountJpy: true,
  carryoverAmountCny: true,
  status: true,
  calculationSnapshot: true,
  incomeRecordId: true,
  replacesId: true,
  generatedAt: true,
  student: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  incomeRecord: {
    select: {
      id: true,
      recordStatus: true,
      cashStatus: true,
      originalCurrency: true,
      originalAmountJpy: true,
      originalAmountCny: true,
    },
  },
} satisfies Prisma.StudentTuitionBillSelect;

const incomeRecordSelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  studentId: true,
  businessEntityId: true,
  yearMonth: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  carryoverAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  memo: true,
  student: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  businessEntity: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.IncomeRecordSelect;

type TuitionBillSnapshot = Prisma.StudentTuitionBillGetPayload<{
  select: typeof tuitionBillSelect;
}>;

const tuitionExportLessonRelationSelect = {
  id: true,
  code: true,
  name: true,
} as const;

@Injectable()
export class TuitionBillingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listTuitionBills(query: ListTuitionBillsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.studentTuitionBill.findMany({
        where,
        orderBy: [{ yearMonth: "desc" }, { student: { name: "asc" } }, { version: "desc" }],
        take: limit,
        select: tuitionBillSelect,
      }),
      this.prisma.studentTuitionBill.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getTuitionBill(id: string) {
    const tuitionBill = await this.findTuitionBill(id);

    return { tuitionBill };
  }

  async exportTuitionBill(id: string) {
    const tuitionBill = await this.findTuitionBill(id);

    if (tuitionBill.status === TuitionBillStatus.voided) {
      throw new BadRequestException("Voided tuition bill cannot be exported.");
    }

    const plannedLessonIds = this.getSnapshotStringArray(
      tuitionBill.calculationSnapshot,
      "plannedLessonIds",
    );
    const plannedLessons = await this.prisma.studentPlannedLesson.findMany({
      where: { id: { in: plannedLessonIds } },
      orderBy: [{ weekAnchorDate: "asc" }, { lessonNo: "asc" }],
      select: {
        id: true,
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
        teacher: { select: tuitionExportLessonRelationSelect },
        subject: { select: tuitionExportLessonRelationSelect },
        businessEntity: { select: tuitionExportLessonRelationSelect },
      },
    });

    return {
      exportPayload: this.buildTuitionBillExportPayload(
        tuitionBill,
        plannedLessons,
      ),
      tuitionBill,
    };
  }

  async generateTuitionBill(
    body: GenerateTuitionBillBody,
    actorUserId: string,
  ) {
    const studentId = this.normalizeRequiredString(body.studentId, "studentId");
    const yearMonth = this.normalizeYearMonth(body.yearMonth);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, status: RecordStatus.active },
      select: { id: true, name: true },
    });

    if (!student) {
      throw new BadRequestException("Active student is required.");
    }

    const latest = await this.prisma.studentTuitionBill.findFirst({
      where: { studentId, yearMonth },
      orderBy: { version: "desc" },
      select: tuitionBillSelect,
    });

    const latestIncomeWasVoided =
      latest?.status === TuitionBillStatus.income_created &&
      latest.incomeRecord?.recordStatus === IncomeRecordStatus.voided;

    if (latest?.status === TuitionBillStatus.income_created && !latestIncomeWasVoided) {
      throw new BadRequestException(
        "Tuition bill already generated income record.",
      );
    }

    const plannedLessons = await this.prisma.studentPlannedLesson.findMany({
      where: {
        studentId,
        yearMonth,
        status: { not: PlannedLessonStatus.cancelled },
      },
      orderBy: [{ weekAnchorDate: "asc" }, { lessonNo: "asc" }],
      select: {
        id: true,
        teacherId: true,
        subjectId: true,
        businessEntityId: true,
        weekAnchorDate: true,
        lessonNo: true,
        durationHours: true,
        plannedFeeJpy: true,
        status: true,
      },
    });

    const plannedAmountJpy = plannedLessons.reduce(
      (sum, lesson) => sum + lesson.plannedFeeJpy,
      0,
    );
    const previousYearMonth = this.addMonths(yearMonth, -1);
    const previousSettlement =
      await this.prisma.studentMonthlySettlement.findUnique({
        where: {
          studentId_yearMonth: {
            studentId,
            yearMonth: previousYearMonth,
          },
        },
        select: {
          id: true,
          status: true,
          carryoverAmountCny: true,
          lockedAt: true,
        },
      });
    const carryoverAmountCny =
      previousSettlement?.status === StudentSettlementStatus.locked
        ? previousSettlement.carryoverAmountCny
        : new Prisma.Decimal(0);
    const businessEntityIds = [
      ...new Set(plannedLessons.map((lesson) => lesson.businessEntityId)),
    ];
    const calculationSnapshot = {
      source: "student_planned_lessons",
      studentId,
      yearMonth,
      excludedStatuses: [PlannedLessonStatus.cancelled],
      plannedLessonIds: plannedLessons.map((lesson) => lesson.id),
      businessEntityIds,
      plannedLessons: plannedLessons.map((lesson) => ({
        id: lesson.id,
        teacherId: lesson.teacherId,
        subjectId: lesson.subjectId,
        businessEntityId: lesson.businessEntityId,
        weekAnchorDate: lesson.weekAnchorDate.toISOString().slice(0, 10),
        lessonNo: lesson.lessonNo,
        durationHours: lesson.durationHours.toString(),
        plannedFeeJpy: lesson.plannedFeeJpy,
        status: lesson.status,
      })),
      carryoverSource: previousSettlement
        ? {
            type: "previous_locked_student_monthly_settlement",
            yearMonth: previousYearMonth,
            settlementId: previousSettlement.id,
            settlementStatus: previousSettlement.status,
            lockedAt: previousSettlement.lockedAt.toISOString(),
          }
        : {
            type: "none",
            yearMonth: previousYearMonth,
          },
    };

    if (
      latest?.status === TuitionBillStatus.generated &&
      this.isSameTuitionBillCalculation(latest, plannedLessons, carryoverAmountCny)
    ) {
      return { tuitionBill: latest };
    }

    const nextVersion = (latest?.version ?? 0) + 1;

    const tuitionBill = await this.prisma.$transaction(async (tx) => {
      if (latest?.status === TuitionBillStatus.generated) {
        await tx.studentTuitionBill.update({
          where: { id: latest.id },
          data: { status: TuitionBillStatus.superseded },
        });
      }

      if (latestIncomeWasVoided && latest) {
        await tx.studentTuitionBill.update({
          where: { id: latest.id },
          data: { status: TuitionBillStatus.voided },
        });
      }

      const saved = await tx.studentTuitionBill.create({
        data: {
          studentId,
          yearMonth,
          version: nextVersion,
          plannedLessonCount: plannedLessons.length,
          plannedAmountJpy,
          carryoverAmountCny,
          status: TuitionBillStatus.generated,
          calculationSnapshot,
          replacesId: latest?.id ?? null,
        },
        select: tuitionBillSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: latest
            ? "tuition_bill.regenerate"
            : "tuition_bill.generate",
          targetType: "tuition_bill",
          targetId: saved.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: latest,
          afterSnapshot: saved,
        },
        tx,
      );

      return saved;
    });

    return { tuitionBill };
  }

  async generateIncomeRecord(id: string, actorUserId: string) {
    const tuitionBill = await this.findTuitionBill(id);

    if (tuitionBill.status === TuitionBillStatus.income_created) {
      if (!tuitionBill.incomeRecordId) {
        throw new BadRequestException("Tuition bill income mapping is missing.");
      }

      const incomeRecord = await this.prisma.incomeRecord.findUnique({
        where: { id: tuitionBill.incomeRecordId },
        select: incomeRecordSelect,
      });

      return { tuitionBill, incomeRecord };
    }

    if (tuitionBill.status !== TuitionBillStatus.generated) {
      throw new BadRequestException("Tuition bill cannot generate income.");
    }

    const businessEntityId = this.resolveSingleBusinessEntityId(tuitionBill);
    const incomeRecord = await this.prisma.$transaction(async (tx) => {
      const createdIncome = await tx.incomeRecord.create({
        data: {
          sourceType: tuitionSourceType,
          sourceId: tuitionBill.id,
          studentId: tuitionBill.studentId,
          businessEntityId,
          yearMonth: tuitionBill.yearMonth,
          title: `${tuitionBill.yearMonth} ${tuitionBill.student.name} 学费`,
          originalCurrency: "JPY",
          originalAmountJpy: tuitionBill.plannedAmountJpy,
          originalAmountCny: null,
          carryoverAmountCny: tuitionBill.carryoverAmountCny,
          recordStatus: IncomeRecordStatus.pending,
          cashStatus: CashRequestStatus.not_requested,
        },
        select: incomeRecordSelect,
      });

      const updatedBill = await tx.studentTuitionBill.update({
        where: { id: tuitionBill.id },
        data: {
          status: TuitionBillStatus.income_created,
          incomeRecordId: createdIncome.id,
        },
        select: tuitionBillSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "tuition_bill.generate_income",
          targetType: "tuition_bill",
          targetId: tuitionBill.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: tuitionBill,
          afterSnapshot: { tuitionBill: updatedBill, incomeRecord: createdIncome },
        },
        tx,
      );

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "income_record.create_from_tuition_bill",
          targetType: "income_record",
          targetId: createdIncome.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: createdIncome,
          metadata: { tuitionBillId: tuitionBill.id },
        },
        tx,
      );

      return { tuitionBill: updatedBill, incomeRecord: createdIncome };
    });

    return incomeRecord;
  }

  async voidTuitionBill(
    id: string,
    body: VoidTuitionBillBody,
    actorUserId: string,
  ) {
    const before = await this.findTuitionBill(id);

    if (before.status === TuitionBillStatus.voided) {
      return { tuitionBill: before };
    }

    if (before.status !== TuitionBillStatus.generated) {
      throw new BadRequestException(
        "Only generated tuition bill without income can be voided.",
      );
    }

    if (before.incomeRecordId) {
      throw new BadRequestException(
        "Tuition bill with income record cannot be voided directly.",
      );
    }

    const reason = this.normalizeOptionalString(body.reason);
    const calculationSnapshot = this.mergeVoidReason(
      before.calculationSnapshot,
      reason,
    );

    const tuitionBill = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentTuitionBill.update({
        where: { id },
        data: {
          status: TuitionBillStatus.voided,
          calculationSnapshot,
        },
        select: tuitionBillSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "tuition_bill.void",
          targetType: "tuition_bill",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { tuitionBill };
  }

  private async findTuitionBill(id: string): Promise<TuitionBillSnapshot> {
    const tuitionBill = await this.prisma.studentTuitionBill.findUnique({
      where: { id },
      select: tuitionBillSelect,
    });

    if (!tuitionBill) {
      throw new NotFoundException("Tuition bill not found.");
    }

    return tuitionBill;
  }

  private resolveSingleBusinessEntityId(tuitionBill: TuitionBillSnapshot) {
    const snapshot = tuitionBill.calculationSnapshot as {
      businessEntityIds?: unknown;
    };
    const ids = Array.isArray(snapshot.businessEntityIds)
      ? snapshot.businessEntityIds.filter((id): id is string => typeof id === "string")
      : [];

    return ids.length === 1 ? ids[0] : null;
  }

  private mergeVoidReason(snapshot: Prisma.JsonValue, reason: string | null) {
    const base =
      snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
        ? (snapshot as Record<string, unknown>)
        : {};

    return {
      ...base,
      voided: {
        reason,
        voidedAt: new Date().toISOString(),
      },
    };
  }

  private buildTuitionBillExportPayload(
    tuitionBill: TuitionBillSnapshot,
    plannedLessons: Array<
      Prisma.StudentPlannedLessonGetPayload<{
        select: {
          id: true;
          yearMonth: true;
          weekAnchorDate: true;
          lessonNo: true;
          plannedStartTime: true;
          plannedEndTime: true;
          durationHours: true;
          plannedFeeJpy: true;
          content: true;
          memo: true;
          status: true;
          teacher: { select: typeof tuitionExportLessonRelationSelect };
          subject: { select: typeof tuitionExportLessonRelationSelect };
          businessEntity: { select: typeof tuitionExportLessonRelationSelect };
        };
      }>
    >,
  ) {
    return {
      kind: "student_tuition_bill_export",
      tuitionBillId: tuitionBill.id,
      student: tuitionBill.student,
      yearMonth: tuitionBill.yearMonth,
      status: tuitionBill.status,
      generatedAt: tuitionBill.generatedAt.toISOString(),
      incomeRecord: tuitionBill.incomeRecord,
      summary: {
        plannedLessonCount: tuitionBill.plannedLessonCount,
        plannedAmountJpy: tuitionBill.plannedAmountJpy,
        carryoverAmountCny: tuitionBill.carryoverAmountCny.toNumber(),
      },
      rows: plannedLessons.map((lesson, index) => ({
        rowNo: index + 1,
        plannedLessonId: lesson.id,
        yearMonth: lesson.yearMonth,
        weekAnchorDate: this.formatDate(lesson.weekAnchorDate),
        weekLabel: this.formatWeekLabel(lesson.weekAnchorDate),
        lessonNo: lesson.lessonNo,
        plannedStartTime: lesson.plannedStartTime,
        plannedEndTime: lesson.plannedEndTime,
        durationHours: lesson.durationHours.toNumber(),
        plannedFeeJpy: lesson.plannedFeeJpy,
        content: lesson.content,
        memo: lesson.memo,
        status: lesson.status,
        teacher: lesson.teacher,
        subject: lesson.subject,
        businessEntity: lesson.businessEntity,
      })),
      calculationSnapshot: tuitionBill.calculationSnapshot,
      policy: {
        source: "student_tuition_bill_snapshot",
        plannedLessonWeekDate: "week_anchor_monday",
        carryoverCnyIsFrozenFromPreviousLockedSettlement: true,
        notificationAmountIsPreviewOnly: true,
        fileRendering: "not_generated_by_this_api",
        jpyPrecision: 0,
        cnyPrecision: 2,
      },
    };
  }

  private getSnapshotStringArray(snapshot: Prisma.JsonValue, field: string) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return [];
    }

    const value = (snapshot as Record<string, unknown>)[field];

    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private isSameTuitionBillCalculation(
    bill: TuitionBillSnapshot,
    plannedLessons: Array<{ id: string; plannedFeeJpy: number }>,
    carryoverAmountCny: Prisma.Decimal,
  ) {
    const plannedLessonIds = this.getSnapshotStringArray(
      bill.calculationSnapshot,
      "plannedLessonIds",
    );

    return (
      bill.plannedLessonCount === plannedLessons.length &&
      bill.plannedAmountJpy === plannedLessons.reduce((sum, lesson) => sum + lesson.plannedFeeJpy, 0) &&
      bill.carryoverAmountCny.toString() === carryoverAmountCny.toString() &&
      plannedLessonIds.length === plannedLessons.length &&
      plannedLessonIds.every((id, index) => id === plannedLessons[index]?.id)
    );
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private formatWeekLabel(date: Date) {
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}周`;
  }

  private buildWhere(query: ListTuitionBillsQuery): Prisma.StudentTuitionBillWhereInput {
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const studentId = this.normalizeOptionalString(query.studentId);
    const status = this.normalizeStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(yearMonth ? { yearMonth } : {}),
      ...(studentId ? { studentId } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            student: {
              OR: [
                { code: { contains: keyword, mode: "insensitive" } },
                { name: { contains: keyword, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(TuitionBillStatus).includes(status as TuitionBillStatus)) {
      return status as TuitionBillStatus;
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
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("Expected a string value.");
    }

    return value.trim() || null;
  }

  private addMonths(yearMonth: string, months: number) {
    const [year, month] = yearMonth.split("-").map((part) => Number(part));
    const date = new Date(Date.UTC(year, month - 1 + months, 1));

    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }
}
