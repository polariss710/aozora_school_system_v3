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
  ExternalWorkSettlementStatus,
  IncomeRecordStatus,
  Prisma,
  RecordStatus,
  TuitionBillStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { ListIncomeRecordsQuery, ManualIncomeBody } from "./income.types";

const defaultLimit = 100;
const maxLimit = 500;
const manualIncomeSourceType = "manual_income";
const tuitionBillSourceType = "student_tuition_bill";
const externalWorkSourceType = "external_work";

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
  createdAt: true,
  updatedAt: true,
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
  tuitionBill: {
    select: {
      id: true,
      status: true,
      plannedAmountJpy: true,
      carryoverAmountCny: true,
    },
  },
} satisfies Prisma.IncomeRecordSelect;

type IncomeRecordSnapshot = Prisma.IncomeRecordGetPayload<{
  select: typeof incomeRecordSelect;
}>;

@Injectable()
export class IncomeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listIncomeRecords(query: ListIncomeRecordsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.incomeRecord.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: incomeRecordSelect,
      }),
      this.prisma.incomeRecord.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getIncomeRecord(id: string) {
    const incomeRecord = await this.findIncomeRecord(id);

    return { incomeRecord };
  }

  async createManualIncome(body: ManualIncomeBody, actorUserId: string) {
    const input = await this.normalizeManualIncome(body);

    const incomeRecord = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incomeRecord.create({
        data: {
          ...input,
          sourceType: manualIncomeSourceType,
          sourceId: null,
          carryoverAmountCny: null,
          recordStatus: IncomeRecordStatus.pending,
          cashStatus: CashRequestStatus.not_requested,
        },
        select: incomeRecordSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "income_record.create_manual",
          targetType: "income_record",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { incomeRecord };
  }

  async voidIncomeRecord(id: string, actorUserId: string) {
    const before = await this.findIncomeRecord(id);

    if (before.recordStatus !== IncomeRecordStatus.pending) {
      throw new BadRequestException("Only pending income can be voided.");
    }

    if (before.cashStatus !== CashRequestStatus.not_requested) {
      throw new BadRequestException("Income with Cash request cannot be voided.");
    }

    const incomeRecord = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incomeRecord.update({
        where: { id },
        data: { recordStatus: IncomeRecordStatus.voided },
        select: incomeRecordSelect,
      });

      if (
        before.sourceType === tuitionBillSourceType &&
        before.sourceId &&
        before.tuitionBill
      ) {
        await tx.studentTuitionBill.update({
          where: { id: before.sourceId },
          data: {
            status: TuitionBillStatus.generated,
            incomeRecordId: null,
          },
        });
      }

      if (before.sourceType === externalWorkSourceType && before.sourceId) {
        await tx.externalWorkMonthlySettlement.update({
          where: { id: before.sourceId },
          data: {
            status: ExternalWorkSettlementStatus.locked,
            incomeRecordId: null,
          },
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "income_record.void",
          targetType: "income_record",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { incomeRecord };
  }

  private async findIncomeRecord(id: string): Promise<IncomeRecordSnapshot> {
    const incomeRecord = await this.prisma.incomeRecord.findUnique({
      where: { id },
      select: incomeRecordSelect,
    });

    if (!incomeRecord) {
      throw new NotFoundException("Income record not found.");
    }

    return incomeRecord;
  }

  private async normalizeManualIncome(body: ManualIncomeBody) {
    const originalCurrency = this.normalizeCurrency(body.originalCurrency);
    const studentId = this.normalizeOptionalString(body.studentId);
    const businessEntityId = this.normalizeOptionalString(body.businessEntityId);

    if (studentId) {
      await this.assertActiveStudent(studentId);
    }

    if (businessEntityId) {
      await this.assertActiveBusinessEntity(businessEntityId);
    }

    return {
      studentId,
      businessEntityId,
      yearMonth: this.normalizeOptionalYearMonth(body.yearMonth),
      title: this.normalizeRequiredString(body.title, "title"),
      originalCurrency,
      originalAmountJpy:
        originalCurrency === CurrencyCode.JPY
          ? this.normalizeJpyAmount(body.originalAmountJpy, "originalAmountJpy")
          : null,
      originalAmountCny:
        originalCurrency === CurrencyCode.CNY
          ? new Prisma.Decimal(this.normalizeCnyAmount(body.originalAmountCny, "originalAmountCny"))
          : null,
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private async assertActiveStudent(studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, status: RecordStatus.active },
      select: { id: true },
    });

    if (!student) {
      throw new BadRequestException("Active student is required.");
    }
  }

  private async assertActiveBusinessEntity(businessEntityId: string) {
    const businessEntity = await this.prisma.businessEntity.findFirst({
      where: { id: businessEntityId, status: RecordStatus.active },
      select: { id: true },
    });

    if (!businessEntity) {
      throw new BadRequestException("Active business entity is required.");
    }
  }

  private buildWhere(query: ListIncomeRecordsQuery): Prisma.IncomeRecordWhereInput {
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const studentId = this.normalizeOptionalString(query.studentId);
    const businessEntityId = this.normalizeOptionalString(query.businessEntityId);
    const recordStatus = this.normalizeRecordStatus(query.recordStatus);
    const cashStatus = this.normalizeCashStatus(query.cashStatus);
    const sourceType = this.normalizeOptionalString(query.sourceType);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(yearMonth ? { yearMonth } : {}),
      ...(studentId ? { studentId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
      ...(recordStatus ? { recordStatus } : {}),
      ...(cashStatus ? { cashStatus } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { student: { name: { contains: keyword, mode: "insensitive" } } },
              { businessEntity: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeRecordStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(IncomeRecordStatus).includes(status as IncomeRecordStatus)
    ) {
      return status as IncomeRecordStatus;
    }

    return undefined;
  }

  private normalizeCashStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(CashRequestStatus).includes(status as CashRequestStatus)) {
      return status as CashRequestStatus;
    }

    return undefined;
  }

  private normalizeCurrency(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("originalCurrency is required.");
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException("Invalid currency.");
    }

    return value as CurrencyCode;
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

  private normalizeOptionalYearMonth(value: unknown) {
    const yearMonth = this.normalizeOptionalString(value);

    if (!yearMonth) {
      return null;
    }

    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new BadRequestException("yearMonth must be YYYY-MM.");
    }

    return yearMonth;
  }

  private normalizeJpyAmount(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseInt(String(value), 10);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative integer.`);
    }

    return parsed;
  }

  private normalizeCnyAmount(value: unknown, field: string) {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} must be a non-negative number.`);
    }

    return this.moneyService.confirmAmount({
      amount: parsed,
      currency: "CNY",
    });
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
