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
  ExternalWorkLessonStatus,
  ExternalWorkLessonType,
  ExternalWorkSettlementStatus,
  IncomeRecordStatus,
  Prisma,
  RecordStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { resolveOperationalBusinessEntityId } from "../business-entities/business-ownership.policy";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  ExternalWorkLessonBody,
  GenerateExternalWorkActualBody,
  GenerateExternalWorkIncomeBody,
  ListExternalWorkLessonsQuery,
  ListExternalWorkSettlementsQuery,
  LockExternalWorkSettlementBody,
  PreviewExternalWorkSettlementBody,
  RevokeExternalWorkSettlementBody,
} from "./external-work.types";

const defaultLimit = 100;
const maxLimit = 500;
const externalWorkSourceType = "external_work";

const lessonSelect = {
  id: true,
  workplaceId: true,
  yearMonth: true,
  lessonType: true,
  plannedLessonId: true,
  lessonDate: true,
  startTime: true,
  endTime: true,
  durationHours: true,
  instructorName: true,
  lessonTitle: true,
  hourlyRateJpy: true,
  transportationFeeJpy: true,
  lessonWageJpy: true,
  status: true,
  content: true,
  memo: true,
  sourceType: true,
  sourceId: true,
  createdAt: true,
  updatedAt: true,
  workplace: { select: { id: true, code: true, name: true } },
  actualLesson: { select: { id: true, status: true } },
  plannedLesson: { select: { id: true, status: true } },
} satisfies Prisma.ExternalWorkLessonSelect;

const settlementSelect = {
  id: true,
  workplaceId: true,
  yearMonth: true,
  lessonCount: true,
  totalLessonHours: true,
  lessonWageJpy: true,
  transportationFeeJpy: true,
  adjustmentAmountJpy: true,
  totalAmountJpy: true,
  status: true,
  calculationSnapshot: true,
  incomeRecordId: true,
  lockedAt: true,
  revokedAt: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  workplace: { select: { id: true, code: true, name: true } },
  incomeRecord: {
    select: {
      id: true,
      recordStatus: true,
      cashStatus: true,
      originalCurrency: true,
      originalAmountJpy: true,
    },
  },
  details: {
    orderBy: [{ lessonDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      actualLessonId: true,
      lessonDate: true,
      startTime: true,
      endTime: true,
      durationHours: true,
      instructorNameSnapshot: true,
      lessonTitleSnapshot: true,
      hourlyRateJpy: true,
      lessonWageJpy: true,
      transportationFeeJpy: true,
      contentSnapshot: true,
    },
  },
} satisfies Prisma.ExternalWorkMonthlySettlementSelect;

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
} satisfies Prisma.IncomeRecordSelect;

type LessonSnapshot = Prisma.ExternalWorkLessonGetPayload<{
  select: typeof lessonSelect;
}>;

type SettlementSnapshot = Prisma.ExternalWorkMonthlySettlementGetPayload<{
  select: typeof settlementSelect;
}>;

type NormalizedLessonInput = {
  workplaceId: string;
  yearMonth: string;
  lessonDate: Date;
  startTime: string;
  endTime: string;
  durationHours: number;
  instructorName: string;
  lessonTitle: string | null;
  hourlyRateJpy: number;
  transportationFeeJpy: number;
  lessonWageJpy: number;
  content: string | null;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
};

@Injectable()
export class ExternalWorkService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listLessons(query: ListExternalWorkLessonsQuery) {
    const where = this.buildLessonWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.externalWorkLesson.findMany({
        where,
        orderBy: [{ lessonDate: "asc" }, { startTime: "asc" }],
        take: limit,
        select: lessonSelect,
      }),
      this.prisma.externalWorkLesson.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getLesson(id: string) {
    const lesson = await this.findLesson(id);

    return { lesson };
  }

  async createPlannedLesson(body: ExternalWorkLessonBody, actorUserId: string) {
    const input = await this.normalizeLessonInput(body);
    await this.assertSettlementOpen(input.workplaceId, input.yearMonth);

    const lesson = await this.prisma.$transaction(async (tx) => {
      const created = await tx.externalWorkLesson.create({
        data: {
          ...input,
          durationHours: new Prisma.Decimal(input.durationHours),
          lessonType: ExternalWorkLessonType.planned,
          plannedLessonId: null,
          status: ExternalWorkLessonStatus.scheduled,
        },
        select: lessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_work_lesson.create_planned",
          targetType: "external_work_lesson",
          targetId: created.id,
          riskLevel: AuditRiskLevel.medium,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { lesson };
  }

  async updateLesson(
    id: string,
    body: ExternalWorkLessonBody,
    actorUserId: string,
  ) {
    const before = await this.findLesson(id);
    await this.assertSettlementOpen(before.workplaceId, before.yearMonth);
    const input = await this.normalizeLessonInput(body, before);
    await this.assertSettlementOpen(input.workplaceId, input.yearMonth);

    const lesson = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.externalWorkLesson.update({
        where: { id },
        data: {
          workplaceId: input.workplaceId,
          yearMonth: input.yearMonth,
          lessonDate: input.lessonDate,
          startTime: input.startTime,
          endTime: input.endTime,
          durationHours: new Prisma.Decimal(input.durationHours),
          instructorName: input.instructorName,
          lessonTitle: input.lessonTitle,
          hourlyRateJpy: input.hourlyRateJpy,
          transportationFeeJpy: input.transportationFeeJpy,
          lessonWageJpy: input.lessonWageJpy,
          content: input.content,
          memo: input.memo,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
        select: lessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_work_lesson.update",
          targetType: "external_work_lesson",
          targetId: id,
          riskLevel: AuditRiskLevel.medium,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { lesson };
  }

  async deleteLesson(id: string, actorUserId: string) {
    const before = await this.findLesson(id);
    await this.assertSettlementOpen(before.workplaceId, before.yearMonth);

    if (before.lessonType === ExternalWorkLessonType.planned && before.actualLesson) {
      throw new BadRequestException("Planned lesson with actual lesson cannot be deleted.");
    }

    const lesson = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.externalWorkLesson.delete({
        where: { id },
        select: lessonSelect,
      });

      const restoredPlannedLesson =
        before.lessonType === ExternalWorkLessonType.actual && before.plannedLessonId
          ? await tx.externalWorkLesson.update({
              where: { id: before.plannedLessonId },
              data: { status: ExternalWorkLessonStatus.scheduled },
              select: lessonSelect,
            })
          : null;

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_work_lesson.delete",
          targetType: "external_work_lesson",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: { deleted, restoredPlannedLesson },
        },
        tx,
      );

      return deleted;
    });

    return { lesson };
  }

  async generateActualLesson(
    id: string,
    body: GenerateExternalWorkActualBody,
    actorUserId: string,
  ) {
    const planned = await this.findLesson(id);

    if (planned.lessonType !== ExternalWorkLessonType.planned) {
      throw new BadRequestException("Only planned lesson can generate actual lesson.");
    }

    if (planned.actualLesson) {
      throw new BadRequestException("Actual lesson already exists.");
    }

    await this.assertSettlementOpen(planned.workplaceId, planned.yearMonth);
    const input = await this.normalizeLessonInput(body, planned);
    await this.assertSettlementOpen(input.workplaceId, input.yearMonth);

    const result = await this.prisma.$transaction(async (tx) => {
      const actualLesson = await tx.externalWorkLesson.create({
        data: {
          ...input,
          durationHours: new Prisma.Decimal(input.durationHours),
          lessonType: ExternalWorkLessonType.actual,
          plannedLessonId: planned.id,
          status: ExternalWorkLessonStatus.completed,
        },
        select: lessonSelect,
      });

      const plannedLesson = await tx.externalWorkLesson.update({
        where: { id: planned.id },
        data: { status: ExternalWorkLessonStatus.actual_created },
        select: lessonSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_work_lesson.generate_actual",
          targetType: "external_work_lesson",
          targetId: actualLesson.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: planned,
          afterSnapshot: { plannedLesson, actualLesson },
        },
        tx,
      );

      return { plannedLesson, actualLesson };
    });

    return result;
  }

  async listSettlements(query: ListExternalWorkSettlementsQuery) {
    const where = this.buildSettlementWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.externalWorkMonthlySettlement.findMany({
        where,
        orderBy: [{ yearMonth: "desc" }, { workplace: { name: "asc" } }],
        take: limit,
        select: settlementSelect,
      }),
      this.prisma.externalWorkMonthlySettlement.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getSettlement(id: string) {
    const settlement = await this.findSettlement(id);

    return { settlement };
  }

  async exportSettlement(id: string) {
    const settlement = await this.findSettlement(id);

    if (settlement.status === ExternalWorkSettlementStatus.revoked) {
      throw new BadRequestException("Revoked external work settlement cannot be exported.");
    }

    return {
      exportPayload: this.buildSettlementExportPayload(settlement),
      settlement,
    };
  }

  async previewSettlement(body: PreviewExternalWorkSettlementBody) {
    const workplaceId = this.normalizeRequiredString(body.workplaceId, "workplaceId");
    const yearMonth = this.normalizeYearMonth(body.yearMonth);
    const adjustmentAmountJpy = this.normalizeJpySignedAmount(
      body.adjustmentAmountJpy ?? 0,
      "adjustmentAmountJpy",
    );
    const preview = await this.buildSettlementPreview(
      workplaceId,
      yearMonth,
      adjustmentAmountJpy,
    );

    return { preview };
  }

  async lockSettlement(
    body: LockExternalWorkSettlementBody,
    actorUserId: string,
  ) {
    const workplaceId = this.normalizeRequiredString(body.workplaceId, "workplaceId");
    const yearMonth = this.normalizeYearMonth(body.yearMonth);
    const adjustmentAmountJpy = this.normalizeJpySignedAmount(
      body.adjustmentAmountJpy ?? 0,
      "adjustmentAmountJpy",
    );
    const memo = this.normalizeOptionalString(body.memo);
    const preview = await this.buildSettlementPreview(
      workplaceId,
      yearMonth,
      adjustmentAmountJpy,
    );

    if (preview.blockingIssues.length > 0) {
      throw new BadRequestException(preview.blockingIssues.join(" "));
    }

    const existing = await this.prisma.externalWorkMonthlySettlement.findUnique({
      where: { workplaceId_yearMonth: { workplaceId, yearMonth } },
      select: settlementSelect,
    });

    if (existing?.status === ExternalWorkSettlementStatus.income_created) {
      throw new BadRequestException("External work settlement already generated income.");
    }

    const settlement = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.externalWorkSettlementDetail.deleteMany({
          where: { settlementId: existing.id },
        });
      }

      const data = {
        workplaceId,
        yearMonth,
        lessonCount: preview.lessonCount,
        totalLessonHours: new Prisma.Decimal(preview.totalLessonHours),
        lessonWageJpy: preview.lessonWageJpy,
        transportationFeeJpy: preview.transportationFeeJpy,
        adjustmentAmountJpy,
        totalAmountJpy: preview.totalAmountJpy,
        status: ExternalWorkSettlementStatus.locked,
        calculationSnapshot: preview,
        incomeRecordId: null,
        lockedAt: new Date(),
        revokedAt: null,
        memo: memo ?? null,
      };

      const saved = existing
        ? await tx.externalWorkMonthlySettlement.update({
            where: { id: existing.id },
            data,
            select: settlementSelect,
          })
        : await tx.externalWorkMonthlySettlement.create({
            data,
            select: settlementSelect,
          });

      await tx.externalWorkSettlementDetail.createMany({
        data: preview.details.map((detail) => ({
          settlementId: saved.id,
          actualLessonId: detail.actualLessonId,
          lessonDate: new Date(detail.lessonDate),
          startTime: detail.startTime,
          endTime: detail.endTime,
          durationHours: new Prisma.Decimal(detail.durationHours),
          instructorNameSnapshot: detail.instructorNameSnapshot,
          lessonTitleSnapshot: detail.lessonTitleSnapshot,
          hourlyRateJpy: detail.hourlyRateJpy,
          lessonWageJpy: detail.lessonWageJpy,
          transportationFeeJpy: detail.transportationFeeJpy,
          contentSnapshot: detail.contentSnapshot,
        })),
      });

      const reloaded = await tx.externalWorkMonthlySettlement.findUniqueOrThrow({
        where: { id: saved.id },
        select: settlementSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: existing
            ? "external_work_settlement.relock"
            : "external_work_settlement.lock",
          targetType: "external_work_settlement",
          targetId: saved.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: existing,
          afterSnapshot: reloaded,
        },
        tx,
      );

      return reloaded;
    });

    return { settlement };
  }

  async revokeSettlement(
    id: string,
    body: RevokeExternalWorkSettlementBody,
    actorUserId: string,
  ) {
    const before = await this.findSettlement(id);

    if (before.status === ExternalWorkSettlementStatus.income_created) {
      throw new BadRequestException("Settlement with income cannot be revoked.");
    }

    if (before.status === ExternalWorkSettlementStatus.revoked) {
      return { settlement: before };
    }

    const reason = this.normalizeOptionalString(body.reason);

    const settlement = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.externalWorkMonthlySettlement.update({
        where: { id },
        data: { status: ExternalWorkSettlementStatus.revoked, revokedAt: new Date() },
        select: settlementSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_work_settlement.revoke",
          targetType: "external_work_settlement",
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

  async generateIncome(
    id: string,
    body: GenerateExternalWorkIncomeBody,
    actorUserId: string,
  ) {
    const before = await this.findSettlement(id);

    if (before.status === ExternalWorkSettlementStatus.income_created) {
      if (!before.incomeRecordId) {
        throw new BadRequestException("Settlement income mapping is missing.");
      }

      const incomeRecord = await this.prisma.incomeRecord.findUnique({
        where: { id: before.incomeRecordId },
        select: incomeRecordSelect,
      });

      return { settlement: before, incomeRecord };
    }

    if (before.status !== ExternalWorkSettlementStatus.locked) {
      throw new BadRequestException("Only locked settlement can generate income.");
    }

    const memo = this.normalizeOptionalString(body.memo);
    const businessEntityId = await resolveOperationalBusinessEntityId(
      this.prisma,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const incomeRecord = await tx.incomeRecord.create({
        data: {
          sourceType: externalWorkSourceType,
          sourceId: before.id,
          studentId: null,
          businessEntityId,
          yearMonth: before.yearMonth,
          title: `${before.yearMonth} ${before.workplace.name} 外部授课收入`,
          originalCurrency: CurrencyCode.JPY,
          originalAmountJpy: before.totalAmountJpy,
          originalAmountCny: null,
          carryoverAmountCny: null,
          recordStatus: IncomeRecordStatus.pending,
          cashStatus: CashRequestStatus.not_requested,
          memo: memo ?? before.memo,
        },
        select: incomeRecordSelect,
      });

      const settlement = await tx.externalWorkMonthlySettlement.update({
        where: { id: before.id },
        data: {
          status: ExternalWorkSettlementStatus.income_created,
          incomeRecordId: incomeRecord.id,
        },
        select: settlementSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "external_work_settlement.generate_income",
          targetType: "external_work_settlement",
          targetId: before.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: { settlement, incomeRecord },
        },
        tx,
      );

      return { settlement, incomeRecord };
    });

    return result;
  }

  private async buildSettlementPreview(
    workplaceId: string,
    yearMonth: string,
    adjustmentAmountJpy: number,
  ) {
    const workplace = await this.prisma.externalWorkplace.findFirst({
      where: { id: workplaceId, status: RecordStatus.active },
      select: { id: true, code: true, name: true },
    });

    if (!workplace) {
      throw new BadRequestException("Active external workplace is required.");
    }

    const actualLessons = await this.prisma.externalWorkLesson.findMany({
      where: {
        workplaceId,
        yearMonth,
        lessonType: ExternalWorkLessonType.actual,
        status: ExternalWorkLessonStatus.completed,
      },
      orderBy: [{ lessonDate: "asc" }, { startTime: "asc" }],
      select: lessonSelect,
    });

    const lessonWageJpy = this.confirmJpy(
      actualLessons.reduce((sum, lesson) => sum + lesson.lessonWageJpy, 0),
    );
    const transportationFeeJpy = this.confirmJpy(
      actualLessons.reduce((sum, lesson) => sum + lesson.transportationFeeJpy, 0),
    );
    const totalLessonHours = new Prisma.Decimal(
      actualLessons.reduce((sum, lesson) => sum + lesson.durationHours.toNumber(), 0),
    )
      .toDecimalPlaces(2)
      .toNumber();
    const totalAmountJpy = this.confirmJpy(
      lessonWageJpy + transportationFeeJpy + adjustmentAmountJpy,
    );

    return {
      workplace,
      workplaceId,
      yearMonth,
      lessonCount: actualLessons.length,
      totalLessonHours,
      lessonWageJpy,
      transportationFeeJpy,
      adjustmentAmountJpy,
      totalAmountJpy,
      details: actualLessons.map((lesson) => ({
        actualLessonId: lesson.id,
        lessonDate: lesson.lessonDate.toISOString().slice(0, 10),
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        durationHours: lesson.durationHours.toNumber(),
        instructorNameSnapshot: lesson.instructorName,
        lessonTitleSnapshot: lesson.lessonTitle,
        hourlyRateJpy: lesson.hourlyRateJpy,
        lessonWageJpy: lesson.lessonWageJpy,
        transportationFeeJpy: lesson.transportationFeeJpy,
        contentSnapshot: lesson.content,
      })),
      sourceActualLessonIds: actualLessons.map((lesson) => lesson.id),
      blockingIssues:
        actualLessons.length === 0
          ? ["No completed external actual lessons exist for this workplace/month."]
          : [],
      calculationPolicy: {
        source: "external_work_actual_lessons",
        totalFormula:
          "sum(lesson_wage_jpy) + sum(transportation_fee_jpy) + adjustment_amount_jpy",
        jpyPrecision: 0,
      },
    };
  }

  private buildSettlementExportPayload(settlement: SettlementSnapshot) {
    return {
      kind: "external_work_settlement_export",
      settlementId: settlement.id,
      workplace: settlement.workplace,
      yearMonth: settlement.yearMonth,
      status: settlement.status,
      lockedAt: settlement.lockedAt.toISOString(),
      incomeRecord: settlement.incomeRecord,
      summary: {
        lessonCount: settlement.lessonCount,
        totalLessonHours: settlement.totalLessonHours.toNumber(),
        lessonWageJpy: settlement.lessonWageJpy,
        transportationFeeJpy: settlement.transportationFeeJpy,
        adjustmentAmountJpy: settlement.adjustmentAmountJpy,
        totalAmountJpy: settlement.totalAmountJpy,
      },
      rows: settlement.details.map((detail, index) => ({
        rowNo: index + 1,
        detailId: detail.id,
        actualLessonId: detail.actualLessonId,
        lessonDate: detail.lessonDate.toISOString().slice(0, 10),
        startTime: detail.startTime,
        endTime: detail.endTime,
        durationHours: detail.durationHours.toNumber(),
        instructorName: detail.instructorNameSnapshot,
        lessonTitle: detail.lessonTitleSnapshot,
        hourlyRateJpy: detail.hourlyRateJpy,
        lessonWageJpy: detail.lessonWageJpy,
        transportationFeeJpy: detail.transportationFeeJpy,
        content: detail.contentSnapshot,
      })),
      calculationSnapshot: settlement.calculationSnapshot,
      policy: {
        source: "locked_external_work_settlement_details",
        lessonRowsAreReadonly: true,
        fileRendering: "not_generated_by_this_api",
        jpyPrecision: 0,
      },
    };
  }

  private async assertSettlementOpen(workplaceId: string, yearMonth: string) {
    const settlement = await this.prisma.externalWorkMonthlySettlement.findUnique({
      where: { workplaceId_yearMonth: { workplaceId, yearMonth } },
      select: { id: true, status: true },
    });

    if (
      settlement &&
      settlement.status !== ExternalWorkSettlementStatus.revoked
    ) {
      throw new BadRequestException(
        "External work settlement is locked for this workplace/month.",
      );
    }
  }

  private async findLesson(id: string): Promise<LessonSnapshot> {
    const lesson = await this.prisma.externalWorkLesson.findUnique({
      where: { id },
      select: lessonSelect,
    });

    if (!lesson) {
      throw new NotFoundException("External work lesson not found.");
    }

    return lesson;
  }

  private async findSettlement(id: string): Promise<SettlementSnapshot> {
    const settlement = await this.prisma.externalWorkMonthlySettlement.findUnique({
      where: { id },
      select: settlementSelect,
    });

    if (!settlement) {
      throw new NotFoundException("External work settlement not found.");
    }

    return settlement;
  }

  private async normalizeLessonInput(
    body: ExternalWorkLessonBody,
    current?: LessonSnapshot,
  ): Promise<NormalizedLessonInput> {
    const workplaceId =
      body.workplaceId === undefined && current
        ? current.workplaceId
        : this.normalizeRequiredString(body.workplaceId, "workplaceId");
    await this.assertActiveWorkplace(workplaceId);
    const lessonDate =
      body.lessonDate === undefined && current
        ? current.lessonDate
        : this.normalizeDate(body.lessonDate, "lessonDate");
    const startTime =
      body.startTime === undefined && current
        ? current.startTime
        : this.normalizeTime(body.startTime, "startTime");
    const endTime =
      body.endTime === undefined && current
        ? current.endTime
        : this.normalizeTime(body.endTime, "endTime");
    const durationHours =
      body.durationHours === undefined
        ? current
          ? current.durationHours.toNumber()
          : this.calculateDurationHours(startTime, endTime)
        : this.normalizeHours(body.durationHours, "durationHours");
    const hourlyRateJpy =
      body.hourlyRateJpy === undefined && current
        ? current.hourlyRateJpy
        : this.normalizeJpyAmount(body.hourlyRateJpy, "hourlyRateJpy");
    const transportationFeeJpy =
      body.transportationFeeJpy === undefined
        ? current?.transportationFeeJpy ?? 0
        : this.normalizeJpyAmount(body.transportationFeeJpy, "transportationFeeJpy");

    return {
      workplaceId,
      yearMonth: this.toYearMonth(lessonDate),
      lessonDate,
      startTime,
      endTime,
      durationHours,
      instructorName:
        body.instructorName === undefined && current
          ? current.instructorName
          : this.normalizeRequiredString(body.instructorName, "instructorName"),
      lessonTitle:
        body.lessonTitle === undefined && current
          ? current.lessonTitle
          : this.normalizeOptionalString(body.lessonTitle),
      hourlyRateJpy,
      transportationFeeJpy,
      lessonWageJpy: this.confirmJpy(durationHours * hourlyRateJpy),
      content:
        body.content === undefined && current
          ? current.content
          : this.normalizeOptionalString(body.content),
      memo:
        body.memo === undefined && current
          ? current.memo
          : this.normalizeOptionalString(body.memo),
      sourceType:
        body.sourceType === undefined && current
          ? current.sourceType
          : (this.normalizeOptionalString(body.sourceType)?.toLowerCase() ??
            "manual"),
      sourceId:
        body.sourceId === undefined && current
          ? current.sourceId
          : this.normalizeOptionalString(body.sourceId),
    };
  }

  private async assertActiveWorkplace(workplaceId: string) {
    const workplace = await this.prisma.externalWorkplace.findFirst({
      where: { id: workplaceId, status: RecordStatus.active },
      select: { id: true },
    });

    if (!workplace) {
      throw new BadRequestException("Active external workplace is required.");
    }
  }

  private buildLessonWhere(
    query: ListExternalWorkLessonsQuery,
  ): Prisma.ExternalWorkLessonWhereInput {
    const workplaceId = this.normalizeOptionalString(query.workplaceId);
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const lessonType = this.normalizeLessonType(query.lessonType);
    const status = this.normalizeLessonStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(workplaceId ? { workplaceId } : {}),
      ...(yearMonth ? { yearMonth } : {}),
      ...(lessonType ? { lessonType } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { instructorName: { contains: keyword, mode: "insensitive" } },
              { lessonTitle: { contains: keyword, mode: "insensitive" } },
              { content: { contains: keyword, mode: "insensitive" } },
              { workplace: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private buildSettlementWhere(
    query: ListExternalWorkSettlementsQuery,
  ): Prisma.ExternalWorkMonthlySettlementWhereInput {
    const workplaceId = this.normalizeOptionalString(query.workplaceId);
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const status = this.normalizeSettlementStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(workplaceId ? { workplaceId } : {}),
      ...(yearMonth ? { yearMonth } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? { workplace: { name: { contains: keyword, mode: "insensitive" } } }
        : {}),
    };
  }

  private normalizeLessonType(value: unknown) {
    const lessonType = this.normalizeOptionalString(value);

    if (
      lessonType &&
      Object.values(ExternalWorkLessonType).includes(
        lessonType as ExternalWorkLessonType,
      )
    ) {
      return lessonType as ExternalWorkLessonType;
    }

    return undefined;
  }

  private normalizeLessonStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(ExternalWorkLessonStatus).includes(
        status as ExternalWorkLessonStatus,
      )
    ) {
      return status as ExternalWorkLessonStatus;
    }

    return undefined;
  }

  private normalizeSettlementStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(ExternalWorkSettlementStatus).includes(
        status as ExternalWorkSettlementStatus,
      )
    ) {
      return status as ExternalWorkSettlementStatus;
    }

    return undefined;
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

    return new Date(`${value}T00:00:00.000Z`);
  }

  private normalizeTime(value: unknown, field: string) {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException(`${field} must be HH:mm.`);
    }

    return value;
  }

  private calculateDurationHours(startTime: string, endTime: string) {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);

    if (minutes <= 0) {
      throw new BadRequestException("endTime must be after startTime.");
    }

    return new Prisma.Decimal(minutes).div(60).toDecimalPlaces(2).toNumber();
  }

  private normalizeHours(value: unknown, field: string) {
    const numeric = this.normalizeNumber(value, field);

    if (numeric <= 0) {
      throw new BadRequestException(`${field} must be greater than 0.`);
    }

    return new Prisma.Decimal(numeric).toDecimalPlaces(2).toNumber();
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

  private normalizeRequiredString(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required.`);
    }

    return value.trim();
  }

  private normalizeOptionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private toYearMonth(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}`;
  }

  private confirmJpy(amount: number) {
    return this.moneyService.confirmAmount({
      amount,
      currency: "JPY",
    });
  }
}
