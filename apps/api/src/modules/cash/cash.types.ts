export type ListCashRequestsQuery = {
  status?: unknown;
  direction?: unknown;
  incomeRecordId?: unknown;
  expenseRecordId?: unknown;
  sourceType?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type SubmitIncomeCashRequestBody = {
  requestedCurrency?: unknown;
  exchangeRate?: unknown;
  exchangeRateSource?: unknown;
  conversionMethod?: unknown;
  cashAccountCode?: unknown;
};

export type SubmitExpenseCashRequestBody = SubmitIncomeCashRequestBody;

export type RejectCashRequestBody = {
  rejectionReason?: unknown;
  externalCashEventId?: unknown;
};

export type WithdrawCashRequestBody = {
  reason?: unknown;
};

export type ConfirmCashRequestBody = {
  externalCashRequestId?: unknown;
  externalCashEventId?: unknown;
};
