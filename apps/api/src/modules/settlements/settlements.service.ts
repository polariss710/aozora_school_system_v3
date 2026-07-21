import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditRiskLevel,
  CashRequestStatus,
  CurrencyCode,
  PlannedLessonStatus,
  Prisma,
  RecordStatus,
  StudentSettlementStatus,
  TuitionBillStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  ListStudentSettlementsQuery,
  LockStudentSettlementBody,
  PreviewStudentSettlementBody,
  RevokeStudentSettlementBody,
} from "./settlements.types";

const defaultLimit = 100;
const maxLimit = 500;

const studentSettlementSelect = {
  id: true,
  studentId: true,
  yearMonth: true,
  plannedLessonCount: true,
  billableLessonCount: true,
  cancelledLessonCount: true,
  actualLessonCount: true,
  plannedAmountJpy: true,
  billableAmountJpy: true,
  receivedAmountJpy: true,
  receivedAmountCny: true,
  previousCarryoverAmountCny: true,
  settlementExchangeRate: true,
  adjustmentAmountCny: true,
  carryoverAmountCny: true,
  status: true,
  calculationSnapshot: true,
  lockedAt: true,
  revokedAt: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.StudentMonthlySettlementSelect;

type StudentSettlementSnapshot = Prisma.StudentMonthlySettlementGetPayload<{
  select: typeof studentSettlementSelect;
}>;

const settlementExportLessonRelationSelect = {
  id: true,
  code: true,
  name: true,
} as const;

type NormalizedSettlementInput = {
  studentId: string;
  yearMonth: string;
  settlementExchangeRate: number | null;
  adjustmentAmountCny: number;
};

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listStudentSettlements(query: ListStudentSettlementsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.studentMonthlySettlement.findMany({
        where,
        orderBy: [{ yearMonth: "desc" }, { student: { name: "asc" } }],
        take: limit,
        select: studentSettlementSelect,
      }),
      this.prisma.studentMonthlySettlement.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getStudentSettlement(id: string) {
    const settlement = await this.findStudentSettlement(id);

    return { settlement };
  }

  async exportStudentSettlement(id: string) {
    const settlement = await this.findStudentSettlement(id);

    if (settlement.status !== StudentSettlementStatus.locked) {
      throw new BadRequestException("Only locked settlement can be exported.");
    }

    const plannedLessonIds = this.getSnapshotStringArray(
      settlement.calculationSnapshot,
      "sourceLessonIds",
    );
    const actualLessonIds = this.getSnapshotStringArray(
      settlement.calculationSnapshot,
      "actualLessonIds",
    );

    const [plannedLessons, actualLessons] = await Promise.all([
      this.prisma.studentPlannedLesson.findMany({
        where: { id: { in: plannedLessonIds } },
        orderBy: [{ plannedDate: "asc" }, { lessonNo: "asc" }],
        select: {
          id: true,
          yearMonth: true,
          weekAnchorDate: true,
          plannedDate: true,
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
          teacher: { select: settlementExportLessonRelationSelect },
          subject: { select: settlementExportLessonRelationSelect },
          businessEntity: { select: settlementExportLessonRelationSelect },
        },
      }),
      this.prisma.studentActualLesson.findMany({
        where: { id: { in: actualLessonIds } },
        orderBy: [{ actualDate: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          plannedLessonId: true,
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
          teacher: { select: settlementExportLessonRelationSelect },
          subject: { select: settlementExportLessonRelationSelect },
          businessEntity: { select: settlementExportLessonRelationSelect },
        },
      }),
    ]);

    return {
      exportPayload: this.buildStudentSettlementExportPayload(
        settlement,
        plannedLessons,
        actualLessons,
      ),
      settlement,
    };
  }

  async previewStudentSettlement(body: PreviewStudentSettlementBody) {
    const input = this.normalizeSettlementInput(body);
    const preview = await this.buildStudentSettlementPreview(input);

    return { preview };
  }

  async lockStudentSettlement(
    body: LockStudentSettlementBody,
    actorUserId: string,
  ) {
    const input = this.normalizeSettlementInput(body);
    const memo = this.normalizeOptionalString(body.memo);
    const preview = await this.buildStudentSettlementPreview(input);

    if (preview.blockingIssues.length > 0) {
      throw new BadRequestException(preview.blockingIssues.join(" "));
    }

    if (preview.needsExchangeRate) {
      throw new BadRequestException(
        "settlementExchangeRate is required to lock CNY carryover.",
      );
    }

    const existing = await this.prisma.studentMonthlySettlement.findUnique({
      where: {
        studentId_yearMonth: {
          studentId: input.studentId,
          yearMonth: input.yearMonth,
        },
      },
      select: studentSettlementSelect,
    });

    if (existing?.status === StudentSettlementStatus.locked) {
      await this.assertSettlementCanBeReplaced(existing);
    }

    const settlement = await this.prisma.$transaction(async (tx) => {
      const data = {
        studentId: input.studentId,
        yearMonth: input.yearMonth,
        plannedLessonCount: preview.plannedLessonCount,
        billableLessonCount: preview.billableLessonCount,
        cancelledLessonCount: preview.cancelledLessonCount,
        actualLessonCount: preview.actualLessonCount,
        plannedAmountJpy: preview.plannedAmountJpy,
        billableAmountJpy: preview.billableAmountJpy,
        receivedAmountJpy: preview.receivedAmountJpy,
        receivedAmountCny: new Prisma.Decimal(preview.receivedAmountCny),
        previousCarryoverAmountCny: new Prisma.Decimal(
          preview.previousCarryoverAmountCny,
        ),
        settlementExchangeRate: input.settlementExchangeRate
          ? new Prisma.Decimal(input.settlementExchangeRate)
          : null,
        adjustmentAmountCny: new Prisma.Decimal(preview.adjustmentAmountCny),
        carryoverAmountCny: new Prisma.Decimal(preview.carryoverAmountCny),
        status: StudentSettlementStatus.locked,
        calculationSnapshot: preview,
        lockedAt: new Date(),
        revokedAt: null,
        memo: memo ?? null,
      };

      const saved = existing
        ? await tx.studentMonthlySettlement.update({
            where: { id: existing.id },
            data,
            select: studentSettlementSelect,
          })
        : await tx.studentMonthlySettlement.create({
            data,
            select: studentSettlementSelect,
          });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: existing
            ? "student_monthly_settlement.relock"
            : "student_monthly_settlement.lock",
          targetType: "student_monthly_settlement",
          targetId: saved.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: existing,
          afterSnapshot: saved,
        },
        tx,
      );

      return saved;
    });

    return { settlement };
  }

  async revokeStudentSettlement(
    id: string,
    body: RevokeStudentSettlementBody,
    actorUserId: string,
  ) {
    const before = await this.findStudentSettlement(id);

    if (before.status !== StudentSettlementStatus.locked) {
      throw new BadRequestException("Only locked settlement can be revoked.");
    }

    await this.assertSettlementCanBeReplaced(before);
    const reason = this.normalizeOptionalString(body.reason);

    const settlement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentMonthlySettlement.update({
        where: { id },
        data: {
          status: StudentSettlementStatus.revoked,
          revokedAt: new Date(),
        },
        select: studentSettlementSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "student_monthly_settlement.revoke",
          targetType: "student_monthly_settlement",
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

    return { settlement };
  }

  private async buildStudentSettlementPreview(
    input: NormalizedSettlementInput,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: input.studentId, status: RecordStatus.active },
      select: { id: true, code: true, name: true },
    });

    if (!student) {
      throw new BadRequestException("Active student is required.");
    }

    const [plannedLessons, actualLessons, tuitionBill, confirmedIncomeRecords] =
      await Promise.all([
        this.prisma.studentPlannedLesson.findMany({
          where: { studentId: input.studentId, yearMonth: input.yearMonth },
          orderBy: [{ weekAnchorDate: "asc" }, { lessonNo: "asc" }],
          select: {
            id: true,
            teacherId: true,
            subjectId: true,
            businessEntityId: true,
            weekAnchorDate: true,
            lessonNo: true,
            plannedFeeJpy: true,
            status: true,
          },
        }),
        this.prisma.studentActualLesson.findMany({
          where: {
            studentId: input.studentId,
            yearMonth: input.yearMonth,
          },
          orderBy: [{ actualDate: "asc" }],
          select: {
            id: true,
            plannedLessonId: true,
            actualDate: true,
            status: true,
            teacherWageEligible: true,
          },
        }),
        this.prisma.studentTuitionBill.findFirst({
          where: {
            studentId: input.studentId,
            yearMonth: input.yearMonth,
            status: { in: [TuitionBillStatus.generated, TuitionBillStatus.income_created] },
          },
          orderBy: { version: "desc" },
          select: {
            id: true,
            status: true,
            plannedAmountJpy: true,
            carryoverAmountCny: true,
          },
        }),
        this.prisma.incomeRecord.findMany({
          where: {
            studentId: input.studentId,
            yearMonth: input.yearMonth,
            recordStatus: "cash_confirmed",
            cashStatus: CashRequestStatus.cash_confirmed,
          },
          select: {
            id: true,
            sourceType: true,
            originalCurrency: true,
            originalAmountJpy: true,
            originalAmountCny: true,
            carryoverAmountCny: true,
            cashRequests: {
              where: { status: CashRequestStatus.cash_confirmed },
              select: {
                id: true,
                requestedCurrency: true,
                requestedAmountJpy: true,
                requestedAmountCny: true,
                exchangeRate: true,
              },
            },
          },
        }),
      ]);

    const unresolvedLessonIds = plannedLessons
      .filter((lesson) => lesson.status === PlannedLessonStatus.scheduled)
      .map((lesson) => lesson.id);
    // Student tuition and monthly receivables are fixed by formal planned lessons.
    // A cancellation creates a fulfillment / makeup obligation, not an automatic refund.
    const billableLessons = plannedLessons;
    const cancelledLessons = plannedLessons.filter(
      (lesson) => lesson.status === PlannedLessonStatus.cancelled,
    );
    const plannedAmountJpy = plannedLessons.reduce(
      (sum, lesson) => sum + lesson.plannedFeeJpy,
      0,
    );
    const billableAmountJpy = billableLessons.reduce(
      (sum, lesson) => sum + lesson.plannedFeeJpy,
      0,
    );
    const received = this.sumConfirmedCash(confirmedIncomeRecords);
    const previousCarryoverAmountCny = this.confirmCny(
      tuitionBill?.carryoverAmountCny.toNumber() ?? 0,
    );
    const adjustmentAmountCny = this.confirmCny(input.adjustmentAmountCny);
    const needsExchangeRate =
      !input.settlementExchangeRate &&
      (billableAmountJpy !== 0 || received.receivedAmountJpy !== 0);
    const expectedAmountCny = input.settlementExchangeRate
      ? this.moneyService.convertJpyToCny({
          jpyAmount: billableAmountJpy,
          exchangeRate: input.settlementExchangeRate,
          carryoverCny: previousCarryoverAmountCny,
        })
      : needsExchangeRate
        ? null
        : previousCarryoverAmountCny;
    const receivedAmountCny = input.settlementExchangeRate
      ? this.confirmCny(
          received.receivedAmountCny +
            this.moneyService.convertJpyToCny({
              jpyAmount: received.receivedAmountJpy,
              exchangeRate: input.settlementExchangeRate,
            }),
        )
      : this.confirmCny(received.receivedAmountCny);
    const carryoverAmountCny =
      expectedAmountCny === null
        ? 0
        : this.confirmCny(
            expectedAmountCny - receivedAmountCny + adjustmentAmountCny,
          );
    const blockingIssues = [
      ...(plannedLessons.length === 0
        ? ["No planned lessons exist for this student/month."]
        : []),
      ...(unresolvedLessonIds.length > 0
        ? ["Scheduled planned lessons must be processed before settlement lock."]
        : []),
    ];

    return {
      student,
      studentId: input.studentId,
      yearMonth: input.yearMonth,
      plannedLessonCount: plannedLessons.length,
      billableLessonCount: billableLessons.length,
      cancelledLessonCount: cancelledLessons.length,
      actualLessonCount: actualLessons.length,
      plannedAmountJpy,
      billableAmountJpy,
      receivedAmountJpy: received.receivedAmountJpy,
      receivedAmountCny,
      previousCarryoverAmountCny,
      expectedAmountCny,
      adjustmentAmountCny,
      carryoverAmountCny,
      settlementExchangeRate: input.settlementExchangeRate,
      needsExchangeRate,
      blockingIssues,
      tuitionBill: tuitionBill
        ? {
            id: tuitionBill.id,
            status: tuitionBill.status,
            plannedAmountJpy: tuitionBill.plannedAmountJpy,
            carryoverAmountCny: tuitionBill.carryoverAmountCny.toNumber(),
          }
        : null,
      sourceLessonIds: plannedLessons.map((lesson) => lesson.id),
      billableLessonIds: billableLessons.map((lesson) => lesson.id),
      cancelledLessonIds: cancelledLessons.map((lesson) => lesson.id),
      actualLessonIds: actualLessons.map((lesson) => lesson.id),
      incomeRecordIds: confirmedIncomeRecords.map((record) => record.id),
      cashRequestIds: confirmedIncomeRecords.flatMap((record) =>
        record.cashRequests.map((request) => request.id),
      ),
      calculationPolicy: {
        studentFeeBase: "all_formal_planned_lessons",
        cancellation: "creates_makeup_balance_without_automatic_refund",
        carryoverFormula:
          "expected_cny - received_cny + adjustment_cny; positive carries to next bill",
        cnyPrecision: 2,
        jpyPrecision: 0,
      },
    };
  }

  private sumConfirmedCash(
    records: Array<{
      cashRequests: Array<{
        requestedCurrency: CurrencyCode;
        requestedAmountJpy: number | null;
        requestedAmountCny: Prisma.Decimal | null;
      }>;
    }>,
  ) {
    return records.reduce(
      (sum, record) => {
        for (const request of record.cashRequests) {
          if (request.requestedCurrency === CurrencyCode.JPY) {
            sum.receivedAmountJpy += request.requestedAmountJpy ?? 0;
          } else {
            sum.receivedAmountCny +=
              request.requestedAmountCny?.toNumber() ?? 0;
          }
        }

        return sum;
      },
      { receivedAmountJpy: 0, receivedAmountCny: 0 },
    );
  }

  private async assertSettlementCanBeReplaced(
    settlement: StudentSettlementSnapshot,
  ) {
    const nextYearMonth = this.addMonths(settlement.yearMonth, 1);
    const downstreamBill = await this.prisma.studentTuitionBill.findFirst({
      where: {
        studentId: settlement.studentId,
        yearMonth: nextYearMonth,
        status: { in: [TuitionBillStatus.generated, TuitionBillStatus.income_created] },
      },
      orderBy: { version: "desc" },
      select: { id: true, status: true },
    });

    if (downstreamBill) {
      throw new BadRequestException(
        "Next month tuition bill already exists. Revoke or rebuild downstream bill first.",
      );
    }
  }

  private buildStudentSettlementExportPayload(
    settlement: StudentSettlementSnapshot,
    plannedLessons: Array<
      Prisma.StudentPlannedLessonGetPayload<{
        select: {
          id: true;
          yearMonth: true;
          weekAnchorDate: true;
          plannedDate: true;
          lessonNo: true;
          plannedStartTime: true;
          plannedEndTime: true;
          durationHours: true;
          plannedFeeJpy: true;
          content: true;
          memo: true;
          status: true;
          sourceType: true;
          sourceId: true;
          teacher: { select: typeof settlementExportLessonRelationSelect };
          subject: { select: typeof settlementExportLessonRelationSelect };
          businessEntity: { select: typeof settlementExportLessonRelationSelect };
        };
      }>
    >,
    actualLessons: Array<
      Prisma.StudentActualLessonGetPayload<{
        select: {
          id: true;
          plannedLessonId: true;
          yearMonth: true;
          actualDate: true;
          startTime: true;
          endTime: true;
          durationHours: true;
          content: true;
          memo: true;
          status: true;
          teacherWageEligible: true;
          sourceType: true;
          sourceId: true;
          teacher: { select: typeof settlementExportLessonRelationSelect };
          subject: { select: typeof settlementExportLessonRelationSelect };
          businessEntity: { select: typeof settlementExportLessonRelationSelect };
        };
      }>
    >,
  ) {
    const actualByPlannedLessonId = new Map(
      actualLessons
        .filter((lesson) => lesson.plannedLessonId)
        .map((lesson) => [lesson.plannedLessonId, lesson]),
    );

    return {
      kind: "student_monthly_settlement_lesson_export",
      settlementId: settlement.id,
      student: settlement.student,
      yearMonth: settlement.yearMonth,
      status: settlement.status,
      lockedAt: settlement.lockedAt.toISOString(),
      summary: {
        plannedLessonCount: settlement.plannedLessonCount,
        billableLessonCount: settlement.billableLessonCount,
        cancelledLessonCount: settlement.cancelledLessonCount,
        actualLessonCount: settlement.actualLessonCount,
        plannedAmountJpy: settlement.plannedAmountJpy,
        billableAmountJpy: settlement.billableAmountJpy,
        receivedAmountJpy: settlement.receivedAmountJpy,
        receivedAmountCny: settlement.receivedAmountCny.toNumber(),
        previousCarryoverAmountCny:
          settlement.previousCarryoverAmountCny.toNumber(),
        settlementExchangeRate:
          settlement.settlementExchangeRate?.toNumber() ?? null,
        adjustmentAmountCny: settlement.adjustmentAmountCny.toNumber(),
        carryoverAmountCny: settlement.carryoverAmountCny.toNumber(),
      },
      rows: plannedLessons.map((plannedLesson, index) => {
        const actualLesson = actualByPlannedLessonId.get(plannedLesson.id) ?? null;

        return {
          rowNo: index + 1,
          plannedLesson: {
            id: plannedLesson.id,
            yearMonth: plannedLesson.yearMonth,
            weekAnchorDate: this.formatDate(plannedLesson.weekAnchorDate),
            plannedDate: this.formatDate(plannedLesson.plannedDate),
            weekLabel: this.formatWeekLabel(plannedLesson.weekAnchorDate),
            lessonNo: plannedLesson.lessonNo,
            plannedStartTime: plannedLesson.plannedStartTime,
            plannedEndTime: plannedLesson.plannedEndTime,
            durationHours: plannedLesson.durationHours.toNumber(),
            plannedFeeJpy: plannedLesson.plannedFeeJpy,
            content: plannedLesson.content,
            memo: plannedLesson.memo,
            status: plannedLesson.status,
            sourceType: plannedLesson.sourceType,
            sourceId: plannedLesson.sourceId,
            teacher: plannedLesson.teacher,
            subject: plannedLesson.subject,
            businessEntity: plannedLesson.businessEntity,
          },
          actualLesson: actualLesson
            ? {
                id: actualLesson.id,
                yearMonth: actualLesson.yearMonth,
                actualDate: this.formatDate(actualLesson.actualDate),
                startTime: actualLesson.startTime,
                endTime: actualLesson.endTime,
                durationHours: actualLesson.durationHours.toNumber(),
                content: actualLesson.content,
                memo: actualLesson.memo,
                status: actualLesson.status,
                teacherWageEligible: actualLesson.teacherWageEligible,
                sourceType: actualLesson.sourceType,
                sourceId: actualLesson.sourceId,
                teacher: actualLesson.teacher,
                subject: actualLesson.subject,
                businessEntity: actualLesson.businessEntity,
              }
            : null,
        };
      }),
      calculationSnapshot: settlement.calculationSnapshot,
      policy: {
        lockedSettlementOnly: true,
        fileRendering: "not_generated_by_this_api",
        plannedLessonWeekDate: "week_anchor_monday",
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

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private formatWeekLabel(date: Date) {
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}周`;
  }

  private async findStudentSettlement(
    id: string,
  ): Promise<StudentSettlementSnapshot> {
    const settlement = await this.prisma.studentMonthlySettlement.findUnique({
      where: { id },
      select: studentSettlementSelect,
    });

    if (!settlement) {
      throw new NotFoundException("Student monthly settlement not found.");
    }

    return settlement;
  }

  private buildWhere(
    query: ListStudentSettlementsQuery,
  ): Prisma.StudentMonthlySettlementWhereInput {
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

  private normalizeSettlementInput(
    body: PreviewStudentSettlementBody,
  ): NormalizedSettlementInput {
    return {
      studentId: this.normalizeRequiredString(body.studentId, "studentId"),
      yearMonth: this.normalizeYearMonth(body.yearMonth),
      settlementExchangeRate: this.normalizeOptionalPositiveNumber(
        body.settlementExchangeRate,
        "settlementExchangeRate",
      ),
      adjustmentAmountCny: this.confirmCny(
        this.normalizeOptionalNumber(body.adjustmentAmountCny),
      ),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(StudentSettlementStatus).includes(
        status as StudentSettlementStatus,
      )
    ) {
      return status as StudentSettlementStatus;
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
    return typeof value === "string" && value.trim()
      ? value.trim()
      : undefined;
  }

  private normalizeOptionalNumber(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return 0;
    }

    const numeric =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(numeric)) {
      throw new BadRequestException("Amount must be a valid number.");
    }

    return numeric;
  }

  private normalizeOptionalPositiveNumber(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const numeric =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new BadRequestException(`${field} must be a positive number.`);
    }

    return numeric;
  }

  private confirmCny(amount: number) {
    return this.moneyService.confirmAmount({
      amount,
      currency: "CNY",
    });
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
