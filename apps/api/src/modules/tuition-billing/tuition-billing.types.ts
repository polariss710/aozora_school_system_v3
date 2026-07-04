export type GenerateTuitionBillBody = {
  studentId?: unknown;
  yearMonth?: unknown;
};

export type ListTuitionBillsQuery = {
  yearMonth?: unknown;
  studentId?: unknown;
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};
