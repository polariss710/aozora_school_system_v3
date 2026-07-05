export type ListExpenseRecordsQuery = {
  teacherId?: unknown;
  businessEntityId?: unknown;
  yearMonth?: unknown;
  sourceType?: unknown;
  recordStatus?: unknown;
  cashStatus?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type CreateExpenseFromWageBody = {
  memo?: unknown;
};

export type ManualExpenseBody = {
  businessEntityId?: unknown;
  yearMonth?: unknown;
  title?: unknown;
  originalCurrency?: unknown;
  originalAmountJpy?: unknown;
  originalAmountCny?: unknown;
  memo?: unknown;
};

export type VoidExpenseRecordBody = {
  reason?: unknown;
};
