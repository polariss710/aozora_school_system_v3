export type GenerateTuitionBillBody = {
  studentId?: unknown;
  yearMonth?: unknown;
  expectedPreviewFingerprint?: unknown;
};

export type VoidTuitionBillBody = {
  reason?: unknown;
};

export type ListTuitionBillsQuery = {
  yearMonth?: unknown;
  studentId?: unknown;
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};
