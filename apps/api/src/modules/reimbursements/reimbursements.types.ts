export type ListReimbursementsQuery = {
  status?: unknown;
  corporateAccountId?: unknown;
  advanceAccountId?: unknown;
  expenseRecordId?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type CreateReimbursementBody = {
  corporateAccountId?: unknown;
  reimbursementDate?: unknown;
  memo?: unknown;
};
