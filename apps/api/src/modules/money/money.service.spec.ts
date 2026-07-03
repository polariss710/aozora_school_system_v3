import { describe, expect, it } from "vitest";
import { MoneyService } from "./money.service";

describe("MoneyService", () => {
  const service = new MoneyService();

  it("confirms JPY as integer amounts", () => {
    expect(service.confirmAmount({ amount: 1234.5, currency: "JPY" })).toBe(1235);
    expect(service.confirmAmount({ amount: 1234.4, currency: "JPY" })).toBe(1234);
  });

  it("confirms CNY with two fraction digits", () => {
    expect(service.confirmAmount({ amount: 3.625, currency: "CNY" })).toBe(3.63);
    expect(service.confirmAmount({ amount: 3.624, currency: "CNY" })).toBe(3.62);
  });

  it("rounds negative half values away from zero", () => {
    expect(service.confirmAmount({ amount: -3.625, currency: "CNY" })).toBe(-3.63);
  });

  it("keeps positive and negative offsets at zero when they cancel", () => {
    const amount = service.confirmAmount({ amount: 100.005 + -100.005, currency: "CNY" });
    expect(amount).toBe(0);
  });

  it("converts JPY to CNY using backend rounding", () => {
    expect(
      service.convertJpyToCny({
        jpyAmount: 72000,
        exchangeRate: 0.04782,
        carryoverCny: 126.35,
      }),
    ).toBe(3569.39);
  });

  it("rejects mismatched submitted money amounts", () => {
    expect(() => {
      service.assertConfirmedAmount({ expected: 3.625, submitted: 3.62, currency: "CNY" });
    }).toThrow("Money amount mismatch");
  });
});
