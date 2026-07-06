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
  CashInboundEventStatus,
  CashRequestStatus,
  CurrencyCode,
  IncomeRecordStatus,
  Prisma,
  RecordStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import {
  CreateCashInboundEventBody,
  ListCashInboundEventsQuery,
  RejectCashInboundEventBody,
} from "./cash-inbound.types";

const defaultLimit = 100;
const maxLimit = 500;
const cashInboundSourceType = "cash_inbound_event";
const defaultEventType = "cash_to_school_corporate_deposit";

const cashInboundEventSelect = {
  id: true,
  externalCashEventId: true,
  eventType: true,
  corporateAccountId: true,
  accountTransactionId: true,
  eventDate: true,
  sourceCurrency: true,
  sourceAmountJpy: true,
  sourceAmountCny: true,
  targetCurrency: true,
  targetAmountJpy: true,
  targetAmountCny: true,
  exchangeRate: true,
  feeCurrency: true,
  feeAmountJpy: true,
  feeAmountCny: true,
  linkedIncomeRecordIds: true,
  status: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  corporateAccount: {
    select: { id: true, code: true, name: true, type: true, currency: true },
  },
  accountTransaction: {
    select: {
      id: true,
      accountId: true,
      direction: true,
      currency: true,
      amountJpy: true,
      amountCny: true,
      status: true,
      externalEventId: true,
      idempotencyKey: true,
    },
  },
} satisfies Prisma.CashInboundEventSelect;

type NormalizedCashInboundEventInput = {
  externalCashEventId: string;
  eventType: string;
  corporateAccountId: string;
  eventDate: Date;
  sourceCurrency: CurrencyCode | null;
  sourceAmountJpy: number | null;
  sourceAmountCny: number | null;
  targetCurrency: CurrencyCode;
  targetAmountJpy: number | null;
  targetAmountCny: number | null;
  exchangeRate: number | null;
  feeCurrency: CurrencyCode | null;
  feeAmountJpy: number | null;
  feeAmountCny: number | null;
  linkedIncomeRecordIds: string[];
  memo: string | null;
};

@Injectable()
export class CashInboundService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listEvents(query: ListCashInboundEventsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.cashInboundEvent.findMany({
        where,
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: cashInboundEventSelect,
      }),
      this.prisma.cashInboundEvent.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getEvent(id: string) {
    const event = await this.findEvent(id);

    return { event };
  }

  async createEvent(body: CreateCashInboundEventBody, actorUserId: string) {
    const input = await this.normalizeCreateInput(body);

    const existing = await this.prisma.cashInboundEvent.findUnique({
      where: { externalCashEventId: input.externalCashEventId },
      select: cashInboundEventSelect,
    });

    if (existing) {
      return { event: existing, idempotent: true };
    }

    const account = await this.findActiveCorporateAccount(input.corporateAccountId);

    if (account.currency !== input.targetCurrency) {
      throw new BadRequestException("Corporate account currency must match target currency.");
    }

    await this.assertLinkedIncomeRecords(input.linkedIncomeRecordIds);

    const eventId = randomUUID();

    const event = await this.prisma.$transaction(async (tx) => {
      const accountTransaction = await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          direction: AccountTransactionDirection.in,
          sourceType: cashInboundSourceType,
          sourceId: eventId,
          incomeRecordId: null,
          expenseRecordId: null,
          transactionDate: input.eventDate,
          title: this.buildTransactionTitle(input),
          currency: input.targetCurrency,
          amountJpy: input.targetAmountJpy,
          amountCny:
            input.targetAmountCny === null
              ? null
              : new Prisma.Decimal(input.targetAmountCny),
          status: AccountTransactionStatus.active,
          idempotencyKey: `cash-inbound:${input.externalCashEventId}`,
          externalEventId: input.externalCashEventId,
          memo: input.memo,
        },
        select: { id: true },
      });

      const created = await tx.cashInboundEvent.create({
        data: {
          id: eventId,
          externalCashEventId: input.externalCashEventId,
          eventType: input.eventType,
          corporateAccountId: account.id,
          accountTransactionId: accountTransaction.id,
          eventDate: input.eventDate,
          sourceCurrency: input.sourceCurrency,
          sourceAmountJpy: input.sourceAmountJpy,
          sourceAmountCny:
            input.sourceAmountCny === null
              ? null
              : new Prisma.Decimal(input.sourceAmountCny),
          targetCurrency: input.targetCurrency,
          targetAmountJpy: input.targetAmountJpy,
          targetAmountCny:
            input.targetAmountCny === null
              ? null
              : new Prisma.Decimal(input.targetAmountCny),
          exchangeRate:
            input.exchangeRate === null ? null : new Prisma.Decimal(input.exchangeRate),
          feeCurrency: input.feeCurrency,
          feeAmountJpy: input.feeAmountJpy,
          feeAmountCny:
            input.feeAmountCny === null ? null : new Prisma.Decimal(input.feeAmountCny),
          linkedIncomeRecordIds: input.linkedIncomeRecordIds,
          status: CashInboundEventStatus.account_transaction_created,
          memo: input.memo,
        },
        select: cashInboundEventSelect,
      });

      if (input.linkedIncomeRecordIds.length > 0) {
        const linkedIncomeRecords = await tx.incomeRecord.updateMany({
          where: {
            id: { in: input.linkedIncomeRecordIds },
            recordStatus: IncomeRecordStatus.cash_confirmed,
            cashStatus: CashRequestStatus.cash_confirmed,
          },
          data: { cashStatus: CashRequestStatus.account_transaction_created },
        });

        if (linkedIncomeRecords.count !== input.linkedIncomeRecordIds.length) {
          throw new BadRequestException(
            "Linked income records must be Cash confirmed and not yet posted to account.",
          );
        }
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_inbound_event.create",
          targetType: "cash_inbound_event",
          targetId: created.id,
          riskLevel: AuditRiskLevel.high,
          afterSnapshot: created,
        },
        tx,
      );

      return created;
    });

    return { event, idempotent: false };
  }

  async rejectEvent(
    id: string,
    body: RejectCashInboundEventBody,
    actorUserId: string,
  ) {
    const before = await this.findEvent(id);

    if (before.status !== CashInboundEventStatus.account_transaction_created) {
      throw new BadRequestException("Only created Cash inbound event can be rejected.");
    }

    if (before.accountTransaction.status !== AccountTransactionStatus.active) {
      throw new BadRequestException("Cash inbound account transaction is not active.");
    }

    const reason = this.normalizeOptionalString(body.reason);
    const memo = reason ?? before.memo;

    const event = await this.prisma.$transaction(async (tx) => {
      await tx.accountTransaction.update({
        where: { id: before.accountTransactionId },
        data: {
          status: AccountTransactionStatus.reversed,
          reversedAt: new Date(),
          memo,
        },
      });

      if (before.linkedIncomeRecordIds.length > 0) {
        const linkedIncomeRecords = await tx.incomeRecord.updateMany({
          where: {
            id: { in: before.linkedIncomeRecordIds },
            recordStatus: IncomeRecordStatus.cash_confirmed,
            cashStatus: CashRequestStatus.account_transaction_created,
          },
          data: { cashStatus: CashRequestStatus.cash_confirmed },
        });

        if (linkedIncomeRecords.count !== before.linkedIncomeRecordIds.length) {
          throw new BadRequestException(
            "Linked income records are not in account transaction status.",
          );
        }
      }

      const updated = await tx.cashInboundEvent.update({
        where: { id },
        data: {
          status: CashInboundEventStatus.rejected,
          memo,
        },
        select: cashInboundEventSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_inbound_event.reject",
          targetType: "cash_inbound_event",
          targetId: id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: updated,
        },
        tx,
      );

      return updated;
    });

    return { event };
  }

  private async findEvent(id: string) {
    const event = await this.prisma.cashInboundEvent.findUnique({
      where: { id },
      select: cashInboundEventSelect,
    });

    if (!event) {
      throw new NotFoundException("Cash inbound event not found.");
    }

    return event;
  }

  private async findActiveCorporateAccount(accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        type: AccountType.corporate,
        status: RecordStatus.active,
      },
      select: { id: true, code: true, name: true, type: true, currency: true },
    });

    if (!account) {
      throw new BadRequestException("Active corporate account is required.");
    }

    return account;
  }

  private async assertLinkedIncomeRecords(ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    const count = await this.prisma.incomeRecord.count({
      where: {
        id: { in: ids },
        recordStatus: IncomeRecordStatus.cash_confirmed,
        cashStatus: CashRequestStatus.cash_confirmed,
      },
    });

    if (count !== ids.length) {
      throw new BadRequestException(
        "Linked income records must exist and be Cash confirmed.",
      );
    }
  }

  private buildTransactionTitle(input: NormalizedCashInboundEventInput) {
    if (input.sourceCurrency && input.sourceCurrency !== input.targetCurrency) {
      return `Cash入站 ${input.sourceCurrency}->${input.targetCurrency}`;
    }

    return "Cash入站 法人账户入金";
  }

  private async normalizeCreateInput(
    body: CreateCashInboundEventBody,
  ): Promise<NormalizedCashInboundEventInput> {
    const sourceCurrency = this.normalizeOptionalCurrency(body.sourceCurrency);
    const targetCurrency = this.normalizeCurrency(body.targetCurrency, "targetCurrency");
    const feeCurrency = this.normalizeOptionalCurrency(body.feeCurrency);
    const linkedIncomeRecordIds = this.normalizeLinkedIncomeRecordIds(
      body.linkedIncomeRecordIds,
    );

    const input = {
      externalCashEventId: this.normalizeRequiredString(
        body.externalCashEventId,
        "externalCashEventId",
      ),
      eventType:
        this.normalizeOptionalString(body.eventType) ?? defaultEventType,
      corporateAccountId: this.normalizeRequiredString(
        body.corporateAccountId,
        "corporateAccountId",
      ),
      eventDate: this.normalizeDate(body.eventDate, "eventDate"),
      sourceCurrency,
      sourceAmountJpy:
        sourceCurrency === CurrencyCode.JPY
          ? this.normalizeJpyAmount(body.sourceAmountJpy, "sourceAmountJpy")
          : null,
      sourceAmountCny:
        sourceCurrency === CurrencyCode.CNY
          ? this.normalizeCnyAmount(body.sourceAmountCny, "sourceAmountCny")
          : null,
      targetCurrency,
      targetAmountJpy:
        targetCurrency === CurrencyCode.JPY
          ? this.normalizeJpyAmount(body.targetAmountJpy, "targetAmountJpy")
          : null,
      targetAmountCny:
        targetCurrency === CurrencyCode.CNY
          ? this.normalizeCnyAmount(body.targetAmountCny, "targetAmountCny")
          : null,
      exchangeRate: this.normalizeOptionalPositiveNumber(body.exchangeRate, "exchangeRate"),
      feeCurrency,
      feeAmountJpy:
        feeCurrency === CurrencyCode.JPY
          ? this.normalizeJpyAmount(body.feeAmountJpy, "feeAmountJpy")
          : null,
      feeAmountCny:
        feeCurrency === CurrencyCode.CNY
          ? this.normalizeCnyAmount(body.feeAmountCny, "feeAmountCny")
          : null,
      linkedIncomeRecordIds,
      memo: this.normalizeOptionalString(body.memo),
    };

    if (!sourceCurrency && (body.sourceAmountJpy !== undefined || body.sourceAmountCny !== undefined)) {
      throw new BadRequestException("sourceCurrency is required when source amount is provided.");
    }

    if (!feeCurrency && (body.feeAmountJpy !== undefined || body.feeAmountCny !== undefined)) {
      throw new BadRequestException("feeCurrency is required when fee amount is provided.");
    }

    return input;
  }

  private buildWhere(query: ListCashInboundEventsQuery): Prisma.CashInboundEventWhereInput {
    const status = this.normalizeStatus(query.status);
    const eventType = this.normalizeOptionalString(query.eventType);
    const corporateAccountId = this.normalizeOptionalString(query.corporateAccountId);
    const externalCashEventId = this.normalizeOptionalString(query.externalCashEventId);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(eventType ? { eventType } : {}),
      ...(corporateAccountId ? { corporateAccountId } : {}),
      ...(externalCashEventId ? { externalCashEventId } : {}),
      ...(keyword
        ? {
            OR: [
              { externalCashEventId: { contains: keyword, mode: "insensitive" } },
              { eventType: { contains: keyword, mode: "insensitive" } },
              { memo: { contains: keyword, mode: "insensitive" } },
              { corporateAccount: { name: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (
      status &&
      Object.values(CashInboundEventStatus).includes(status as CashInboundEventStatus)
    ) {
      return status as CashInboundEventStatus;
    }

    return undefined;
  }

  private normalizeCurrency(value: unknown, field: string) {
    if (typeof value !== "string") {
      throw new BadRequestException(`${field} is required.`);
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException(`Invalid ${field}.`);
    }

    return value as CurrencyCode;
  }

  private normalizeOptionalCurrency(value: unknown) {
    const currency = this.normalizeOptionalString(value);

    if (!currency) {
      return null;
    }

    if (!Object.values(CurrencyCode).includes(currency as CurrencyCode)) {
      throw new BadRequestException("Invalid currency.");
    }

    return currency as CurrencyCode;
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

  private normalizeOptionalPositiveNumber(value: unknown, field: string) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} must be a non-negative number.`);
    }

    return value;
  }

  private normalizeLinkedIncomeRecordIds(value: unknown) {
    if (value === null || value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException("linkedIncomeRecordIds must be an array.");
    }

    const ids = value.map((item) => this.normalizeRequiredString(item, "linkedIncomeRecordId"));

    return [...new Set(ids)];
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
