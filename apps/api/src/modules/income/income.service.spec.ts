import {
  AccountTransactionDirection,
  AccountTransactionStatus,
  CashRequestStatus,
  CurrencyCode,
  IncomeRecordStatus,
  TuitionBillStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../database/prisma.service";
import { MoneyService } from "../money/money.service";
import { IncomeService } from "./income.service";

function buildService(prisma: unknown) {
  return new IncomeService(
    prisma as PrismaService,
    new MoneyService(),
    { recordEvent: vi.fn() } as unknown as AuditService,
  );
}

function buildIncomeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "income-1",
    sourceType: "student_tuition_bill",
    sourceId: "bill-1",
    studentId: "student-1",
    businessEntityId: "entity-1",
    yearMonth: "2026-07",
    title: "2026-07 学费",
    originalCurrency: CurrencyCode.JPY,
    originalAmountJpy: 18000,
    originalAmountCny: null,
    carryoverAmountCny: null,
    recordStatus: IncomeRecordStatus.cash_confirmed,
    cashStatus: CashRequestStatus.cash_confirmed,
    memo: "七月学费",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-10T00:00:00.000Z"),
    student: { id: "student-1", code: "S001", name: "测试学生" },
    businessEntity: { id: "entity-1", code: "aozora_school", name: "青空进学塾" },
    tuitionBill: {
      id: "bill-1",
      status: TuitionBillStatus.income_created,
      plannedAmountJpy: 18000,
      carryoverAmountCny: null,
    },
    cashRequests: [
      {
        id: "cash-request-1",
        status: CashRequestStatus.cash_confirmed,
        requestedCurrency: CurrencyCode.JPY,
        requestedAmountJpy: 17500,
        requestedAmountCny: null,
        externalCashRequestId: "external-request-1",
        externalCashEventId: "external-event-1",
        updatedAt: new Date("2026-07-08T12:00:00.000Z"),
      },
    ],
    accountTransactions: [],
    ...overrides,
  };
}

describe("IncomeService tuition receipt", () => {
  it("uses the active account transaction as the authoritative receipt amount and date", async () => {
    const record = buildIncomeRecord({
      cashStatus: CashRequestStatus.account_transaction_created,
      accountTransactions: [
        {
          id: "transaction-1",
          direction: AccountTransactionDirection.in,
          status: AccountTransactionStatus.active,
          transactionDate: new Date("2026-07-09T00:00:00.000Z"),
          currency: CurrencyCode.JPY,
          amountJpy: 17200,
          amountCny: null,
          externalEventId: "posted-event-1",
        },
      ],
    });
    const prisma = {
      incomeRecord: { findUnique: vi.fn().mockResolvedValue(record) },
      cashInboundEvent: { findFirst: vi.fn() },
    };

    const result = await buildService(prisma).getTuitionReceipt("income-1");

    expect(result.receipt.paymentAmountJpy).toBe(17200);
    expect(result.receipt.paymentDate).toBe("2026-07-09");
    expect(result.receipt.authoritySource).toBe("account_transaction");
    expect(result.receipt.description).toBe("2026年7月 学费");
    expect(prisma.cashInboundEvent.findFirst).not.toHaveBeenCalled();
  });

  it("uses the confirmed Cash request amount and linked inbound date before a direct transaction exists", async () => {
    const prisma = {
      incomeRecord: { findUnique: vi.fn().mockResolvedValue(buildIncomeRecord()) },
      cashInboundEvent: {
        findFirst: vi.fn().mockResolvedValue({
          id: "inbound-1",
          externalCashEventId: "inbound-event-1",
          eventDate: new Date("2026-07-11T00:00:00.000Z"),
        }),
      },
    };

    const result = await buildService(prisma).getTuitionReceipt("income-1");

    expect(result.receipt.paymentAmountJpy).toBe(17500);
    expect(result.receipt.paymentDate).toBe("2026-07-11");
    expect(result.receipt.authoritySource).toBe("cash_inbound");
    expect(result.receipt.externalCashEventId).toBe("inbound-event-1");
  });

  it("rejects a tuition income that has not been Cash confirmed", async () => {
    const prisma = {
      incomeRecord: {
        findUnique: vi.fn().mockResolvedValue(
          buildIncomeRecord({
            recordStatus: IncomeRecordStatus.pending,
            cashStatus: CashRequestStatus.cash_requested,
            cashRequests: [],
          }),
        ),
      },
    };

    await expect(buildService(prisma).getTuitionReceipt("income-1")).rejects.toThrow(
      "该收入尚未完成 Cash 确认",
    );
  });

  it("returns receipt eligibility with the income list", async () => {
    const prisma = {
      incomeRecord: {
        findMany: vi.fn().mockResolvedValue([
          buildIncomeRecord(),
          buildIncomeRecord({ id: "income-2", sourceType: "manual_income" }),
        ]),
        count: vi.fn().mockResolvedValue(2),
      },
    };

    const result = await buildService(prisma).listIncomeRecords({});

    expect(result.items[0].receiptEligible).toBe(true);
    expect(result.items[1].receiptEligible).toBe(false);
    expect(result.items[1].receiptIneligibleReason).toContain("仅学费收入");
  });
});
