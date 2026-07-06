import {
  AccountTransactionStatus,
  AccountType,
  CashInboundEventStatus,
  CashRequestStatus,
  CurrencyCode,
  IncomeRecordStatus,
  RecordStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { CashInboundService } from "./cash-inbound.service";

function buildService(prisma: unknown, audit: unknown = { recordEvent: vi.fn() }) {
  return new CashInboundService(
    prisma as PrismaService,
    new MoneyService(),
    audit as AuditService,
  );
}

describe("CashInboundService", () => {
  it("marks linked Cash-confirmed income records as posted when creating inbound event", async () => {
    const tx = {
      accountTransaction: {
        create: vi.fn().mockResolvedValue({ id: "account-transaction-1" }),
      },
      cashInboundEvent: {
        create: vi.fn().mockResolvedValue({
          id: "cash-inbound-1",
          linkedIncomeRecordIds: ["income-1", "income-2"],
        }),
      },
      incomeRecord: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const prisma = {
      cashInboundEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      account: {
        findFirst: vi.fn().mockResolvedValue({
          id: "corporate-account-1",
          code: "corp-jpy",
          name: "法人JPY",
          type: AccountType.corporate,
          currency: CurrencyCode.JPY,
          status: RecordStatus.active,
        }),
      },
      incomeRecord: {
        count: vi.fn().mockResolvedValue(2),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const service = buildService(prisma);

    await service.createEvent(
      {
        externalCashEventId: "cash-event-1",
        corporateAccountId: "corporate-account-1",
        eventDate: "2026-07-06",
        sourceCurrency: CurrencyCode.CNY,
        sourceAmountCny: 5000,
        targetCurrency: CurrencyCode.JPY,
        targetAmountJpy: 150000,
        linkedIncomeRecordIds: ["income-1", "income-2"],
      },
      "actor-1",
    );

    expect(tx.incomeRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["income-1", "income-2"] },
        recordStatus: IncomeRecordStatus.cash_confirmed,
        cashStatus: CashRequestStatus.cash_confirmed,
      },
      data: { cashStatus: CashRequestStatus.account_transaction_created },
    });
  });

  it("restores linked income records to Cash confirmed when rejecting inbound event", async () => {
    const before = {
      id: "cash-inbound-1",
      accountTransactionId: "account-transaction-1",
      linkedIncomeRecordIds: ["income-1", "income-2"],
      status: CashInboundEventStatus.account_transaction_created,
      memo: "before memo",
      accountTransaction: {
        id: "account-transaction-1",
        status: AccountTransactionStatus.active,
      },
    };

    const tx = {
      accountTransaction: {
        update: vi.fn().mockResolvedValue({ id: "account-transaction-1" }),
      },
      incomeRecord: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      cashInboundEvent: {
        update: vi.fn().mockResolvedValue({
          ...before,
          status: CashInboundEventStatus.rejected,
        }),
      },
    };

    const prisma = {
      cashInboundEvent: {
        findUnique: vi.fn().mockResolvedValue(before),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    const service = buildService(prisma);

    await service.rejectEvent(
      "cash-inbound-1",
      { reason: "cash side rejected" },
      "actor-1",
    );

    expect(tx.incomeRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["income-1", "income-2"] },
        recordStatus: IncomeRecordStatus.cash_confirmed,
        cashStatus: CashRequestStatus.account_transaction_created,
      },
      data: { cashStatus: CashRequestStatus.cash_confirmed },
    });
  });
});
