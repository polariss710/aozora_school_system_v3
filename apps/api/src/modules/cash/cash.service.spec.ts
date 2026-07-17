import {
  CashRequestDirection,
  CashRequestStatus,
  CurrencyCode,
  IncomeRecordStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../audit/audit.service";
import { CashInboundService } from "../cash-inbound/cash-inbound.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { CashGateway } from "./cash.gateway";
import { CashService } from "./cash.service";

const localRequest = {
  id: "44444444-4444-4444-8444-444444444444",
  direction: CashRequestDirection.income,
  sourceType: "student_tuition_bill",
  sourceId: "bill-1",
  incomeRecordId: "55555555-5555-4555-8555-555555555555",
  expenseRecordId: null,
  status: CashRequestStatus.cash_requested,
  expectedCurrency: CurrencyCode.JPY,
  expectedAmountJpy: 6000,
  expectedAmountCny: null,
  carryoverAmountCny: null,
  requestedCurrency: CurrencyCode.JPY,
  requestedAmountJpy: 6000,
  requestedAmountCny: null,
  exchangeRate: null,
  exchangeRateSource: null,
  conversionMethod: "half-up",
  cashAccountCode: "日元现金",
  cashAccountId: "22222222-2222-4222-8222-222222222222",
  cashAccountNameSnapshot: "日元现金",
  cashAccountTypeSnapshot: "cash",
  cashTransactedAt: new Date("2026-07-16T00:00:00.000Z"),
  externalCashRequestId: "33333333-3333-4333-8333-333333333333",
  externalCashEventId: "44444444-4444-4444-8444-444444444444",
  externalCashTransactionId: null,
  cashConfirmedAt: null,
  rejectionReason: null,
  syncAttemptCount: 1,
  lastSyncAttemptAt: new Date("2026-07-16T00:00:00.000Z"),
  lastSyncError: null,
  createdAt: new Date("2026-07-16T00:00:00.000Z"),
  updatedAt: new Date("2026-07-16T00:00:00.000Z"),
  incomeRecord: {
    id: "55555555-5555-4555-8555-555555555555",
    title: "2026-07 学费",
    recordStatus: IncomeRecordStatus.pending,
    cashStatus: CashRequestStatus.cash_requested,
    originalCurrency: CurrencyCode.JPY,
    originalAmountJpy: 6000,
    originalAmountCny: null,
    carryoverAmountCny: null,
    yearMonth: "2026-07",
    memo: null,
  },
  expenseRecord: null,
};

const externalApproved = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: "11111111-1111-4111-8111-111111111111",
  externalSource: "aozora_school",
  externalEventId: "44444444-4444-4444-8444-444444444444",
  externalReferenceType: "school_income_records",
  externalReferenceId: "55555555-5555-4555-8555-555555555555",
  requestType: "income_received",
  transactionType: "income",
  currency: "JPY" as const,
  amount: 6000,
  accountId: "22222222-2222-4222-8222-222222222222",
  transactedAt: "2026-07-16",
  status: "approved" as const,
  approvedAt: "2026-07-16T01:00:00.000Z",
  rejectedAt: null,
  rejectedReason: null,
  createdTransactionId: "66666666-6666-4666-8666-666666666666",
};

describe("CashService external callback", () => {
  it("writes a verified approved Cash transaction back to the canonical income", async () => {
    const updatedRequest = {
      ...localRequest,
      status: CashRequestStatus.cash_confirmed,
      externalCashTransactionId: externalApproved.createdTransactionId,
    };
    const tx = {
      cashRequest: { update: vi.fn().mockResolvedValue(updatedRequest) },
      incomeRecord: {
        update: vi.fn().mockResolvedValue({
          ...localRequest.incomeRecord,
          recordStatus: IncomeRecordStatus.cash_confirmed,
          cashStatus: CashRequestStatus.cash_confirmed,
        }),
      },
      expenseRecord: { update: vi.fn() },
      auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };
    const prisma = {
      cashRequest: { findFirst: vi.fn().mockResolvedValue(localRequest) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const gateway = {
      mode: "supabase",
      verifyCallbackAccessToken: vi.fn().mockResolvedValue({
        userId: externalApproved.userId,
      }),
      getExternalRequest: vi.fn().mockResolvedValue(externalApproved),
      getCnyToJpyFx: vi.fn(),
      listEligibleAccounts: vi.fn(),
      createPendingRequest: vi.fn(),
    } satisfies CashGateway;
    const service = new CashService(
      prisma as unknown as PrismaService,
      new MoneyService(),
      new AuditService(prisma as unknown as PrismaService),
      gateway,
      { createEvent: vi.fn() } as unknown as CashInboundService,
    );

    const result = await service.applyExternalRequestResult(
      {
        cash_request_id: externalApproved.id,
        action: "approved",
      },
      "cash-user-token",
    );

    expect(result).toMatchObject({ ok: true, idempotent: false });
    expect(tx.cashRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CashRequestStatus.cash_confirmed,
          externalCashTransactionId: externalApproved.createdTransactionId,
        }),
      }),
    );
    expect(tx.incomeRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          recordStatus: IncomeRecordStatus.cash_confirmed,
          cashStatus: CashRequestStatus.cash_confirmed,
        },
      }),
    );
  });

  it("returns idempotent success for the same already-confirmed callback", async () => {
    const confirmed = {
      ...localRequest,
      status: CashRequestStatus.cash_confirmed,
      externalCashTransactionId: externalApproved.createdTransactionId,
    };
    const prisma = {
      cashRequest: { findFirst: vi.fn().mockResolvedValue(confirmed) },
      $transaction: vi.fn(),
    };
    const gateway = {
      mode: "supabase",
      verifyCallbackAccessToken: vi.fn().mockResolvedValue({
        userId: externalApproved.userId,
      }),
      getExternalRequest: vi.fn().mockResolvedValue(externalApproved),
      getCnyToJpyFx: vi.fn(),
      listEligibleAccounts: vi.fn(),
      createPendingRequest: vi.fn(),
    } satisfies CashGateway;
    const service = new CashService(
      prisma as unknown as PrismaService,
      new MoneyService(),
      { recordEvent: vi.fn() } as unknown as AuditService,
      gateway,
      { createEvent: vi.fn() } as unknown as CashInboundService,
    );

    const result = await service.applyExternalRequestResult(
      { cash_request_id: externalApproved.id, action: "approved" },
      "cash-user-token",
    );

    expect(result).toMatchObject({ ok: true, idempotent: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a verified School inbound event from an exact CNY to JPY FX allocation", async () => {
    const fx = {
      cnyTransactionId: "77777777-7777-4777-8777-777777777777",
      jpyTransactionId: "88888888-8888-4888-8888-888888888888",
      userId: "11111111-1111-4111-8111-111111111111",
      cnyAccountId: "22222222-2222-4222-8222-222222222222",
      jpyAccountId: "99999999-9999-4999-8999-999999999999",
      transactedAt: "2026-07-18",
      cnyAmount: 500,
      jpyAmount: 10000,
      description: "人民币购汇转日元",
      note: "School 学费归集",
    };
    const prisma = {
      cashRequest: {
        findMany: vi.fn().mockResolvedValue([{
          incomeRecordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          requestedAmountCny: new Prisma.Decimal(500),
          externalCashTransactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }]),
      },
    };
    const gateway = {
      mode: "supabase",
      verifyCallbackAccessToken: vi.fn().mockResolvedValue({ userId: fx.userId }),
      getCnyToJpyFx: vi.fn().mockResolvedValue(fx),
      getExternalRequest: vi.fn(),
      listEligibleAccounts: vi.fn(),
      createPendingRequest: vi.fn(),
    } satisfies CashGateway;
    const cashInboundService = {
      createEvent: vi.fn().mockResolvedValue({
        event: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
        idempotent: false,
      }),
    };
    const service = new CashService(
      prisma as unknown as PrismaService,
      new MoneyService(),
      { recordEvent: vi.fn() } as unknown as AuditService,
      gateway,
      cashInboundService as unknown as CashInboundService,
    );

    const result = await service.applyExternalFxInbound(
      {
        cash_cny_transaction_id: fx.cnyTransactionId,
        corporate_account_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        linked_income_record_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      },
      "cash-user-token",
    );

    expect(result).toMatchObject({ ok: true, idempotent: false });
    expect(cashInboundService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        externalCashEventId: fx.cnyTransactionId,
        eventType: "cash_cny_to_jpy_fx",
        corporateAccountId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        sourceAmountCny: 500,
        targetAmountJpy: 10000,
        linkedIncomeRecordIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      }),
      null,
    );
  });

  it("rejects an FX inbound allocation when confirmed income does not exactly total the CNY FX amount", async () => {
    const fx = {
      cnyTransactionId: "77777777-7777-4777-8777-777777777777",
      jpyTransactionId: "88888888-8888-4888-8888-888888888888",
      userId: "11111111-1111-4111-8111-111111111111",
      cnyAccountId: "22222222-2222-4222-8222-222222222222",
      jpyAccountId: "99999999-9999-4999-8999-999999999999",
      transactedAt: "2026-07-18",
      cnyAmount: 500,
      jpyAmount: 10000,
      description: "人民币购汇转日元",
      note: "",
    };
    const prisma = {
      cashRequest: {
        findMany: vi.fn().mockResolvedValue([{
          incomeRecordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          requestedAmountCny: new Prisma.Decimal(499),
          externalCashTransactionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }]),
      },
    };
    const gateway = {
      mode: "supabase",
      verifyCallbackAccessToken: vi.fn().mockResolvedValue({ userId: fx.userId }),
      getCnyToJpyFx: vi.fn().mockResolvedValue(fx),
      getExternalRequest: vi.fn(),
      listEligibleAccounts: vi.fn(),
      createPendingRequest: vi.fn(),
    } satisfies CashGateway;
    const cashInboundService = { createEvent: vi.fn() };
    const service = new CashService(
      prisma as unknown as PrismaService,
      new MoneyService(),
      { recordEvent: vi.fn() } as unknown as AuditService,
      gateway,
      cashInboundService as unknown as CashInboundService,
    );

    await expect(service.applyExternalFxInbound(
      {
        cash_cny_transaction_id: fx.cnyTransactionId,
        corporate_account_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        linked_income_record_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      },
      "cash-user-token",
    )).rejects.toThrow(
      "Linked confirmed income total must exactly match the Cash FX CNY amount.",
    );
    expect(cashInboundService.createEvent).not.toHaveBeenCalled();
  });
});
