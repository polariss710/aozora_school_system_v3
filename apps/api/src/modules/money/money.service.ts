import { Injectable } from "@nestjs/common";
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
    const rawCny = params.jpyAmount * params.exchangeRate + (params.carryoverCny ?? 0);
    return this.confirmAmount({
      amount: rawCny,
      currency: "CNY",
      roundingMode: params.roundingMode,
    });
  }

  assertConfirmedAmount(params: { expected: number; submitted: number; currency: CurrencyCode }): void {
    const fractionDigits = this.getFractionDigits(params.currency);
    const expected = this.roundTo(params.expected, fractionDigits, "half-up");
    const submitted = this.roundTo(params.submitted, fractionDigits, "half-up");

    if (expected !== submitted) {
      throw new Error(`Money amount mismatch: expected ${expected}, received ${submitted}`);
    }
  }

  private roundTo(amount: number, fractionDigits: number, mode: RoundingMode): number {
    const scale = 10 ** fractionDigits;
    const scaled = amount * scale;

    if (mode === "ceil") {
      return Math.ceil(scaled) / scale;
    }

    if (mode === "floor") {
      return Math.floor(scaled) / scale;
    }

    return this.roundHalfUp(scaled) / scale;
  }

  private roundHalfUp(value: number): number {
    if (value >= 0) {
      return Math.floor(value + 0.5);
    }

    return Math.ceil(value - 0.5);
  }
}
