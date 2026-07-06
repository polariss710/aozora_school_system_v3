export type ListIncomeRecordsQuery = {
  yearMonth?: unknown;
  studentId?: unknown;
  businessEntityId?: unknown;
  recordStatus?: unknown;
  cashStatus?: unknown;
  sourceType?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type ManualIncomeBody = {
  studentId?: unknown;
  businessEntityId?: unknown;
  yearMonth?: unknown;
  title?: unknown;
  originalCurrency?: unknown;
  originalAmountJpy?: unknown;
  originalAmountCny?: unknown;
  memo?: unknown;
};

export type VoidIncomeRecordBody = {
  reason?: unknown;
};
