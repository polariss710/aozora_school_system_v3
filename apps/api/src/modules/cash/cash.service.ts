import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AuditRiskLevel,
  CashRequestDirection,
  CashRequestStatus,
  CurrencyCode,
  ExpenseRecordStatus,
  IncomeRecordStatus,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { CashInboundService } from "../cash-inbound/cash-inbound.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { RoundingMode } from "../money/money.types";
import {
  CASH_GATEWAY,
  CashEligibleAccount,
  CashExternalRequest,
  CashGateway,
  CashGatewayRequestError,
} from "./cash.gateway";
import {
  CashFxInboundCallbackBody,
  CashFxInboundOptionsQuery,
  CashRequestResultCallbackBody,
  ConfirmCashRequestBody,
  ListCashRequestsQuery,
  RejectCashRequestBody,
  SubmitExpenseCashRequestBody,
  SubmitIncomeCashRequestBody,
  WithdrawCashRequestBody,
} from "./cash.types";

const defaultLimit = 100;
const maxLimit = 500;

const cashRequestSelect = {
  id: true,
  direction: true,
  sourceType: true,
  sourceId: true,
  incomeRecordId: true,
  expenseRecordId: true,
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
  cashAccountId: true,
  cashAccountNameSnapshot: true,
  cashAccountTypeSnapshot: true,
  cashTransactedAt: true,
  externalCashRequestId: true,
  externalCashEventId: true,
  externalCashTransactionId: true,
  cashConfirmedAt: true,
  rejectionReason: true,
  syncAttemptCount: true,
  lastSyncAttemptAt: true,
  lastSyncError: true,
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
      yearMonth: true,
      memo: true,
    },
  },
  expenseRecord: {
    select: {
      id: true,
      title: true,
      recordStatus: true,
      cashStatus: true,
      originalCurrency: true,
      originalAmountJpy: true,
      originalAmountCny: true,
      yearMonth: true,
      memo: true,
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
  yearMonth: true,
  memo: true,
} satisfies Prisma.IncomeRecordSelect;

const expenseRecordSelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  title: true,
  originalCurrency: true,
  originalAmountJpy: true,
  originalAmountCny: true,
  recordStatus: true,
  cashStatus: true,
  yearMonth: true,
  memo: true,
} satisfies Prisma.ExpenseRecordSelect;

type CashRequestSnapshot = Prisma.CashRequestGetPayload<{
  select: typeof cashRequestSelect;
}>;

type IncomeRecordSnapshot = Prisma.IncomeRecordGetPayload<{
  select: typeof incomeRecordSelect;
}>;

type ExpenseRecordSnapshot = Prisma.ExpenseRecordGetPayload<{
  select: typeof expenseRecordSelect;
}>;

@Injectable()
export class CashService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MoneyService) private readonly moneyService: MoneyService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(CASH_GATEWAY) private readonly cashGateway: CashGateway,
    @Inject(CashInboundService) private readonly cashInboundService: CashInboundService,
  ) {}

  async listEligibleAccounts() {
    const items = await this.cashGateway.listEligibleAccounts();
    return { mode: this.cashGateway.mode, items };
  }

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
    const cashAccount = await this.resolveEligibleAccount(
      input.cashAccountId,
      input.requestedCurrency,
    );

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
          cashAccountCode: cashAccount.name,
          cashAccountId: cashAccount.id,
          cashAccountNameSnapshot: cashAccount.name,
          cashAccountTypeSnapshot: cashAccount.accountType,
          cashTransactedAt: input.transactedAt,
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

    return this.submitCreatedRequest(result, actorUserId);
  }

  async submitExpenseCashRequest(
    expenseRecordId: string,
    body: SubmitExpenseCashRequestBody,
    actorUserId: string,
  ) {
    const expenseRecord = await this.findExpenseRecord(expenseRecordId);
    this.assertExpenseCanRequestCash(expenseRecord);
    const input = this.normalizeSubmitInput(body);
    const amounts = this.calculateExpenseRequestAmounts(expenseRecord, input);
    const cashAccount = await this.resolveEligibleAccount(
      input.cashAccountId,
      input.requestedCurrency,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const cashRequest = await tx.cashRequest.create({
        data: {
          direction: CashRequestDirection.expense,
          sourceType: expenseRecord.sourceType,
          sourceId: expenseRecord.sourceId,
          expenseRecordId: expenseRecord.id,
          status: CashRequestStatus.cash_requested,
          expectedCurrency: expenseRecord.originalCurrency,
          expectedAmountJpy: expenseRecord.originalAmountJpy,
          expectedAmountCny: expenseRecord.originalAmountCny,
          carryoverAmountCny: null,
          requestedCurrency: input.requestedCurrency,
          requestedAmountJpy: amounts.requestedAmountJpy,
          requestedAmountCny: amounts.requestedAmountCny,
          exchangeRate: input.exchangeRate
            ? new Prisma.Decimal(input.exchangeRate)
            : null,
          exchangeRateSource: input.exchangeRateSource,
          conversionMethod: input.conversionMethod,
          cashAccountCode: cashAccount.name,
          cashAccountId: cashAccount.id,
          cashAccountNameSnapshot: cashAccount.name,
          cashAccountTypeSnapshot: cashAccount.accountType,
          cashTransactedAt: input.transactedAt,
        },
        select: cashRequestSelect,
      });

      const updatedExpense = await tx.expenseRecord.update({
        where: { id: expenseRecord.id },
        data: { cashStatus: CashRequestStatus.cash_requested },
        select: expenseRecordSelect,
      });

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_request.submit_expense",
          targetType: "cash_request",
          targetId: cashRequest.id,
          riskLevel: AuditRiskLevel.high,
          beforeSnapshot: expenseRecord,
          afterSnapshot: { cashRequest, expenseRecord: updatedExpense },
        },
        tx,
      );

      return { cashRequest, expenseRecord: updatedExpense };
    });

    return this.submitCreatedRequest(result, actorUserId);
  }

  async resubmitCashRequest(id: string, actorUserId: string) {
    if (this.cashGateway.mode !== "supabase") {
      throw new BadRequestException(
        "Cash resubmit is available only for the Supabase integration.",
      );
    }

    const cashRequest = await this.findCashRequest(id);
    if (
      cashRequest.status !== CashRequestStatus.needs_manual_review &&
      !(
        cashRequest.status === CashRequestStatus.cash_requested &&
        !cashRequest.externalCashRequestId
      )
    ) {
      throw new BadRequestException(
        "Only an uncertain or incomplete Cash submission can be retried.",
      );
    }

    return this.syncExternalPendingRequest(cashRequest, actorUserId);
  }

  async applyExternalRequestResult(
    body: CashRequestResultCallbackBody,
    accessToken: string,
  ) {
    if (this.cashGateway.mode !== "supabase") {
      throw new ServiceUnavailableException("Cash callback is not enabled.");
    }

    const cashRequestId = this.normalizeRequiredUuid(
      body.cash_request_id,
      "cash_request_id",
    );
    const action = this.normalizeCallbackAction(body.action);

    try {
      await this.cashGateway.verifyCallbackAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException("Cash callback authentication failed.");
    }

    const external = await this.cashGateway.getExternalRequest(cashRequestId);
    const local = await this.prisma.cashRequest.findFirst({
      where: {
        OR: [
          { externalCashRequestId: cashRequestId },
          { id: external.externalEventId },
        ],
      },
      select: cashRequestSelect,
    });
    if (!local) {
      throw new NotFoundException("Matching V3 Cash request was not found.");
    }

    this.assertExternalRequestMatches(local, external, action);
    const targetStatus = action === "approved"
      ? CashRequestStatus.cash_confirmed
      : CashRequestStatus.cash_rejected;

    if (local.status === targetStatus) {
      const sameTransaction = action === "rejected" ||
        local.externalCashTransactionId === external.createdTransactionId;
      if (
        local.externalCashRequestId === external.id &&
        sameTransaction
      ) {
        return { ok: true, cashRequest: local, action, idempotent: true };
      }
      throw new ConflictException("Cash callback conflicts with the stored result.");
    }

    if (
      local.status !== CashRequestStatus.cash_requested &&
      local.status !== CashRequestStatus.needs_manual_review
    ) {
      throw new ConflictException("V3 Cash request status does not allow callback.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.CashRequestUpdateInput = action === "approved"
        ? {
            status: CashRequestStatus.cash_confirmed,
            externalCashRequestId: external.id,
            externalCashEventId: external.externalEventId,
            externalCashTransactionId: external.createdTransactionId,
            cashConfirmedAt: external.approvedAt
              ? new Date(external.approvedAt)
              : new Date(),
            rejectionReason: null,
            lastSyncError: null,
          }
        : {
            status: CashRequestStatus.cash_rejected,
            externalCashRequestId: external.id,
            externalCashEventId: external.externalEventId,
            externalCashTransactionId: null,
            cashConfirmedAt: null,
            rejectionReason: external.rejectedReason,
            lastSyncError: null,
          };

      const cashRequest = await tx.cashRequest.update({
        where: { id: local.id },
        data: updateData,
        select: cashRequestSelect,
      });

      let incomeRecord: IncomeRecordSnapshot | null = null;
      let expenseRecord: ExpenseRecordSnapshot | null = null;
      if (local.incomeRecordId) {
        incomeRecord = await tx.incomeRecord.update({
          where: { id: local.incomeRecordId },
          data: action === "approved"
            ? {
                recordStatus: IncomeRecordStatus.cash_confirmed,
                cashStatus: CashRequestStatus.cash_confirmed,
              }
            : { cashStatus: CashRequestStatus.cash_rejected },
          select: incomeRecordSelect,
        });
      }
      if (local.expenseRecordId) {
        expenseRecord = await tx.expenseRecord.update({
          where: { id: local.expenseRecordId },
          data: action === "approved"
            ? {
                recordStatus: ExpenseRecordStatus.cash_confirmed,
                cashStatus: CashRequestStatus.cash_confirmed,
              }
            : { cashStatus: CashRequestStatus.cash_rejected },
          select: expenseRecordSelect,
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId: null,
          action: action === "approved"
            ? "cash_request.external_confirm"
            : "cash_request.external_reject",
          targetType: "cash_request",
          targetId: local.id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: local,
          afterSnapshot: { cashRequest, incomeRecord, expenseRecord },
          metadata: {
            callbackSource: "cash_system",
            externalCashRequestId: external.id,
            externalCashTransactionId: external.createdTransactionId,
          },
        },
        tx,
      );

      return { cashRequest, incomeRecord, expenseRecord };
    });

    return { ok: true, ...result, action, idempotent: false };
  }

  async getExternalFxInboundOptions(
    query: CashFxInboundOptionsQuery,
    accessToken: string,
  ) {
    this.assertExternalCashCallbackEnabled();
    await this.verifyExternalCashAccessToken(accessToken);
    const cnyTransactionId = this.normalizeRequiredUuid(
      query.cash_cny_transaction_id,
      "cash_cny_transaction_id",
    );
    const fx = await this.cashGateway.getCnyToJpyFx(cnyTransactionId);

    const [corporateAccounts, candidateRequests, existingEvent] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          type: "corporate",
          currency: CurrencyCode.JPY,
          status: "active",
        },
        orderBy: [{ code: "asc" }],
        select: { id: true, code: true, name: true, currency: true },
      }),
      this.prisma.cashRequest.findMany({
        where: {
          direction: CashRequestDirection.income,
          status: CashRequestStatus.cash_confirmed,
          requestedCurrency: CurrencyCode.CNY,
          cashAccountId: fx.cnyAccountId,
          externalCashTransactionId: { not: null },
          incomeRecord: {
            recordStatus: IncomeRecordStatus.cash_confirmed,
            cashStatus: CashRequestStatus.cash_confirmed,
          },
        },
        orderBy: [{ cashConfirmedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          incomeRecordId: true,
          requestedAmountCny: true,
          externalCashTransactionId: true,
          cashConfirmedAt: true,
          incomeRecord: {
            select: {
              id: true,
              title: true,
              yearMonth: true,
              student: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.cashInboundEvent.findUnique({
        where: { externalCashEventId: fx.cnyTransactionId },
        select: {
          id: true,
          corporateAccountId: true,
          linkedIncomeRecordIds: true,
          status: true,
          accountTransactionId: true,
        },
      }),
    ]);

    return {
      ok: true,
      fx,
      corporateAccounts,
      existingEvent,
      incomeCandidates: candidateRequests.map((request) => ({
        cashRequestId: request.id,
        incomeRecordId: request.incomeRecordId,
        title: request.incomeRecord?.title ?? "",
        yearMonth: request.incomeRecord?.yearMonth ?? null,
        student: request.incomeRecord?.student ?? null,
        amountCny: request.requestedAmountCny?.toNumber() ?? null,
        externalCashTransactionId: request.externalCashTransactionId,
        cashConfirmedAt: request.cashConfirmedAt,
      })),
    };
  }

  async applyExternalFxInbound(
    body: CashFxInboundCallbackBody,
    accessToken: string,
  ) {
    this.assertExternalCashCallbackEnabled();
    await this.verifyExternalCashAccessToken(accessToken);
    const cnyTransactionId = this.normalizeRequiredUuid(
      body.cash_cny_transaction_id,
      "cash_cny_transaction_id",
    );
    const corporateAccountId = this.normalizeRequiredUuid(
      body.corporate_account_id,
      "corporate_account_id",
    );
    const linkedIncomeRecordIds = this.normalizeRequiredUuidArray(
      body.linked_income_record_ids,
      "linked_income_record_ids",
    );
    const fx = await this.cashGateway.getCnyToJpyFx(cnyTransactionId);

    const linkedRequests = await this.prisma.cashRequest.findMany({
      where: {
        direction: CashRequestDirection.income,
        status: CashRequestStatus.cash_confirmed,
        requestedCurrency: CurrencyCode.CNY,
        cashAccountId: fx.cnyAccountId,
        externalCashTransactionId: { not: null },
        incomeRecordId: { in: linkedIncomeRecordIds },
        incomeRecord: {
          recordStatus: IncomeRecordStatus.cash_confirmed,
          cashStatus: {
            in: [
              CashRequestStatus.cash_confirmed,
              CashRequestStatus.account_transaction_created,
            ],
          },
        },
      },
      orderBy: [{ cashConfirmedAt: "desc" }, { createdAt: "desc" }],
      select: {
        incomeRecordId: true,
        requestedAmountCny: true,
        externalCashTransactionId: true,
      },
    });
    const requestByIncome = new Map<string, (typeof linkedRequests)[number]>();
    for (const request of linkedRequests) {
      if (request.incomeRecordId && !requestByIncome.has(request.incomeRecordId)) {
        requestByIncome.set(request.incomeRecordId, request);
      }
    }
    if (requestByIncome.size !== linkedIncomeRecordIds.length) {
      throw new BadRequestException(
        "Every linked income must have one confirmed CNY Cash transaction in the FX source account.",
      );
    }

    const linkedAmountCny = this.moneyService.confirmAmount({
      amount: [...requestByIncome.values()].reduce(
        (sum, request) => sum + (request.requestedAmountCny?.toNumber() ?? 0),
        0,
      ),
      currency: CurrencyCode.CNY,
    });
    const fxAmountCny = this.moneyService.confirmAmount({
      amount: fx.cnyAmount,
      currency: CurrencyCode.CNY,
    });
    if (linkedAmountCny !== fxAmountCny) {
      throw new BadRequestException(
        "Linked confirmed income total must exactly match the Cash FX CNY amount.",
      );
    }

    const result = await this.cashInboundService.createEvent(
      {
        externalCashEventId: fx.cnyTransactionId,
        eventType: "cash_cny_to_jpy_fx",
        corporateAccountId,
        eventDate: fx.transactedAt,
        sourceCurrency: CurrencyCode.CNY,
        sourceAmountCny: fxAmountCny,
        targetCurrency: CurrencyCode.JPY,
        targetAmountJpy: fx.jpyAmount,
        exchangeRate: Number((fxAmountCny / fx.jpyAmount).toFixed(8)),
        linkedIncomeRecordIds,
        memo: [
          `Cash FX ${fx.cnyTransactionId} -> ${fx.jpyTransactionId}`,
          fx.description,
          fx.note,
        ].filter(Boolean).join(" / "),
      },
      null,
    );

    return { ok: true, ...result, fx };
  }

  private assertExternalCashCallbackEnabled() {
    if (this.cashGateway.mode !== "supabase") {
      throw new ServiceUnavailableException("Cash callback is not enabled.");
    }
  }

  private async verifyExternalCashAccessToken(accessToken: string) {
    try {
      await this.cashGateway.verifyCallbackAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException("Cash callback authentication failed.");
    }
  }

  private async submitCreatedRequest<
    T extends { cashRequest: CashRequestSnapshot },
  >(result: T, actorUserId: string) {
    if (this.cashGateway.mode === "mock") {
      return { ...result, integrationMode: "mock" as const };
    }

    return this.syncExternalPendingRequest(result.cashRequest, actorUserId);
  }

  private async syncExternalPendingRequest(
    before: CashRequestSnapshot,
    actorUserId: string,
  ) {
    const attemptAt = new Date();

    try {
      const referenceId = before.incomeRecordId ?? before.expenseRecordId;
      if (!referenceId || !before.cashAccountId || !before.cashTransactedAt) {
        throw new CashGatewayRequestError(
          "V3 Cash request is missing its external submission snapshot.",
          false,
        );
      }

      const amount = before.requestedCurrency === CurrencyCode.JPY
        ? before.requestedAmountJpy
        : before.requestedAmountCny?.toNumber();
      if (!amount || amount <= 0) {
        throw new CashGatewayRequestError(
          "V3 Cash request amount is invalid.",
          false,
        );
      }

      const external = await this.cashGateway.createPendingRequest({
        localCashRequestId: before.id,
        direction: before.direction,
        referenceId,
        transactedAt: before.cashTransactedAt.toISOString().slice(0, 10),
        currency: before.requestedCurrency,
        amount,
        accountId: before.cashAccountId,
        description: before.incomeRecord?.title ?? before.expenseRecord?.title ?? before.sourceType,
        note: before.incomeRecord?.memo ?? before.expenseRecord?.memo ?? null,
        payloadSnapshot: this.buildExternalPayload(before, amount),
      });

      if (external.status !== "pending") {
        const verified = await this.cashGateway.getExternalRequest(external.requestId);
        return this.applyVerifiedExternalResultFromRetry(
          before,
          verified,
          actorUserId,
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const cashRequest = await tx.cashRequest.update({
          where: { id: before.id },
          data: {
            status: CashRequestStatus.cash_requested,
            externalCashRequestId: external.requestId,
            externalCashEventId: before.id,
            syncAttemptCount: { increment: 1 },
            lastSyncAttemptAt: attemptAt,
            lastSyncError: null,
          },
          select: cashRequestSelect,
        });

        if (before.incomeRecordId) {
          await tx.incomeRecord.update({
            where: { id: before.incomeRecordId },
            data: { cashStatus: CashRequestStatus.cash_requested },
          });
        }
        if (before.expenseRecordId) {
          await tx.expenseRecord.update({
            where: { id: before.expenseRecordId },
            data: { cashStatus: CashRequestStatus.cash_requested },
          });
        }

        await this.auditService.recordEvent(
          {
            actorUserId,
            action: "cash_request.external_submit",
            targetType: "cash_request",
            targetId: before.id,
            riskLevel: AuditRiskLevel.high,
            beforeSnapshot: before,
            afterSnapshot: cashRequest,
            metadata: {
              externalCashRequestId: external.requestId,
              inserted: external.inserted,
            },
          },
          tx,
        );

        return { cashRequest };
      });

      return { ...result, integrationMode: "supabase" as const };
    } catch (error) {
      const message = error instanceof Error
        ? error.message.slice(0, 500)
        : "Cash submission failed without a verified response.";

      await this.prisma.$transaction(async (tx) => {
        const cashRequest = await tx.cashRequest.update({
          where: { id: before.id },
          data: {
            status: CashRequestStatus.needs_manual_review,
            syncAttemptCount: { increment: 1 },
            lastSyncAttemptAt: attemptAt,
            lastSyncError: message,
          },
          select: cashRequestSelect,
        });

        if (before.incomeRecordId) {
          await tx.incomeRecord.update({
            where: { id: before.incomeRecordId },
            data: { cashStatus: CashRequestStatus.needs_manual_review },
          });
        }
        if (before.expenseRecordId) {
          await tx.expenseRecord.update({
            where: { id: before.expenseRecordId },
            data: { cashStatus: CashRequestStatus.needs_manual_review },
          });
        }

        await this.auditService.recordEvent(
          {
            actorUserId,
            action: "cash_request.external_submit_failed",
            targetType: "cash_request",
            targetId: before.id,
            riskLevel: AuditRiskLevel.critical,
            beforeSnapshot: before,
            afterSnapshot: cashRequest,
            metadata: {
              responseUncertain: error instanceof CashGatewayRequestError
                ? error.uncertain
                : true,
            },
          },
          tx,
        );
      });

      throw new ServiceUnavailableException(
        `Cash request requires manual review: ${message}`,
      );
    }
  }

  private async applyVerifiedExternalResultFromRetry(
    before: CashRequestSnapshot,
    external: CashExternalRequest,
    actorUserId: string,
  ) {
    const action = external.status === "approved"
      ? "approved"
      : external.status === "rejected"
        ? "rejected"
        : null;
    if (!action) {
      throw new CashGatewayRequestError(
        "Cash retry returned an unsupported state.",
        false,
      );
    }
    this.assertExternalRequestMatches(before, external, action);

    const cashRequest = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashRequest.update({
        where: { id: before.id },
        data: action === "approved"
          ? {
              status: CashRequestStatus.cash_confirmed,
              externalCashRequestId: external.id,
              externalCashEventId: external.externalEventId,
              externalCashTransactionId: external.createdTransactionId,
              cashConfirmedAt: external.approvedAt
                ? new Date(external.approvedAt)
                : new Date(),
              rejectionReason: null,
              syncAttemptCount: { increment: 1 },
              lastSyncAttemptAt: new Date(),
              lastSyncError: null,
            }
          : {
              status: CashRequestStatus.cash_rejected,
              externalCashRequestId: external.id,
              externalCashEventId: external.externalEventId,
              externalCashTransactionId: null,
              cashConfirmedAt: null,
              rejectionReason: external.rejectedReason,
              syncAttemptCount: { increment: 1 },
              lastSyncAttemptAt: new Date(),
              lastSyncError: null,
            },
        select: cashRequestSelect,
      });

      if (before.incomeRecordId) {
        await tx.incomeRecord.update({
          where: { id: before.incomeRecordId },
          data: action === "approved"
            ? {
                recordStatus: IncomeRecordStatus.cash_confirmed,
                cashStatus: CashRequestStatus.cash_confirmed,
              }
            : { cashStatus: CashRequestStatus.cash_rejected },
        });
      }
      if (before.expenseRecordId) {
        await tx.expenseRecord.update({
          where: { id: before.expenseRecordId },
          data: action === "approved"
            ? {
                recordStatus: ExpenseRecordStatus.cash_confirmed,
                cashStatus: CashRequestStatus.cash_confirmed,
              }
            : { cashStatus: CashRequestStatus.cash_rejected },
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_request.external_reconcile",
          targetType: "cash_request",
          targetId: before.id,
          riskLevel: AuditRiskLevel.critical,
          beforeSnapshot: before,
          afterSnapshot: updated,
          metadata: {
            externalCashRequestId: external.id,
            externalStatus: external.status,
          },
        },
        tx,
      );

      return updated;
    });

    return {
      cashRequest,
      integrationMode: "supabase" as const,
      reconciled: true,
    };
  }

  private buildExternalPayload(before: CashRequestSnapshot, amount: number) {
    return {
      schema_version: 1,
      school_system: "aozora_school_v3",
      local_cash_request_id: before.id,
      external_source: "aozora_school",
      external_event_id: before.id,
      external_reference_type: before.direction === CashRequestDirection.income
        ? "school_income_records"
        : "school_expense_records",
      external_reference_id: before.incomeRecordId ?? before.expenseRecordId,
      request_type: before.direction === CashRequestDirection.income
        ? "income_received"
        : "expense_paid",
      transaction_type: before.direction,
      source_type: before.sourceType,
      source_id: before.sourceId,
      year_month: before.incomeRecord?.yearMonth ?? before.expenseRecord?.yearMonth,
      original_currency: before.expectedCurrency,
      original_amount_jpy: before.expectedAmountJpy,
      original_amount_cny: before.expectedAmountCny?.toNumber() ?? null,
      carryover_amount_cny: before.carryoverAmountCny?.toNumber() ?? null,
      currency: before.requestedCurrency,
      amount,
      account_id: before.cashAccountId,
      account_name_snapshot: before.cashAccountNameSnapshot,
      account_type_snapshot: before.cashAccountTypeSnapshot,
      transacted_at: before.cashTransactedAt?.toISOString().slice(0, 10),
      exchange_rate: before.exchangeRate?.toNumber() ?? null,
      exchange_rate_source: before.exchangeRateSource,
      conversion_method: before.conversionMethod,
      note: before.incomeRecord?.memo ?? before.expenseRecord?.memo ?? null,
    };
  }

  private assertExternalRequestMatches(
    local: CashRequestSnapshot,
    external: CashExternalRequest,
    action: "approved" | "rejected",
  ) {
    const isIncome = local.direction === CashRequestDirection.income;
    const referenceId = local.incomeRecordId ?? local.expenseRecordId;
    const amount = local.requestedCurrency === CurrencyCode.JPY
      ? local.requestedAmountJpy
      : local.requestedAmountCny?.toNumber();
    const expectedStatus = action;

    const matches =
      external.externalSource === "aozora_school" &&
      external.externalEventId === local.id &&
      external.externalReferenceType === (isIncome
        ? "school_income_records"
        : "school_expense_records") &&
      external.externalReferenceId === referenceId &&
      external.requestType === (isIncome ? "income_received" : "expense_paid") &&
      external.transactionType === local.direction &&
      external.currency === local.requestedCurrency &&
      external.amount === amount &&
      external.accountId === local.cashAccountId &&
      external.status === expectedStatus;

    if (!matches) {
      throw new ConflictException("Cash callback does not match the V3 request snapshot.");
    }
    if (action === "approved" && !external.createdTransactionId) {
      throw new ConflictException("Approved Cash request has no transaction ID.");
    }
    if (action === "rejected" && external.createdTransactionId) {
      throw new ConflictException("Rejected Cash request must not have a transaction ID.");
    }
  }

  async rejectCashRequest(
    id: string,
    body: RejectCashRequestBody,
    actorUserId: string,
  ) {
    if (this.cashGateway.mode === "supabase") {
      throw new BadRequestException(
        "Cash rejection is owned by the external Cash System callback.",
      );
    }

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
      let expenseRecord: ExpenseRecordSnapshot | null = null;
      if (before.incomeRecordId) {
        incomeRecord = await tx.incomeRecord.update({
          where: { id: before.incomeRecordId },
          data: { cashStatus: CashRequestStatus.cash_rejected },
          select: incomeRecordSelect,
        });
      }
      if (before.expenseRecordId) {
        expenseRecord = await tx.expenseRecord.update({
          where: { id: before.expenseRecordId },
          data: { cashStatus: CashRequestStatus.cash_rejected },
          select: expenseRecordSelect,
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
          afterSnapshot: { cashRequest, incomeRecord, expenseRecord },
        },
        tx,
      );

      return { cashRequest, incomeRecord, expenseRecord };
    });

    return result;
  }

  async withdrawCashRequest(
    id: string,
    body: WithdrawCashRequestBody,
    actorUserId: string,
  ) {
    if (this.cashGateway.mode === "supabase") {
      throw new BadRequestException(
        "Submitted external Cash requests cannot be withdrawn until Cash supports cancellation.",
      );
    }

    const before = await this.findCashRequest(id);

    if (before.status !== CashRequestStatus.cash_requested) {
      throw new BadRequestException("Only requested Cash request can be withdrawn.");
    }

    const reason = this.normalizeOptionalString(body.reason);

    const result = await this.prisma.$transaction(async (tx) => {
      const cashRequest = await tx.cashRequest.update({
        where: { id },
        data: {
          status: CashRequestStatus.cash_withdrawn,
          rejectionReason: reason,
        },
        select: cashRequestSelect,
      });

      let incomeRecord: IncomeRecordSnapshot | null = null;
      let expenseRecord: ExpenseRecordSnapshot | null = null;
      if (before.incomeRecordId) {
        incomeRecord = await tx.incomeRecord.update({
          where: { id: before.incomeRecordId },
          data: { cashStatus: CashRequestStatus.not_requested },
          select: incomeRecordSelect,
        });
      }
      if (before.expenseRecordId) {
        expenseRecord = await tx.expenseRecord.update({
          where: { id: before.expenseRecordId },
          data: { cashStatus: CashRequestStatus.not_requested },
          select: expenseRecordSelect,
        });
      }

      await this.auditService.recordEvent(
        {
          actorUserId,
          action: "cash_request.withdraw",
          targetType: "cash_request",
          targetId: id,
          riskLevel: AuditRiskLevel.high,
          reason,
          beforeSnapshot: before,
          afterSnapshot: { cashRequest, incomeRecord, expenseRecord },
        },
        tx,
      );

      return { cashRequest, incomeRecord, expenseRecord };
    });

    return result;
  }

  async confirmCashRequest(
    id: string,
    body: ConfirmCashRequestBody,
    actorUserId: string,
  ) {
    if (this.cashGateway.mode === "supabase") {
      throw new BadRequestException(
        "Cash confirmation is owned by the external Cash System callback.",
      );
    }

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
      let expenseRecord: ExpenseRecordSnapshot | null = null;
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
      if (before.expenseRecordId) {
        expenseRecord = await tx.expenseRecord.update({
          where: { id: before.expenseRecordId },
          data: {
            recordStatus: ExpenseRecordStatus.cash_confirmed,
            cashStatus: CashRequestStatus.cash_confirmed,
          },
          select: expenseRecordSelect,
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
          afterSnapshot: { cashRequest, incomeRecord, expenseRecord },
        },
        tx,
      );

      return { cashRequest, incomeRecord, expenseRecord };
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

  private assertExpenseCanRequestCash(expenseRecord: ExpenseRecordSnapshot) {
    if (expenseRecord.recordStatus !== ExpenseRecordStatus.pending) {
      throw new BadRequestException("Only pending expense can submit Cash request.");
    }

    if (
      expenseRecord.cashStatus !== CashRequestStatus.not_requested &&
      expenseRecord.cashStatus !== CashRequestStatus.cash_rejected
    ) {
      throw new BadRequestException("Expense Cash status does not allow request.");
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

  private calculateExpenseRequestAmounts(
    expenseRecord: ExpenseRecordSnapshot,
    input: ReturnType<CashService["normalizeSubmitInput"]>,
  ) {
    if (input.requestedCurrency === CurrencyCode.JPY) {
      if (
        expenseRecord.originalCurrency !== CurrencyCode.JPY ||
        expenseRecord.originalAmountJpy === null
      ) {
        throw new BadRequestException("Expense cannot request JPY.");
      }

      return {
        requestedAmountJpy: this.moneyService.confirmAmount({
          amount: expenseRecord.originalAmountJpy,
          currency: "JPY",
        }),
        requestedAmountCny: null,
      };
    }

    if (expenseRecord.originalCurrency === CurrencyCode.CNY) {
      if (!expenseRecord.originalAmountCny) {
        throw new BadRequestException("CNY expense amount is missing.");
      }

      return {
        requestedAmountJpy: null,
        requestedAmountCny: new Prisma.Decimal(
          this.moneyService.confirmAmount({
            amount: expenseRecord.originalAmountCny.toNumber(),
            currency: "CNY",
          }),
        ),
      };
    }

    if (!expenseRecord.originalAmountJpy) {
      throw new BadRequestException("JPY expense amount is missing.");
    }

    if (!input.exchangeRate) {
      throw new BadRequestException("exchangeRate is required for CNY request.");
    }

    return {
      requestedAmountJpy: null,
      requestedAmountCny: new Prisma.Decimal(
        this.moneyService.convertJpyToCny({
          jpyAmount: expenseRecord.originalAmountJpy,
          exchangeRate: input.exchangeRate,
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

  private async findExpenseRecord(id: string): Promise<ExpenseRecordSnapshot> {
    const expenseRecord = await this.prisma.expenseRecord.findUnique({
      where: { id },
      select: expenseRecordSelect,
    });

    if (!expenseRecord) {
      throw new NotFoundException("Expense record not found.");
    }

    return expenseRecord;
  }

  private buildWhere(query: ListCashRequestsQuery): Prisma.CashRequestWhereInput {
    const status = this.normalizeCashStatus(query.status);
    const direction = this.normalizeDirection(query.direction);
    const incomeRecordId = this.normalizeOptionalString(query.incomeRecordId);
    const expenseRecordId = this.normalizeOptionalString(query.expenseRecordId);
    const sourceType = this.normalizeOptionalString(query.sourceType);
    const keyword = this.normalizeOptionalString(query.keyword);

    return {
      ...(status ? { status } : {}),
      ...(direction ? { direction } : {}),
      ...(incomeRecordId ? { incomeRecordId } : {}),
      ...(expenseRecordId ? { expenseRecordId } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(keyword
        ? {
            OR: [
              { cashAccountCode: { contains: keyword, mode: "insensitive" } },
              { incomeRecord: { title: { contains: keyword, mode: "insensitive" } } },
              { expenseRecord: { title: { contains: keyword, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private normalizeSubmitInput(body: SubmitIncomeCashRequestBody) {
    const requestedCurrency = this.normalizeCurrency(body.requestedCurrency);
    const fallbackAccountId = this.normalizeOptionalString(body.cashAccountCode);
    const cashAccountId = this.normalizeOptionalString(body.cashAccountId) ??
      (fallbackAccountId && this.isUuid(fallbackAccountId)
        ? fallbackAccountId
        : null);
    const transactedAt = body.transactedAt === undefined || body.transactedAt === null || body.transactedAt === ""
      ? this.cashGateway.mode === "mock"
        ? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
        : null
      : this.normalizeDate(body.transactedAt, "transactedAt");

    if (!transactedAt) {
      throw new BadRequestException("transactedAt is required.");
    }

    return {
      requestedCurrency,
      exchangeRate:
        body.exchangeRate === undefined || body.exchangeRate === null || body.exchangeRate === ""
          ? null
          : this.normalizeExchangeRate(body.exchangeRate),
      exchangeRateSource:
        this.normalizeOptionalString(body.exchangeRateSource)?.toLowerCase() ??
        null,
      conversionMethod: this.normalizeConversionMethod(body.conversionMethod),
      cashAccountId,
      transactedAt,
      note: this.normalizeOptionalString(body.note),
    };
  }

  private async resolveEligibleAccount(
    accountId: string | null,
    currency: CurrencyCode,
  ): Promise<CashEligibleAccount> {
    if (this.cashGateway.mode === "disabled") {
      throw new ServiceUnavailableException("Cash integration is disabled.");
    }

    const accounts = await this.cashGateway.listEligibleAccounts();
    const resolved = accountId
      ? accounts.find((account) => account.id === accountId)
      : this.cashGateway.mode === "mock"
        ? accounts.find((account) => account.currency === currency)
        : null;

    if (!resolved) {
      throw new BadRequestException("An eligible Cash account is required.");
    }
    if (resolved.currency !== currency) {
      throw new BadRequestException(
        "Cash account currency must match requested currency.",
      );
    }

    return resolved;
  }

  private normalizeDate(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD.`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${fieldName} is invalid.`);
    }
    return date;
  }

  private normalizeRequiredUuid(value: unknown, fieldName: string) {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized || !this.isUuid(normalized)) {
      throw new BadRequestException(`${fieldName} must be a UUID.`);
    }
    return normalized;
  }

  private normalizeRequiredUuidArray(value: unknown, fieldName: string) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(`${fieldName} must be a non-empty UUID array.`);
    }
    return [...new Set(
      value.map((item) => this.normalizeRequiredUuid(item, fieldName)),
    )];
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private normalizeCallbackAction(value: unknown): "approved" | "rejected" {
    if (value !== "approved" && value !== "rejected") {
      throw new BadRequestException("action must be approved or rejected.");
    }
    return value;
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
