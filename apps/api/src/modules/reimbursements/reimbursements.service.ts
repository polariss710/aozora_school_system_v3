import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountTransactionDirection,
  AccountTransactionStatus,
  AccountType,
  AuditRiskLevel,
  CashRequestStatus,
  CurrencyCode,
  ExpenseRecordStatus,
  Prisma,
  RecordStatus,
  ReimbursementStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import {
  CreateReimbursementBody,
  ListReimbursementCandidateExpensesQuery,
  ListReimbursementsQuery,
  VoidReimbursementBody,
} from "./reimbursements.types";

const defaultLimit = 100;
const maxLimit = 500;
const reimbursementSourceType = "reimbursement_record";

const reimbursementSelect = {
  id: true,
  expenseRecordId: true,
  corporateAccountId: true,
  advanceAccountId: true,
  corporateTransactionId: true,
  advanceTransactionId: true,
  reimbursementDate: true,
  currency: true,
  amountJpy: true,
  amountCny: true,
  status: true,
  memo: true,
  voidedAt: true,
  createdAt: true,
  updatedAt: true,
  expenseRecord: {
    select: {
      id: true,
      sourceType: true,
      title: true,
      originalCurrency: true,
      recordStatus: true,
      cashStatus: true,
    },
  },
  corporateAccount: { select: { id: true, code: true, name: true, type: true, currency: true } },
  advanceAccount: { select: { id: true, code: true, name: true, type: true, currency: true } },
  corporateTransaction: {
    select: {
      id: true,
      direction: true,
      currency: true,
      amountJpy: true,
      amountCny: true,
      status: true,
    },
  },
  advanceTransaction: {
    select: {
      id: true,
      direction: true,
      currency: true,
      amountJpy: true,
      amountCny: true,
      status: true,
    },
  },
} satisfies Prisma.ReimbursementRecordSelect;

const expenseForReimbursementSelect = {
  id: true,
  sourceType: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  memo: true,
  accountTransactions: {
    where: {
      direction: AccountTransactionDirection.out,
      status: AccountTransactionStatus.active,
      account: {
        type: AccountType.advance,
        status: RecordStatus.active,
      },
    },
    select: {
      id: true,
      accountId: true,
      direction: true,
      currency: true,
      amountJpy: true,
      amountCny: true,
      status: true,
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          currency: true,
          status: true,
        },
      },
    },
  },
  reimbursementRecord: { select: { id: true, status: true } },
} satisfies Prisma.ExpenseRecordSelect;

type ExpenseForReimbursement = Prisma.ExpenseRecordGetPayload<{
  select: typeof expenseForReimbursementSelect;
}>;

@Injectable()
export class ReimbursementsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listReimbursements(query: ListReimbursementsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.reimbursementRecord.findMany({
        where,
        orderBy: [{ reimbursementDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: reimbursementSelect,
      }),
      this.prisma.reimbursementRecord.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getReimbursement(id: string) {
    const reimbursement = await this.findReimbursement(id);

    return { reimbursement };
  }

  async listCandidateExpenses(query: ListReimbursementCandidateExpensesQuery) {
    const keyword = this.normalizeOptionalString(query.keyword);
    const limit = this.normalizeLimit(query.limit);
    const where: Prisma.ExpenseRecordWhereInput = {
      recordStatus: ExpenseRecordStatus.pending,
      cashStatus: CashRequestStatus.account_transaction_created,
      reimbursementRecord: null,
      accountTransactions: {
        some: {
          direction: AccountTransactionDirection.out,
          status: AccountTransactionStatus.active,
          account: {
            type: AccountType.advance,
            status: RecordStatus.active,
          },
        },
      },
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { businessEntity: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.expenseRecord.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: expenseForReimbursementSelect,
      }),
      this.prisma.expenseRecord.count({ where }),
    ]);

    return { items, total, limit };
  }

  async createFromExpense(
    expenseRecordId: string,
    body: CreateReimbursementBody,
    actorUserId: string,
  ) {
    const expenseRecord = await this.findExpenseForReimbursement(expenseRecordId);
    const advanceTransaction = this.resolveAdvanceExpenseTransaction(expenseRecord);
    const corporateAccount = await this.findActiveCorporateAccount(body.corporateAccountId);
    const reimbursementDate = this.normalizeDate(body.reimbursementDate, "reimbursementDate");
    const memo = this.normalizeOptionalString(body.memo);

    if (corporateAccount.currency !== advanceTransaction.currency) {
      throw new BadRequestException(
        "Corporate account currency must match advance expense transaction currency.",
      );
    }

    const amount = this.resolveTransactionAmount(advanceTransaction);
    const reimbursementId = randomUUID();

    const reimbursement = await this.prisma.$transaction(async (tx) => {
      const corporateTransaction = await tx.accountTransaction.create({
        data: {
          accountId: corporateAccount.id,
          direction: AccountTransactionDirection.out,
          sourceType: reimbursementSourceType,
          sourceId: reimbursementId,
          incomeRecordId: null,
          expenseRecordId: null,
          transactionDate: reimbursementDate,
          title: `报销 ${expenseRecord.title}`,
          currency: advanceTransaction.currency,
          amountJpy: advanceTransaction.currency === CurrencyCode.JPY ? amount : null,
          amountCny:
            advanceTransaction.currency === CurrencyCode.CNY
              ? new Prisma.Decimal(amount)
              : null,
          status: AccountTransactionStatus.active,
          memo: memo ?? expenseRecord.memo,
        },
        select: { id: true },
      });

      const advanceReimbursementTransaction = await tx.accountTransaction.create({
        data: {
          accountId: advanceTransaction.accountId,
          direction: AccountTransactionDirection.in,
          sourceType: reimbursementSourceType,
          sourceId: reimbursementId,
          incomeRecordId: null,
          expenseRecordId: null,
          transactionDate: reimbursementDate,
          title: `报销 ${expenseRecord.title}`,
          currency: advanceTransaction.currency,
          amountJpy: advanceTransaction.currency === CurrencyCode.JPY ? amount : null,
          amountCny:
            advanceTransaction.currency === CurrencyCode.CNY
              ? new Prisma.Decimal(amount)
              : null,
          status: AccountTransactionStatus.active,
          memo: memo ?? expenseRecord.memo,
        },
        select: { id: true },
      });

      const created = await tx.reimbursementRecord.create({
        data: {
          id: reimbursementId,
          expenseRecordId: expenseRecord.id,
          corporateAccountId: corporateAccount.id,
          advanceAccountId: advanceTransaction.accountId,
          corporateTransactionId: corporateTransaction.id,
          advanceTransactionId: advanceReimbursementTransaction.id,
          reimbursementDate,
          currency: advanceTransaction.currency,
          amountJpy: advanceTransaction.currency === CurrencyCode.JPY ? amount : null,
          amountCny:
            advanceTransaction.currency === CurrencyCode.CNY
              ? new Prisma.Decimal(amount)
              : null,
          status: ReimbursementStatus.completed,
          memo,
        },
        select: reimbursementSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "reimbursement.create_from_expense",
          targetType: "reimbursement_record",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: expenseRecord,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { reimbursement };
  }

  async voidReimbursement(
    id: string,
    body: VoidReimbursementBody,
    actorUserId: string,
  ) {
    const before = await this.findReimbursement(id);

    if (before.status === ReimbursementStatus.voided) {
      return { reimbursement: before, idempotent: true };
    }

    if (before.status !== ReimbursementStatus.completed) {
      throw new BadRequestException("Only completed reimbursement can be voided.");
    }

    this.assertReimbursementTransactionsActive(before);

    const memo = this.normalizeOptionalString(body.memo) ?? before.memo;

    const reimbursement = await this.prisma.$transaction(async (tx) => {
      await tx.accountTransaction.updateMany({
        where: {
          id: {
            in: [before.corporateTransactionId, before.advanceTransactionId],
          },
          status: AccountTransactionStatus.active,
        },
        data: {
          status: AccountTransactionStatus.reversed,
          reversedAt: new Date(),
        },
      });

      const updated = await tx.reimbursementRecord.update({
        where: { id },
        data: {
          status: ReimbursementStatus.voided,
          voidedAt: new Date(),
          memo,
        },
        select: reimbursementSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "reimbursement.void",
          targetType: "reimbursement_record",
          targetId: id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { reimbursement, idempotent: false };
  }

  private async findReimbursement(id: string) {
    const reimbursement = await this.prisma.reimbursementRecord.findUnique({
      where: { id },
      select: reimbursementSelect,
    });

    if (!reimbursement) {
      throw new NotFoundException("Reimbursement record not found.");
    }

    return reimbursement;
  }

  private assertReimbursementTransactionsActive(
    reimbursement: Awaited<ReturnType<ReimbursementsService["findReimbursement"]>>,
  ) {
    if (
      reimbursement.corporateTransaction.status !== AccountTransactionStatus.active ||
      reimbursement.advanceTransaction.status !== AccountTransactionStatus.active
    ) {
      throw new BadRequestException(
        "Reimbursement account transactions are not active.",
      );
    }
  }

  private async findExpenseForReimbursement(
    id: string,
  ): Promise<ExpenseForReimbursement> {
    const expenseRecord = await this.prisma.expenseRecord.findUnique({
      where: { id },
      select: expenseForReimbursementSelect,
    });

    if (!expenseRecord) {
      throw new NotFoundException("Expense record not found.");
    }

    return expenseRecord;
  }

  private resolveAdvanceExpenseTransaction(expenseRecord: ExpenseForReimbursement) {
    if (expenseRecord.recordStatus !== ExpenseRecordStatus.pending) {
      throw new BadRequestException("Only pending expense can be reimbursed.");
    }

    if (expenseRecord.cashStatus !== CashRequestStatus.account_transaction_created) {
      throw new BadRequestException(
        "Expense must have an advance account transaction before reimbursement.",
      );
    }

    if (expenseRecord.reimbursementRecord?.status === ReimbursementStatus.completed) {
      throw new BadRequestException("Expense already has reimbursement.");
    }

    const advanceTransactions = expenseRecord.accountTransactions.filter(
      (transaction) =>
        transaction.account.type === AccountType.advance &&
        transaction.account.status === RecordStatus.active,
    );

    if (advanceTransactions.length !== 1) {
      throw new BadRequestException(
        "Expense must have exactly one active advance account out transaction.",
      );
    }

    const [advanceTransaction] = advanceTransactions;

    if (advanceTransaction.account.currency !== advanceTransaction.currency) {
      throw new BadRequestException("Advance account currency is inconsistent.");
    }

    return advanceTransaction;
  }

  private async findActiveCorporateAccount(value: unknown) {
    const id = this.normalizeRequiredString(value, "corporateAccountId");
    const account = await this.prisma.account.findFirst({
      where: { id, type: AccountType.corporate, status: RecordStatus.active },
      select: { id: true, code: true, name: true, type: true, currency: true },
    });

    if (!account) {
      throw new BadRequestException("Active corporate account is required.");
    }

    return account;
  }

  private resolveTransactionAmount(transaction: {
    currency: CurrencyCode;
    amountJpy: number | null;
    amountCny: Prisma.Decimal | null;
  }) {
    if (transaction.currency === CurrencyCode.JPY) {
      if (transaction.amountJpy === null) {
        throw new BadRequestException("JPY reimbursement amount is missing.");
      }

      return transaction.amountJpy;
    }

    if (transaction.amountCny === null) {
      throw new BadRequestException("CNY reimbursement amount is missing.");
    }

    return transaction.amountCny.toNumber();
  }

  private buildWhere(query: ListReimbursementsQuery): Prisma.ReimbursementRecordWhereInput {
    const status = this.normalizeStatus(query.status);
    const corporateAccountId = this.normalizeOptionalString(query.corporateAccountId);
    const advanceAccountId = this.normalizeOptionalString(query.advanceAccountId);
    const expenseRecordId = this.normalizeOptionalString(query.expenseRecordId);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(corporateAccountId ? { corporateAccountId } : {}),
      ...(advanceAccountId ? { advanceAccountId } : {}),
      ...(expenseRecordId ? { expenseRecordId } : {}),
      ...(keyword
        ? {
            OR: [
              { memo: { contains: keyword, mode: "insensitive" } },
              { expenseRecord: { title: { contains: keyword, mode: "insensitive" } } },
              { corporateAccount: { name: { contains: keyword, mode: "insensitive" } } },
              { advanceAccount: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(ReimbursementStatus).includes(status as ReimbursementStatus)) {
      return status as ReimbursementStatus;
    }

    return undefined;
  }

  private normalizeDate(value: unknown, field: string) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${field} must be YYYY-MM-DD.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid.`);
    }

    return date;
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
