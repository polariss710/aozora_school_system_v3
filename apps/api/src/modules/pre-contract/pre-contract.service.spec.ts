import { describe, expect, it } from "vitest";
import { MoneyService } from "../money/money.service";
import { PreContractService } from "./pre-contract.service";

describe("PreContractService quote calculation", () => {
  const service = new PreContractService({} as never, {} as never, new MoneyService());

  it("uses Monday anchors and creates no formal teaching or finance objects", () => {
    const input = (service as any).normalize({
      prospectiveStudentName: "报价测试学生",
      title: "课程计划",
      courseTrack: "science",
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      exchangeRate: 0.05,
      courses: [{ name: "日语", hoursPerSession: 2, weeklyFrequency: 2, unitPriceJpy: 10000 }],
    });
    const result = (service as any).calculate(input);

    expect(result).toMatchObject({ totalHours: 8, totalJpy: 80000, totalCny: 4000 });
    expect(result.snapshot).toMatchObject({ calculationVersion: "quote_v1", weekAnchor: "monday" });
    expect(result.snapshot.rows).toEqual([
      expect.objectContaining({ weekAnchorDate: "2026-07-06", occurrence: 0, hours: 2, amountJpy: 20000 }),
      expect.objectContaining({ weekAnchorDate: "2026-07-06", occurrence: 1, hours: 2, amountJpy: 20000 }),
      expect.objectContaining({ weekAnchorDate: "2026-07-13", occurrence: 0, hours: 2, amountJpy: 20000 }),
      expect.objectContaining({ weekAnchorDate: "2026-07-13", occurrence: 1, hours: 2, amountJpy: 20000 }),
    ]);
  });

  it("allows a zero-priced quote but rejects fractional weekly frequency", () => {
    expect(() => (service as any).normalize({
      prospectiveStudentName: "免费试听",
      courseTrack: "humanities",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      exchangeRate: 0.05,
      courses: [{ name: "数学", hoursPerSession: 1, weeklyFrequency: 1, unitPriceJpy: 0 }],
    })).not.toThrow();
    expect(() => (service as any).normalize({
      prospectiveStudentName: "频次测试",
      courseTrack: "humanities",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      exchangeRate: 0.05,
      courses: [{ name: "数学", hoursPerSession: 1, weeklyFrequency: 1.5, unitPriceJpy: 100 }],
    })).toThrow("course.weeklyFrequency must be a whole number.");
  });

  it("normalizes a decimal exchange-rate text at the API boundary", () => {
    const input = (service as any).normalize({
      prospectiveStudentName: "汇率文本测试",
      courseTrack: "science",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      exchangeRate: "0.05123",
      courses: [{ name: "日语", hoursPerSession: 1, weeklyFrequency: 1, unitPriceJpy: 10000 }],
    });

    expect(input.exchangeRate).toBe(0.05123);
  });

  it("persists a removed plan row in the quote snapshot and recalculates only the draft quote totals", () => {
    const input = (service as any).normalize({
      prospectiveStudentName: "请假测试",
      courseTrack: "science",
      startDate: "2026-07-01",
      endDate: "2026-07-14",
      exchangeRate: 0.05,
      courses: [{ name: "日语", hoursPerSession: 2, weeklyFrequency: 2, unitPriceJpy: 10000 }],
    });
    const calculation = (service as any).calculate(input);
    const adjusted = (service as any).applyRemovedRows(
      calculation.snapshot,
      input.exchangeRate,
      ["course:0:date:2026-07-06:slot:1"],
    );

    expect(adjusted).toMatchObject({ totalHours: 6, totalJpy: 60000, totalCny: 3000 });
    expect(adjusted.snapshot.removedRowKeys).toEqual(["course:0:date:2026-07-06:slot:1"]);
    expect(adjusted.snapshot.rows).toHaveLength(4);
  });
});
