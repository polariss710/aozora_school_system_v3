export type ListExternalWorkLessonsQuery = {
  workplaceId?: unknown;
  yearMonth?: unknown;
  lessonType?: unknown;
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type ExternalWorkLessonBody = {
  workplaceId?: unknown;
  lessonDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  durationHours?: unknown;
  instructorName?: unknown;
  lessonTitle?: unknown;
  hourlyRateJpy?: unknown;
  transportationFeeJpy?: unknown;
  content?: unknown;
  memo?: unknown;
  sourceType?: unknown;
  sourceId?: unknown;
};

export type GenerateExternalWorkActualBody = Partial<ExternalWorkLessonBody>;

export type ListExternalWorkSettlementsQuery = {
  workplaceId?: unknown;
  yearMonth?: unknown;
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type PreviewExternalWorkSettlementBody = {
  workplaceId?: unknown;
  yearMonth?: unknown;
  adjustmentAmountJpy?: unknown;
};

export type LockExternalWorkSettlementBody = PreviewExternalWorkSettlementBody & {
  memo?: unknown;
};

export type RevokeExternalWorkSettlementBody = {
  reason?: unknown;
};

export type GenerateExternalWorkIncomeBody = {
  memo?: unknown;
};
