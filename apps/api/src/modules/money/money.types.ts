export type CurrencyCode = "JPY" | "CNY";

export type RoundingMode = "half-up" | "ceil" | "floor";

export interface ConfirmMoneyInput {
  amount: number;
  currency: CurrencyCode;
  roundingMode?: RoundingMode;
}
