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
  cashAccountId?: unknown;
  cashAccountCode?: unknown;
  transactedAt?: unknown;
  note?: unknown;
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

export type CashRequestResultCallbackBody = {
  cash_request_id?: unknown;
  action?: unknown;
};
