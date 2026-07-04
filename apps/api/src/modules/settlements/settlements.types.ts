export type ListStudentSettlementsQuery = {
  yearMonth?: unknown;
  studentId?: unknown;
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type PreviewStudentSettlementBody = {
  studentId?: unknown;
  yearMonth?: unknown;
  settlementExchangeRate?: unknown;
  adjustmentAmountCny?: unknown;
};

export type LockStudentSettlementBody = PreviewStudentSettlementBody & {
  memo?: unknown;
};

export type RevokeStudentSettlementBody = {
  reason?: unknown;
};
