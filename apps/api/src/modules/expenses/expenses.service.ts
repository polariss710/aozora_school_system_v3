import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountTransactionStatus,
  AuditRiskLevel,
  CashRequestStatus,
  CurrencyCode,
  ExpenseRecordStatus,
  Prisma,
  RecordStatus,
  TeacherWageAdjustmentStatus,
  TeacherWageSnapshotStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  CreateExpenseFromWageBody,
  ListExpenseRecordsQuery,
  ManualExpenseBody,
  VoidExpenseRecordBody,
} from "./expenses.types";

const defaultLimit = 100;
const maxLimit = 500;
const teacherWageSourceType = "teacher_wage_snapshot";
const manualExpenseSourceType = "manual_expense";

const expenseRecordSelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  teacherId: true,
  businessEntityId: true,
  yearMonth: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, code: true, name: true } },
  businessEntity: { select: { id: true, code: true, name: true } },
  wageSnapshot: {
    select: {
      id: true,
      status: true,
      adjustmentStatus: true,
      totalWageJpy: true,
    },
  },
} satisfies Prisma.ExpenseRecordSelect;

const wageSnapshotSelect = {
  id: true,
  teacherId: true,
  yearMonth: true,
  businessEntityId: true,
  totalWageJpy: true,
  status: true,
  adjustmentStatus: true,
  expenseRecordId: true,
  memo: true,
  teacher: { select: { id: true, code: true, name: true } },
  businessEntity: { select: { id: true, code: true, name: true } },
} satisfies Prisma.TeacherWageSnapshotSelect;

type ExpenseRecordSnapshot = Prisma.ExpenseRecordGetPayload<{
  select: typeof expenseRecordSelect;
}>;

type WageSnapshot = Prisma.TeacherWageSnapshotGetPayload<{
  select: typeof wageSnapshotSelect;
}>;

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listExpenseRecords(query: ListExpenseRecordsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.expenseRecord.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: expenseRecordSelect,
      }),
      this.prisma.expenseRecord.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getExpenseRecord(id: string) {
    const expenseRecord = await this.findExpenseRecord(id);

    return { expenseRecord };
  }

  async createManualExpense(body: ManualExpenseBody, actorUserId: string) {
    const input = await this.normalizeManualExpense(body);

    const expenseRecord = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expenseRecord.create({
        data: {
          ...input,
          sourceType: manualExpenseSourceType,
          sourceId: null,
          teacherId: null,
          recordStatus: ExpenseRecordStatus.pending,
          cashStatus: CashRequestStatus.not_requested,
        },
        select: expenseRecordSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "expense_record.create_manual",
          targetType: "expense_record",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { expenseRecord };
  }

  async createFromWageSnapshot(
    snapshotId: string,
    body: CreateExpenseFromWageBody,
    actorUserId: string,
  ) {
    const wageSnapshot = await this.findWageSnapshot(snapshotId);
    this.assertWageSnapshotCanGenerateExpense(wageSnapshot);

    const memo = this.normalizeOptionalString(body.memo);
    const amountJpy = this.moneyService.confirmAmount({
      amount: wageSnapshot.totalWageJpy,
      currency: CurrencyCode.JPY,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const expenseRecord = await tx.expenseRecord.create({
        data: {
          sourceType: teacherWageSourceType,
          sourceId: wageSnapshot.id,
          teacherId: wageSnapshot.teacherId,
          businessEntityId: wageSnapshot.businessEntityId,
          yearMonth: wageSnapshot.yearMonth,
          title: `${wageSnapshot.yearMonth} ${wageSnapshot.teacher.name} 老师工资`,
          originalCurrency: CurrencyCode.JPY,
          originalAmountJpy: amountJpy,
          originalAmountCny: null,
          recordStatus: ExpenseRecordStatus.pending,
          cashStatus: CashRequestStatus.not_requested,
          memo: memo ?? wageSnapshot.memo,
        },
        select: expenseRecordSelect,
      });

      const updatedSnapshot = await tx.teacherWageSnapshot.update({
        where: { id: wageSnapshot.id },
        data: {
          status: TeacherWageSnapshotStatus.expense_created,
          expenseRecordId: expenseRecord.id,
        },
        select: wageSnapshotSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "expense_record.create_from_teacher_wage",
          targetType: "expense_record",
          targetId: expenseRecord.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: wageSnapshot,
          afterSnapshot: { expenseRecord, wageSnapshot: updatedSnapshot },
        },
        tx,
      );

      return { expenseRecord, wageSnapshot: updatedSnapshot };
    });

    return result;
  }

  async voidExpenseRecord(
    id: string,
    body: VoidExpenseRecordBody,
    actorUserId: string,
  ) {
    const before = await this.findExpenseRecord(id);

    if (before.recordStatus !== ExpenseRecordStatus.pending) {
      throw new BadRequestException("Only pending expense can be voided.");
    }

    this.assertExpenseCanBeVoided(before);

    if (
      before.sourceType === teacherWageSourceType &&
      before.cashStatus === CashRequestStatus.cash_rejected
    ) {
      const transactionCount = await this.prisma.accountTransaction.count({
        where: { expenseRecordId: id },
      });

      if (transactionCount > 0) {
        throw new BadRequestException(
          "Rejected teacher wage expense with account transaction cannot be voided.",
        );
      }
    }

    const shouldReverseAccountTransaction =
      before.cashStatus === CashRequestStatus.account_transaction_created;

    if (
      shouldReverseAccountTransaction &&
      before.sourceType !== manualExpenseSourceType
    ) {
      throw new BadRequestException(
        "Only manual expense account transaction can be voided from expense.",
      );
    }

    const reason = this.normalizeOptionalString(body.reason);

    const result = await this.prisma.$transaction(async (tx) => {
      let reversedAccountTransactionIds: string[] = [];

      if (shouldReverseAccountTransaction) {
        const accountTransactions = await tx.accountTransaction.findMany({
          where: {
            expenseRecordId: id,
            status: AccountTransactionStatus.active,
          },
          select: { id: true },
        });

        if (accountTransactions.length === 0) {
          throw new BadRequestException(
            "Active account transaction is required before voiding expense.",
          );
        }

        reversedAccountTransactionIds = accountTransactions.map(
          (transaction) => transaction.id,
        );

        await tx.accountTransaction.updateMany({
          where: { id: { in: reversedAccountTransactionIds } },
          data: {
            status: AccountTransactionStatus.reversed,
            reversedAt: new Date(),
          },
        });
      }

      const expenseRecord = await tx.expenseRecord.update({
        where: { id },
        data: { recordStatus: ExpenseRecordStatus.voided },
        select: expenseRecordSelect,
      });

      let wageSnapshot: WageSnapshot | null = null;
      if (
        before.sourceType === teacherWageSourceType &&
        before.sourceId &&
        before.wageSnapshot
      ) {
        wageSnapshot = await tx.teacherWageSnapshot.update({
          where: { id: before.sourceId },
          data: {
            status: TeacherWageSnapshotStatus.adjustment_confirmed,
            expenseRecordId: null,
          },
          select: wageSnapshotSelect,
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "expense_record.void",
          targetType: "expense_record",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          reason,
          beforeSnapshot: before,
          afterSnapshot: {
            expenseRecord,
            wageSnapshot,
            reversedAccountTransactionIds,
          },
        },
        tx,
      );

      return { expenseRecord, wageSnapshot };
    });

    return result;
  }

  private assertExpenseCanBeVoided(expenseRecord: ExpenseRecordSnapshot) {
    if (
      expenseRecord.cashStatus === CashRequestStatus.not_requested ||
      expenseRecord.cashStatus === CashRequestStatus.cash_rejected ||
      expenseRecord.cashStatus === CashRequestStatus.cash_withdrawn ||
      expenseRecord.cashStatus === CashRequestStatus.account_transaction_created
    ) {
      return;
    }

    throw new BadRequestException("Expense downstream status does not allow void.");
  }

  private assertWageSnapshotCanGenerateExpense(wageSnapshot: WageSnapshot) {
    if (wageSnapshot.expenseRecordId) {
      throw new BadRequestException("Wage snapshot already generated expense.");
    }

    if (
      wageSnapshot.status !== TeacherWageSnapshotStatus.adjustment_confirmed ||
      wageSnapshot.adjustmentStatus !== TeacherWageAdjustmentStatus.confirmed
    ) {
      throw new BadRequestException(
        "Wage snapshot adjustments must be confirmed before generating expense.",
      );
    }
  }

  private async findExpenseRecord(
    id: string,
  ): Promise<ExpenseRecordSnapshot> {
    const expenseRecord = await this.prisma.expenseRecord.findUnique({
      where: { id },
      select: expenseRecordSelect,
    });

    if (!expenseRecord) {
      throw new NotFoundException("Expense record not found.");
    }

    return expenseRecord;
  }

  private async findWageSnapshot(id: string): Promise<WageSnapshot> {
    const wageSnapshot = await this.prisma.teacherWageSnapshot.findUnique({
      where: { id },
      select: wageSnapshotSelect,
    });

    if (!wageSnapshot) {
      throw new NotFoundException("Teacher wage snapshot not found.");
    }

    return wageSnapshot;
  }

  private async normalizeManualExpense(body: ManualExpenseBody) {
    const originalCurrency = this.normalizeCurrency(body.originalCurrency);
    const businessEntityId = this.normalizeOptionalString(body.businessEntityId);

    if (businessEntityId) {
      await this.assertActiveBusinessEntity(businessEntityId);
    }

    return {
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
          ? new Prisma.Decimal(
              this.normalizeCnyAmount(body.originalAmountCny, "originalAmountCny"),
            )
          : null,
      memo: this.normalizeOptionalString(body.memo),
    };
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

  private buildWhere(
    query: ListExpenseRecordsQuery,
  ): Prisma.ExpenseRecordWhereInput {
    const teacherId = this.normalizeOptionalString(query.teacherId);
    const businessEntityId = this.normalizeOptionalString(query.businessEntityId);
    const yearMonth = this.normalizeOptionalYearMonth(query.yearMonth);
    const sourceType = this.normalizeOptionalString(query.sourceType);
    const recordStatus = this.normalizeRecordStatus(query.recordStatus);
    const cashStatus = this.normalizeCashStatus(query.cashStatus);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(teacherId ? { teacherId } : {}),
      ...(businessEntityId ? { businessEntityId } : {}),
      ...(yearMonth ? { yearMonth } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(recordStatus ? { recordStatus } : {}),
      ...(cashStatus ? { cashStatus } : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" } },
              { teacher: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeRecordStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(ExpenseRecordStatus).includes(status as ExpenseRecordStatus)
    ) {
      return status as ExpenseRecordStatus;
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

  private normalizeCurrency(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("originalCurrency is required.");
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException("Invalid originalCurrency.");
    }

    return value as CurrencyCode;
  }

  private normalizeJpyAmount(value: unknown, field: string) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative number.`);
    }

    return this.moneyService.confirmAmount({
      amount: value,
      currency: CurrencyCode.JPY,
    });
  }

  private normalizeCnyAmount(value: unknown, field: string) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative number.`);
    }

    return this.moneyService.confirmAmount({
      amount: value,
      currency: CurrencyCode.CNY,
    });
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
}
