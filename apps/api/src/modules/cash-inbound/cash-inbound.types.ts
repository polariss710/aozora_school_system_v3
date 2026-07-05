export type ListCashInboundEventsQuery = {
  status?: unknown;
  eventType?: unknown;
  corporateAccountId?: unknown;
  externalCashEventId?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type CreateCashInboundEventBody = {
  externalCashEventId?: unknown;
  eventType?: unknown;
  corporateAccountId?: unknown;
  eventDate?: unknown;
  sourceCurrency?: unknown;
  sourceAmountJpy?: unknown;
  sourceAmountCny?: unknown;
  targetCurrency?: unknown;
  targetAmountJpy?: unknown;
  targetAmountCny?: unknown;
  exchangeRate?: unknown;
  feeCurrency?: unknown;
  feeAmountJpy?: unknown;
  feeAmountCny?: unknown;
  linkedIncomeRecordIds?: unknown;
  memo?: unknown;
};
