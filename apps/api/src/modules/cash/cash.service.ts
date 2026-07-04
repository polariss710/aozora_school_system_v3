import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditRiskLevel,
  CashRequestDirection,
  CashRequestStatus,
  CurrencyCode,
  IncomeRecordStatus,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { RoundingMode } from "../money/money.types";
import {
  ConfirmCashRequestBody,
  ListCashRequestsQuery,
  RejectCashRequestBody,
  SubmitIncomeCashRequestBody,
} from "./cash.types";

const defaultLimit = 100;
const maxLimit = 500;

const cashRequestSelect = {
  id: true,
  direction: true,
  sourceType: true,
  sourceId: true,
  incomeRecordId: true,
  status: true,
  expectedCurrency: true,
  expectedAmountJpy: true,
  expectedAmountCny: true,
  carryoverAmountCny: true,
  requestedCurrency: true,
  requestedAmountJpy: true,
  requestedAmountCny: true,
  exchangeRate: true,
  exchangeRateSource: true,
  conversionMethod: true,
  cashAccountCode: true,
  externalCashRequestId: true,
  externalCashEventId: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  incomeRecord: {
    select: {
      id: true,
      title: true,
      recordStatus: true,
      cashStatus: true,
      originalCurrency: true,
      originalAmountJpy: true,
      originalAmountCny: true,
      carryoverAmountCny: true,
    },
  },
} satisfies Prisma.CashRequestSelect;

const incomeRecordSelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  carryoverAmountCny: true,
  recordStatus: true,
  cashStatus: true,
} satisfies Prisma.IncomeRecordSelect;

type CashRequestSnapshot = Prisma.CashRequestGetPayload<{
  select: typeof cashRequestSelect;
}>;

type IncomeRecordSnapshot = Prisma.IncomeRecordGetPayload<{
  select: typeof incomeRecordSelect;
}>;

@Injectable()
export class CashService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async listCashRequests(query: ListCashRequestsQuery) {
    const where = this.buildWhere(query);
    const limit = this.normalizeLimit(query.limit);

    const [items, total] = await Promise.all([
      this.prisma.cashRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: cashRequestSelect,
      }),
      this.prisma.cashRequest.count({ where }),
    ]);

    return { items, total, limit };
  }

  async getCashRequest(id: string) {
    const cashRequest = await this.findCashRequest(id);

    return { cashRequest };
  }

  async submitIncomeCashRequest(
    incomeRecordId: string,
    body: SubmitIncomeCashRequestBody,
    actorUserId: string,
  ) {
    const incomeRecord = await this.findIncomeRecord(incomeRecordId);
    this.assertIncomeCanRequestCash(incomeRecord);
    const input = this.normalizeSubmitInput(body);
    const amounts = this.calculateIncomeRequestAmounts(incomeRecord, input);

    const result = await this.prisma.$transaction(async (tx) => {
      const cashRequest = await tx.cashRequest.create({
        data: {
          direction: CashRequestDirection.income,
          sourceType: incomeRecord.sourceType,
          sourceId: incomeRecord.sourceId,
          incomeRecordId: incomeRecord.id,
          status: CashRequestStatus.cash_requested,
          expectedCurrency: incomeRecord.originalCurrency,
          expectedAmountJpy: incomeRecord.originalAmountJpy,
          expectedAmountCny: incomeRecord.originalAmountCny,
          carryoverAmountCny: incomeRecord.carryoverAmountCny,
          requestedCurrency: input.requestedCurrency,
          requestedAmountJpy: amounts.requestedAmountJpy,
          requestedAmountCny: amounts.requestedAmountCny,
          exchangeRate: input.exchangeRate
            ? new Prisma.Decimal(input.exchangeRate)
            : null,
          exchangeRateSource: input.exchangeRateSource,
          conversionMethod: input.conversionMethod,
          cashAccountCode: input.cashAccountCode,
        },
        select: cashRequestSelect,
      });

      const updatedIncome = await tx.incomeRecord.update({
        where: { id: incomeRecord.id },
        data: { cashStatus: CashRequestStatus.cash_requested },
        select: incomeRecordSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_request.submit_income",
          targetType: "cash_request",
          targetId: cashRequest.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: incomeRecord,
          afterSnapshot: { cashRequest, incomeRecord: updatedIncome },
        },
        tx,
      );

      return { cashRequest, incomeRecord: updatedIncome };
    });

    return result;
  }

  async rejectCashRequest(
    id: string,
    body: RejectCashRequestBody,
    actorUserId: string,
  ) {
    const before = await this.findCashRequest(id);

    if (before.status !== CashRequestStatus.cash_requested) {
      throw new BadRequestException("Only requested Cash request can be rejected.");
    }

    const rejectionReason = this.normalizeOptionalString(body.rejectionReason);
    const externalCashEventId = this.normalizeOptionalString(body.externalCashEventId);

    const result = await this.prisma.$transaction(async (tx) => {
      const cashRequest = await tx.cashRequest.update({
        where: { id },
        data: {
          status: CashRequestStatus.cash_rejected,
          rejectionReason,
          externalCashEventId,
        },
        select: cashRequestSelect,
      });

      let incomeRecord: IncomeRecordSnapshot | null = null;
      if (before.incomeRecordId) {
        incomeRecord = await tx.incomeRecord.update({
          where: { id: before.incomeRecordId },
          data: { cashStatus: CashRequestStatus.cash_rejected },
          select: incomeRecordSelect,
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_request.reject",
          targetType: "cash_request",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: before,
          afterSnapshot: { cashRequest, incomeRecord },
        },
        tx,
      );

      return { cashRequest, incomeRecord };
    });

    return result;
  }

  async confirmCashRequest(
    id: string,
    body: ConfirmCashRequestBody,
    actorUserId: string,
  ) {
    const before = await this.findCashRequest(id);

    if (before.status !== CashRequestStatus.cash_requested) {
      throw new BadRequestException("Only requested Cash request can be confirmed.");
    }

    const externalCashRequestId = this.normalizeOptionalString(
      body.externalCashRequestId,
    );
    const externalCashEventId = this.normalizeOptionalString(body.externalCashEventId);

    const result = await this.prisma.$transaction(async (tx) => {
      const cashRequest = await tx.cashRequest.update({
        where: { id },
        data: {
          status: CashRequestStatus.cash_confirmed,
          externalCashRequestId,
          externalCashEventId,
        },
        select: cashRequestSelect,
      });

      let incomeRecord: IncomeRecordSnapshot | null = null;
      if (before.incomeRecordId) {
        incomeRecord = await tx.incomeRecord.update({
          where: { id: before.incomeRecordId },
          data: {
            recordStatus: IncomeRecordStatus.cash_confirmed,
            cashStatus: CashRequestStatus.cash_confirmed,
          },
          select: incomeRecordSelect,
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_request.confirm",
          targetType: "cash_request",
          targetId: id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: { cashRequest, incomeRecord },
        },
        tx,
      );

      return { cashRequest, incomeRecord };
    });

    return result;
  }

  private assertIncomeCanRequestCash(incomeRecord: IncomeRecordSnapshot) {
    if (incomeRecord.recordStatus !== IncomeRecordStatus.pending) {
      throw new BadRequestException("Only pending income can submit Cash request.");
    }

    if (
      incomeRecord.cashStatus !== CashRequestStatus.not_requested &&
      incomeRecord.cashStatus !== CashRequestStatus.cash_rejected
    ) {
      throw new BadRequestException("Income Cash status does not allow request.");
    }
  }

  private calculateIncomeRequestAmounts(
    incomeRecord: IncomeRecordSnapshot,
    input: ReturnType<CashService["normalizeSubmitInput"]>,
  ) {
    const carryoverCny = incomeRecord.carryoverAmountCny?.toNumber() ?? 0;

    if (input.requestedCurrency === CurrencyCode.JPY) {
      if (carryoverCny !== 0) {
        throw new BadRequestException("Income with CNY carryover must request CNY.");
      }

      if (
        incomeRecord.originalCurrency !== CurrencyCode.JPY ||
        incomeRecord.originalAmountJpy === null
      ) {
        throw new BadRequestException("Income cannot request JPY.");
      }

      return {
        requestedAmountJpy: this.moneyService.confirmAmount({
          amount: incomeRecord.originalAmountJpy,
          currency: "JPY",
        }),
        requestedAmountCny: null,
      };
    }

    if (incomeRecord.originalCurrency === CurrencyCode.CNY) {
      if (!incomeRecord.originalAmountCny) {
        throw new BadRequestException("CNY income amount is missing.");
      }

      return {
        requestedAmountJpy: null,
        requestedAmountCny: new Prisma.Decimal(
          this.moneyService.confirmAmount({
            amount: incomeRecord.originalAmountCny.toNumber(),
            currency: "CNY",
          }),
        ),
      };
    }

    if (!incomeRecord.originalAmountJpy) {
      throw new BadRequestException("JPY income amount is missing.");
    }

    if (!input.exchangeRate) {
      throw new BadRequestException("exchangeRate is required for CNY request.");
    }

    return {
      requestedAmountJpy: null,
      requestedAmountCny: new Prisma.Decimal(
        this.moneyService.convertJpyToCny({
          jpyAmount: incomeRecord.originalAmountJpy,
          exchangeRate: input.exchangeRate,
          carryoverCny,
          roundingMode: input.conversionMethod,
        }),
      ),
    };
  }

  private async findCashRequest(id: string): Promise<CashRequestSnapshot> {
    const cashRequest = await this.prisma.cashRequest.findUnique({
      where: { id },
      select: cashRequestSelect,
    });

    if (!cashRequest) {
      throw new NotFoundException("Cash request not found.");
    }

    return cashRequest;
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

  private buildWhere(query: ListCashRequestsQuery): Prisma.CashRequestWhereInput {
    const status = this.normalizeCashStatus(query.status);
    const direction = this.normalizeDirection(query.direction);
    const incomeRecordId = this.normalizeOptionalString(query.incomeRecordId);
    const sourceType = this.normalizeOptionalString(query.sourceType);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(direction ? { direction } : {}),
      ...(incomeRecordId ? { incomeRecordId } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(keyword
        ? {
            OR: [
              { cashAccountCode: { contains: keyword, mode: "insensitive" } },
              { incomeRecord: { title: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeSubmitInput(body: SubmitIncomeCashRequestBody) {
    return {
      requestedCurrency: this.normalizeCurrency(body.requestedCurrency),
      exchangeRate:
        body.exchangeRate === undefined || body.exchangeRate === null || body.exchangeRate === ""
          ? null
          : this.normalizeExchangeRate(body.exchangeRate),
      exchangeRateSource:
        this.normalizeOptionalString(body.exchangeRateSource)?.toLowerCase() ??
        null,
      conversionMethod: this.normalizeConversionMethod(body.conversionMethod),
      cashAccountCode: this.normalizeOptionalString(body.cashAccountCode),
    };
  }

  private normalizeCashStatus(value: unknown) {
    const status = this.normalizeOptionalString(value);

    if (status && Object.values(CashRequestStatus).includes(status as CashRequestStatus)) {
      return status as CashRequestStatus;
    }

    return undefined;
  }

  private normalizeDirection(value: unknown) {
    const direction = this.normalizeOptionalString(value);

    if (
      direction &&
      Object.values(CashRequestDirection).includes(direction as CashRequestDirection)
    ) {
      return direction as CashRequestDirection;
    }

    return undefined;
  }

  private normalizeCurrency(value: unknown) {
    if (typeof value !== "string") {
      throw new BadRequestException("requestedCurrency is required.");
    }

    if (!Object.values(CurrencyCode).includes(value as CurrencyCode)) {
      throw new BadRequestException("Invalid requested currency.");
    }

    return value as CurrencyCode;
  }

  private normalizeExchangeRate(value: unknown) {
    const parsed =
      typeof value === "number" ? value : Number.parseFloat(String(value));

    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException("exchangeRate must be greater than 0.");
    }

    return parsed;
  }

  private normalizeConversionMethod(value: unknown): RoundingMode {
    const method = this.normalizeOptionalString(value);

    if (method === "ceil" || method === "floor" || method === "half-up") {
      return method;
    }

    if (method === "round" || method === null) {
      return "half-up";
    }

    throw new BadRequestException("Invalid conversionMethod.");
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
