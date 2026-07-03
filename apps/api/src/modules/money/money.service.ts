import { Injectable } from "@nestjs/common";
import Decimal from "decimal.js";
import type { ConfirmMoneyInput, CurrencyCode, RoundingMode } from "./money.types";

@Injectable()
export class MoneyService {
  getFractionDigits(currency: CurrencyCode): number {
    switch (currency) {
      case "JPY":
        return 0;
      case "CNY":
        return 2;
    }
  }

  confirmAmount(input: ConfirmMoneyInput): number {
    const fractionDigits = this.getFractionDigits(input.currency);
    return this.roundTo(input.amount, fractionDigits, input.roundingMode ?? "half-up");
  }

  convertJpyToCny(params: {
    jpyAmount: number;
    exchangeRate: number;
    carryoverCny?: number;
    roundingMode?: RoundingMode;
  }): number {
    const rawCny = new Decimal(params.jpyAmount)
      .mul(params.exchangeRate)
      .plus(params.carryoverCny ?? 0);

    return this.roundTo(rawCny, this.getFractionDigits("CNY"), params.roundingMode ?? "half-up");
  }

  assertConfirmedAmount(params: { expected: number; submitted: number; currency: CurrencyCode }): void {
    const fractionDigits = this.getFractionDigits(params.currency);
    const expected = this.roundTo(params.expected, fractionDigits, "half-up");
    const submitted = this.roundTo(params.submitted, fractionDigits, "half-up");

    if (expected !== submitted) {
      throw new Error(`Money amount mismatch: expected ${expected}, received ${submitted}`);
    }
  }

  private roundTo(amount: number | Decimal, fractionDigits: number, mode: RoundingMode): number {
    const decimal = new Decimal(amount);

    if (mode === "ceil") {
      return decimal.toDecimalPlaces(fractionDigits, Decimal.ROUND_CEIL).toNumber();
    }

    if (mode === "floor") {
      return decimal.toDecimalPlaces(fractionDigits, Decimal.ROUND_FLOOR).toNumber();
    }

    return decimal.toDecimalPlaces(fractionDigits, Decimal.ROUND_HALF_UP).toNumber();
  }
}
