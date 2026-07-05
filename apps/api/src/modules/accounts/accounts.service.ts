import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountType,
  AccountTransactionDirection,
  AccountTransactionStatus,
  AccountTransferStatus,
  AuditRiskLevel,
  CashRequestStatus,
  CurrencyCode,
  ExpenseRecordStatus,
  IncomeRecordStatus,
  Prisma,
  RecordStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  AccountSnapshot,
  CreateAccountTransferBody,
  AccountWriteBody,
  CreateAccountTransactionFromExpenseBody,
  CreateAccountTransactionFromIncomeBody,
  ListAccountsQuery,
  ListAccountTransactionsQuery,
  ListAccountTransfersQuery,
  ManualAccountTransactionBody,
  NormalizedAccountTransferInput,
  NormalizedAccountInput,
  NormalizedManualAccountTransactionInput,
  ReverseAccountTransactionBody,
  VoidAccountTransferBody,
} from "./accounts.types";

const accountSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  currency: true,
  status: true,
  memo: true,
} satisfies Prisma.AccountSelect;

const accountTransactionSelect = {
  id: true,
  accountId: true,
  direction: true,
  sourceType: true,
  sourceId: true,
  incomeRecordId: true,
  expenseRecordId: true,
  transactionDate: true,
  title: true,
  currency: true,
  amountJpy: true,
  amountCny: true,
  status: true,
  idempotencyKey: true,
  externalEventId: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  reversedAt: true,
  account: { select: { id: true, code: true, name: true, type: true, currency: true } },
  incomeRecord: {
    select: { id: true, sourceType: true, title: true, recordStatus: true, cashStatus: true },
  },
  expenseRecord: {
    select: { id: true, sourceType: true, title: true, recordStatus: true, cashStatus: true },
  },
} satisfies Prisma.AccountTransactionSelect;

const accountTransferSelect = {
  id: true,
  fromAccountId: true,
  toAccountId: true,
  fromTransactionId: true,
  toTransactionId: true,
  transferDate: true,
  currency: true,
  amountJpy: true,
  amountCny: true,
  status: true,
  memo: true,
  voidedAt: true,
  createdAt: true,
  updatedAt: true,
  fromAccount: { select: { id: true, code: true, name: true, type: true, currency: true } },
  toAccount: { select: { id: true, code: true, name: true, type: true, currency: true } },
  fromTransaction: { select: accountTransactionSelect },
  toTransaction: { select: accountTransactionSelect },
} satisfies Prisma.AccountTransferSelect;

const incomeRecordForTransactionSelect = {
  id: true,
  sourceType: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  memo: true,
} satisfies Prisma.IncomeRecordSelect;

const expenseRecordForTransactionSelect = {
  id: true,
  sourceType: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  memo: true,
} satisfies Prisma.ExpenseRecordSelect;

const defaultLimit = 100;
const maxLimit = 500;
const manualAccountTransactionSourceType = "manual_account_transaction";
const accountCorrectionSourceType = "account_correction";
const accountTransferSourceType = "account_transfer";
const manualIncomeSourceType = "manual_income";
const manualExpenseSourceType = "manual_expense";

type AccountTransactionSnapshot = Prisma.AccountTransactionGetPayload<{
  select: typeof accountTransactionSelect;
}>;

type AccountTransferSnapshot = Prisma.AccountTransferGetPayload<{
  select: typeof accountTransferSelect;
}>;

type IncomeRecordForTransaction = Prisma.IncomeRecordGetPayload<{
  select: typeof incomeRecordForTransactionSelect;
}>;

type ExpenseRecordForTransaction = Prisma.ExpenseRecordGetPayload<{
  select: typeof expenseRecordForTransactionSelect;
}>;

@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listAccounts(query: ListAccountsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: [{ status: "asc" }, { type: "asc" }, { name: "asc" }],
        take: limit,
        select: accountSelect,
      }),
      this.prisma.account.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getAccount(id: string) {
    const account = await this.findAccountSnapshot(id);

    return { account };
  }

  async listAccountTransactions(query: ListAccountTransactionsQuery) {
    const where = this.buildTransactionWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.accountTransaction.findMany({
        where,
        orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: accountTransactionSelect,
      }),
      this.prisma.accountTransaction.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getAccountTransaction(id: string) {
    const accountTransaction = await this.findAccountTransaction(id);

    return { accountTransaction };
  }

  async listAccountTransfers(query: ListAccountTransfersQuery) {
    const where = this.buildTransferWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.accountTransfer.findMany({
        where,
        orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: accountTransferSelect,
      }),
      this.prisma.accountTransfer.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getAccountTransfer(id: string) {
    const accountTransfer = await this.findAccountTransfer(id);

    return { accountTransfer };
  }

  async createManualAccountTransaction(
    body: ManualAccountTransactionBody,
    actorUserId: string,
  ) {
    const input = await this.normalizeManualAccountTransaction(body);

    const accountTransaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accountTransaction.create({
        data: {
          ...input,
          amountCny:
            input.amountCny === null ? null : new Prisma.Decimal(input.amountCny),
          incomeRecordId: null,
          expenseRecordId: null,
          status: AccountTransactionStatus.active,
        },
        select: accountTransactionSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account_transaction.create_manual",
          targetType: "account_transaction",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { accountTransaction };
  }

  async createAccountTransfer(
    body: CreateAccountTransferBody,
    actorUserId: string,
  ) {
    const input = await this.normalizeAccountTransfer(body);
    const existing = await this.findExistingTransferByIdempotencyKey(
      input.idempotencyKey,
    );

    if (existing) {
      return { accountTransfer: existing, idempotent: true };
    }

    const transferId = randomUUID();

    const accountTransfer = await this.prisma.$transaction(async (tx) => {
      const fromTransaction = await tx.accountTransaction.create({
        data: {
          accountId: input.fromAccountId,
          direction: AccountTransactionDirection.out,
          sourceType: accountTransferSourceType,
          sourceId: transferId,
          incomeRecordId: null,
          expenseRecordId: null,
          transactionDate: input.transferDate,
          title: "账户内部调拨",
          currency: input.currency,
          amountJpy: input.amountJpy,
          amountCny:
            input.amountCny === null ? null : new Prisma.Decimal(input.amountCny),
          status: AccountTransactionStatus.active,
          idempotencyKey: input.idempotencyKey
            ? `account-transfer:${input.idempotencyKey}:out`
            : null,
          memo: input.memo,
        },
        select: { id: true },
      });

      const toTransaction = await tx.accountTransaction.create({
        data: {
          accountId: input.toAccountId,
          direction: AccountTransactionDirection.in,
          sourceType: accountTransferSourceType,
          sourceId: transferId,
          incomeRecordId: null,
          expenseRecordId: null,
          transactionDate: input.transferDate,
          title: "账户内部调拨",
          currency: input.currency,
          amountJpy: input.amountJpy,
          amountCny:
            input.amountCny === null ? null : new Prisma.Decimal(input.amountCny),
          status: AccountTransactionStatus.active,
          idempotencyKey: input.idempotencyKey
            ? `account-transfer:${input.idempotencyKey}:in`
            : null,
          memo: input.memo,
        },
        select: { id: true },
      });

      const created = await tx.accountTransfer.create({
        data: {
          id: transferId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          fromTransactionId: fromTransaction.id,
          toTransactionId: toTransaction.id,
          transferDate: input.transferDate,
          currency: input.currency,
          amountJpy: input.amountJpy,
          amountCny:
            input.amountCny === null ? null : new Prisma.Decimal(input.amountCny),
          status: AccountTransferStatus.completed,
          memo: input.memo,
        },
        select: accountTransferSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account_transfer.create",
          targetType: "account_transfer",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { accountTransfer, idempotent: false };
  }

  async voidAccountTransfer(
    id: string,
    body: VoidAccountTransferBody,
    actorUserId: string,
  ) {
    const before = await this.findAccountTransfer(id);

    if (before.status !== AccountTransferStatus.completed) {
      throw new BadRequestException("Only completed transfer can be voided.");
    }

    const memo = this.normalizeOptionalString(body.memo) ?? before.memo;

    const accountTransfer = await this.prisma.$transaction(async (tx) => {
      await tx.accountTransaction.updateMany({
        where: {
          id: { in: [before.fromTransactionId, before.toTransactionId] },
          status: AccountTransactionStatus.active,
        },
        data: {
          status: AccountTransactionStatus.reversed,
          reversedAt: new Date(),
        },
      });

      const updated = await tx.accountTransfer.update({
        where: { id },
        data: {
          status: AccountTransferStatus.voided,
          voidedAt: new Date(),
          memo,
        },
        select: accountTransferSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account_transfer.void",
          targetType: "account_transfer",
          targetId: id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { accountTransfer };
  }

  async reverseAccountTransaction(
    id: string,
    body: ReverseAccountTransactionBody,
    actorUserId: string,
  ) {
    const before = await this.findAccountTransaction(id);
    this.assertAccountTransactionCanReverse(before);

    const memo = this.normalizeOptionalString(body.memo) ?? before.memo;

    const accountTransaction = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.accountTransaction.update({
        where: { id },
        data: {
          status: AccountTransactionStatus.reversed,
          reversedAt: new Date(),
          memo,
        },
        select: accountTransactionSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account_transaction.reverse",
          targetType: "account_transaction",
          targetId: id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { accountTransaction };
  }

  async createTransactionFromIncomeRecord(
    incomeRecordId: string,
    body: CreateAccountTransactionFromIncomeBody,
    actorUserId: string,
  ) {
    const incomeRecord = await this.findIncomeRecordForTransaction(incomeRecordId);
    this.assertIncomeCanCreateAccountTransaction(incomeRecord);
    const account = await this.findActiveAccountForTransaction(body.accountId);
    const transactionDate = this.normalizeDate(body.transactionDate, "transactionDate");
    const memo = this.normalizeOptionalString(body.memo);
    this.assertAccountCurrencyMatchesRecord(account, incomeRecord.originalCurrency);
    await this.assertNoAccountTransactionForRecord({ incomeRecordId });

    const result = await this.prisma.$transaction(async (tx) => {
      const accountTransaction = await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          direction: AccountTransactionDirection.in,
          sourceType: incomeRecord.sourceType,
          sourceId: incomeRecord.id,
          incomeRecordId: incomeRecord.id,
          expenseRecordId: null,
          transactionDate,
          title: incomeRecord.title,
          currency: incomeRecord.originalCurrency,
          amountJpy: incomeRecord.originalAmountJpy,
          amountCny: incomeRecord.originalAmountCny,
          status: AccountTransactionStatus.active,
          memo: memo ?? incomeRecord.memo,
        },
        select: accountTransactionSelect,
      });

      const updatedIncomeRecord = await tx.incomeRecord.update({
        where: { id: incomeRecord.id },
        data: { cashStatus: CashRequestStatus.account_transaction_created },
        select: incomeRecordForTransactionSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account_transaction.create_from_income",
          targetType: "account_transaction",
          targetId: accountTransaction.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: incomeRecord,
          afterSnapshot: { accountTransaction, incomeRecord: updatedIncomeRecord },
        },
        tx,
      );

      return { accountTransaction, incomeRecord: updatedIncomeRecord };
    });

    return result;
  }

  async createTransactionFromExpenseRecord(
    expenseRecordId: string,
    body: CreateAccountTransactionFromExpenseBody,
    actorUserId: string,
  ) {
    const expenseRecord = await this.findExpenseRecordForTransaction(expenseRecordId);
    this.assertExpenseCanCreateAccountTransaction(expenseRecord);
    const account = await this.findActiveAccountForTransaction(body.accountId);
    const transactionDate = this.normalizeDate(body.transactionDate, "transactionDate");
    const memo = this.normalizeOptionalString(body.memo);
    this.assertAccountCurrencyMatchesRecord(account, expenseRecord.originalCurrency);
    await this.assertNoAccountTransactionForRecord({ expenseRecordId });

    const result = await this.prisma.$transaction(async (tx) => {
      const accountTransaction = await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          direction: AccountTransactionDirection.out,
          sourceType: expenseRecord.sourceType,
          sourceId: expenseRecord.id,
          incomeRecordId: null,
          expenseRecordId: expenseRecord.id,
          transactionDate,
          title: expenseRecord.title,
          currency: expenseRecord.originalCurrency,
          amountJpy: expenseRecord.originalAmountJpy,
          amountCny: expenseRecord.originalAmountCny,
          status: AccountTransactionStatus.active,
          memo: memo ?? expenseRecord.memo,
        },
        select: accountTransactionSelect,
      });

      const updatedExpenseRecord = await tx.expenseRecord.update({
        where: { id: expenseRecord.id },
        data: { cashStatus: CashRequestStatus.account_transaction_created },
        select: expenseRecordForTransactionSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account_transaction.create_from_expense",
          targetType: "account_transaction",
          targetId: accountTransaction.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: expenseRecord,
          afterSnapshot: { accountTransaction, expenseRecord: updatedExpenseRecord },
        },
        tx,
      );

      return { accountTransaction, expenseRecord: updatedExpenseRecord };
    });

    return result;
  }

  async createAccount(body: AccountWriteBody, actorUserId: string) {
    const input = this.normalizeCreateInput(body);
    await this.assertCodeAvailable(input.code);

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: { ...input, status: RecordStatus.active },
        select: accountSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account.create",
          targetType: "account",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { account };
  }

  async updateAccount(id: string, body: AccountWriteBody, actorUserId: string) {
    const before = await this.findAccountSnapshot(id);
    const input = this.normalizeUpdateInput(body, before);

    if (input.code !== before.code) {
      await this.assertCodeAvailable(input.code, id);
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: input,
        select: accountSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "account.update",
          targetType: "account",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { account };
  }

  async archiveAccount(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.archived, actorUserId);
  }

  async restoreAccount(id: string, actorUserId: string) {
    return this.changeStatus(id, RecordStatus.active, actorUserId);
  }

  private async changeStatus(
    id: string,
    status: RecordStatus,
    actorUserId: string,
  ) {
    const before = await this.findAccountSnapshot(id);

    if (before.status === status) {
      return { account: before };
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: { status },
        select: accountSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action:
            status === RecordStatus.archived
              ? "account.archive"
              : "account.restore",
          targetType: "account",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { account };
  }

  private async findAccountSnapshot(id: string): Promise<AccountSnapshot> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: accountSelect,
    });

    if (!account) {
      throw new NotFoundException("Account not found.");
    }

    return account;
  }

  private async findAccountTransaction(
    id: string,
  ): Promise<AccountTransactionSnapshot> {
    const accountTransaction = await this.prisma.accountTransaction.findUnique({
      where: { id },
      select: accountTransactionSelect,
    });

    if (!accountTransaction) {
      throw new NotFoundException("Account transaction not found.");
    }

    return accountTransaction;
  }

  private async findAccountTransfer(id: string): Promise<AccountTransferSnapshot> {
    const accountTransfer = await this.prisma.accountTransfer.findUnique({
      where: { id },
      select: accountTransferSelect,
    });

    if (!accountTransfer) {
      throw new NotFoundException("Account transfer not found.");
    }

    return accountTransfer;
  }

  private async findExistingTransferByIdempotencyKey(
    idempotencyKey: string | null,
  ) {
    if (!idempotencyKey) {
      return null;
    }

    const transaction = await this.prisma.accountTransaction.findUnique({
      where: { idempotencyKey: `account-transfer:${idempotencyKey}:out` },
      select: { id: true },
    });

    if (!transaction) {
      return null;
    }

    return this.prisma.accountTransfer.findUnique({
      where: { fromTransactionId: transaction.id },
      select: accountTransferSelect,
    });
  }

  private async findActiveAccountForTransaction(accountId: unknown) {
    const id = this.normalizeRequiredString(accountId, "accountId");
    const account = await this.prisma.account.findFirst({
      where: { id, status: RecordStatus.active },
      select: accountSelect,
    });

    if (!account) {
      throw new BadRequestException("Active account is required.");
    }

    return account;
  }

  private async findIncomeRecordForTransaction(
    id: string,
  ): Promise<IncomeRecordForTransaction> {
    const incomeRecord = await this.prisma.incomeRecord.findUnique({
      where: { id },
      select: incomeRecordForTransactionSelect,
    });

    if (!incomeRecord) {
      throw new NotFoundException("Income record not found.");
    }

    return incomeRecord;
  }

  private async findExpenseRecordForTransaction(
    id: string,
  ): Promise<ExpenseRecordForTransaction> {
    const expenseRecord = await this.prisma.expenseRecord.findUnique({
      where: { id },
      select: expenseRecordForTransactionSelect,
    });

    if (!expenseRecord) {
      throw new NotFoundException("Expense record not found.");
    }

    return expenseRecord;
  }

  private assertIncomeCanCreateAccountTransaction(record: IncomeRecordForTransaction) {
    if (record.sourceType !== manualIncomeSourceType) {
      throw new BadRequestException(
        "Only manual income can create a direct account transaction.",
      );
    }

    if (record.recordStatus !== IncomeRecordStatus.pending) {
      throw new BadRequestException("Only pending income can create transaction.");
    }

    if (record.cashStatus !== CashRequestStatus.not_requested) {
      throw new BadRequestException(
        "Income with downstream status cannot create direct transaction.",
      );
    }
  }

  private assertExpenseCanCreateAccountTransaction(record: ExpenseRecordForTransaction) {
    if (record.sourceType !== manualExpenseSourceType) {
      throw new BadRequestException(
        "Only manual expense can create a direct account transaction.",
      );
    }

    if (record.recordStatus !== ExpenseRecordStatus.pending) {
      throw new BadRequestException("Only pending expense can create transaction.");
    }

    if (record.cashStatus !== CashRequestStatus.not_requested) {
      throw new BadRequestException(
        "Expense with downstream status cannot create direct transaction.",
      );
    }
  }

  private assertAccountCurrencyMatchesRecord(
    account: AccountSnapshot,
    currency: CurrencyCode,
  ) {
    if (account.currency !== currency) {
      throw new BadRequestException("Account currency must match record currency.");
    }
  }

  private async assertNoAccountTransactionForRecord(params: {
    incomeRecordId?: string;
    expenseRecordId?: string;
  }) {
    const existing = await this.prisma.accountTransaction.findFirst({
      where: {
        ...(params.incomeRecordId ? { incomeRecordId: params.incomeRecordId } : {}),
        ...(params.expenseRecordId ? { expenseRecordId: params.expenseRecordId } : {}),
        status: AccountTransactionStatus.active,
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("Account transaction already exists.");
    }
  }

  private assertAccountTransactionCanReverse(
    transaction: AccountTransactionSnapshot,
  ) {
    if (transaction.status !== AccountTransactionStatus.active) {
      throw new BadRequestException("Only active account transaction can be reversed.");
    }

    if (transaction.incomeRecordId || transaction.expenseRecordId) {
      throw new BadRequestException(
        "Income or expense account transaction must be reversed from its business chain.",
      );
    }

    if (transaction.sourceType === accountTransferSourceType) {
      throw new BadRequestException("Account transfer must be voided as a transfer.");
    }

    if (
      transaction.sourceType !== manualAccountTransactionSourceType &&
      transaction.sourceType !== accountCorrectionSourceType
    ) {
      throw new BadRequestException(
        "Only manual or correction account transaction can be reversed directly.",
      );
    }
  }

  private async assertCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.account.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException("Account code already exists.");
    }
  }

  private normalizeCreateInput(body: AccountWriteBody): NormalizedAccountInput {
    return {
      code: this.normalizeCode(body.code),
      name: this.normalizeRequiredString(body.name, "name"),
      type: this.normalizeAccountType(body.type),
      currency: this.normalizeCurrencyCode(body.currency),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private normalizeUpdateInput(
    body: AccountWriteBody,
    current: AccountSnapshot,
  ): NormalizedAccountInput {
    return {
      code:
        body.code === undefined ? current.code : this.normalizeCode(body.code),
      name:
        body.name === undefined
          ? current.name
          : this.normalizeRequiredString(body.name, "name"),
      type:
        body.type === undefined
          ? current.type
          : this.normalizeAccountType(body.type),
      currency:
        body.currency === undefined
          ? current.currency
          : this.normalizeCurrencyCode(body.currency),
      memo:
        body.memo === undefined
          ? current.memo
          : this.normalizeOptionalString(body.memo),
    };
  }

  private async normalizeManualAccountTransaction(
    body: ManualAccountTransactionBody,
  ): Promise<NormalizedManualAccountTransactionInput> {
    const account = await this.findActiveAccountForTransaction(body.accountId);
    const currency = this.normalizeCurrencyCode(body.currency);

    if (account.currency !== currency) {
      throw new BadRequestException("Account currency must match transaction currency.");
    }

    const sourceType =
      this.normalizeOptionalString(body.sourceType) ??
      manualAccountTransactionSourceType;

    return {
      accountId: account.id,
      direction: this.normalizeTransactionDirectionRequired(body.direction),
      transactionDate: this.normalizeDate(body.transactionDate, "transactionDate"),
      title: this.normalizeRequiredString(body.title, "title"),
      currency,
      amountJpy:
        currency === CurrencyCode.JPY
          ? this.normalizeJpyAmount(body.amountJpy, "amountJpy")
          : null,
      amountCny:
        currency === CurrencyCode.CNY
          ? this.normalizeCnyAmount(body.amountCny, "amountCny")
          : null,
      sourceType,
      sourceId: this.normalizeOptionalString(body.sourceId),
      idempotencyKey: this.normalizeOptionalString(body.idempotencyKey),
      externalEventId: this.normalizeOptionalString(body.externalEventId),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private async normalizeAccountTransfer(
    body: CreateAccountTransferBody,
  ): Promise<NormalizedAccountTransferInput> {
    const fromAccount = await this.findActiveAccountForTransaction(body.fromAccountId);
    const toAccount = await this.findActiveAccountForTransaction(body.toAccountId);

    if (fromAccount.id === toAccount.id) {
      throw new BadRequestException("fromAccountId and toAccountId must be different.");
    }

    const currency = this.normalizeCurrencyCode(body.currency);

    if (fromAccount.currency !== currency || toAccount.currency !== currency) {
      throw new BadRequestException("Both accounts must match transfer currency.");
    }

    return {
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      transferDate: this.normalizeDate(body.transferDate, "transferDate"),
      currency,
      amountJpy:
        currency === CurrencyCode.JPY
          ? this.normalizePositiveJpyAmount(body.amountJpy, "amountJpy")
          : null,
      amountCny:
        currency === CurrencyCode.CNY
          ? this.normalizePositiveCnyAmount(body.amountCny, "amountCny")
          : null,
      idempotencyKey: this.normalizeOptionalString(body.idempotencyKey),
      memo: this.normalizeOptionalString(body.memo),
    };
  }

  private buildWhere(query: ListAccountsQuery): Prisma.AccountWhereInput {
    const status = this.normalizeStatus(query.status);
    const type = this.normalizeOptionalAccountType(query.type);
    const currency = this.normalizeOptionalCurrencyCode(query.currency);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(currency ? { currency } : {}),
      ...(keyword
        ? {
            OR: [
              { code: { contains: keyword, mode: "insensitive" } },
              { name: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }

  private buildTransactionWhere(
    query: ListAccountTransactionsQuery,
  ): Prisma.AccountTransactionWhereInput {
    const accountId = this.normalizeOptionalString(query.accountId);
    const direction = this.normalizeTransactionDirection(query.direction);
    const status = this.normalizeTransactionStatus(query.status);
    const sourceType = this.normalizeOptionalString(query.sourceType);
    const incomeRecordId = this.normalizeOptionalString(query.incomeRecordId);
    const expenseRecordId = this.normalizeOptionalString(query.expenseRecordId);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(accountId ? { accountId } : {}),
      ...(direction ? { direction } : {}),
      ...(status ? { status } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(incomeRecordId ? { incomeRecordId } : {}),
      ...(expenseRecordId ? { expenseRecordId } : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: "insensitive" } },
              { sourceType: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { account: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private buildTransferWhere(
    query: ListAccountTransfersQuery,
  ): Prisma.AccountTransferWhereInput {
    const fromAccountId = this.normalizeOptionalString(query.fromAccountId);
    const toAccountId = this.normalizeOptionalString(query.toAccountId);
    const status = this.normalizeTransferStatus(query.status);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(fromAccountId ? { fromAccountId } : {}),
      ...(toAccountId ? { toAccountId } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { memo: { contains: keyword, mode: "insensitive" } },
              { fromAccount: { name: { contains: keyword, mode: "insensitive" } } },
              { toAccount: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(RecordStatus).includes(status as RecordStatus)) {
      return status as RecordStatus;
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

  private normalizeCode(value: unknown) {
    const code = this.normalizeRequiredString(value, "code").toLowerCase();

    if (!/^[a-z0-9][a-z0-9_:-]*$/.test(code)) {
      throw new BadRequestException(
        "code must use lowercase letters, numbers, underscore, colon, or hyphen.",
      );
    }

    return code;
  }

  private normalizeAccountType(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("type is required.");
    }

    if (!Object.values(AccountType).includes(value as AccountType)) {
      throw new BadRequestException("Invalid account type.");
    }

    return value as AccountType;
  }

  private normalizeOptionalAccountType(value: unknown) {
    const type = this.normalizeOptionalString(value);

    if (!type) {
      return undefined;
    }

    if (!Object.values(AccountType).includes(type as AccountType)) {
      return undefined;
    }

    return type as AccountType;
  }

  private normalizeCurrencyCode(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("currency is required.");
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException("Invalid currency code.");
    }

    return value as CurrencyCode;
  }

  private normalizeOptionalCurrencyCode(value: unknown) {
    const currency = this.normalizeOptionalString(value);

    if (!currency) {
      return undefined;
    }

    if (!Object.values(CurrencyCode).includes(currency as CurrencyCode)) {
      return undefined;
    }

    return currency as CurrencyCode;
  }

  private normalizeTransactionDirectionRequired(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("direction is required.");
    }

    if (
      !Object.values(AccountTransactionDirection).includes(
        value as AccountTransactionDirection,
      )
    ) {
      throw new BadRequestException("Invalid transaction direction.");
    }

    return value as AccountTransactionDirection;
  }

  private normalizeTransactionDirection(value: unknown) {
    const direction = this.normalizeOptionalString(value);

    if (!direction) {
      return undefined;
    }

    if (
      !Object.values(AccountTransactionDirection).includes(
        direction as AccountTransactionDirection,
      )
    ) {
      return undefined;
    }

    return direction as AccountTransactionDirection;
  }

  private normalizeTransactionStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (!status) {
      return undefined;
    }

    if (
      !Object.values(AccountTransactionStatus).includes(
        status as AccountTransactionStatus,
      )
    ) {
      return undefined;
    }

    return status as AccountTransactionStatus;
  }

  private normalizeTransferStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (!status) {
      return undefined;
    }

    if (
      !Object.values(AccountTransferStatus).includes(
        status as AccountTransferStatus,
      )
    ) {
      return undefined;
    }

    return status as AccountTransferStatus;
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

  private normalizePositiveJpyAmount(value: unknown, field: string) {
    const amount = this.normalizeJpyAmount(value, field);

    if (amount <= 0) {
      throw new BadRequestException(`${field} must be greater than 0.`);
    }

    return amount;
  }

  private normalizePositiveCnyAmount(value: unknown, field: string) {
    const amount = this.normalizeCnyAmount(value, field);

    if (amount <= 0) {
      throw new BadRequestException(`${field} must be greater than 0.`);
    }

    return amount;
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
