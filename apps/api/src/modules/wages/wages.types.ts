export type ListTeacherWageRulesQuery = {
  teacherId?: unknown;
  businessEntityId?: unknown;
  status?: unknown;
  limit?: unknown;
};

export type TeacherWageRuleBody = {
  teacherId?: unknown;
  businessEntityId?: unknown;
  hourlyRateJpy?: unknown;
  memo?: unknown;
};

export type ListTeacherWageSnapshotsQuery = {
  teacherId?: unknown;
  businessEntityId?: unknown;
  yearMonth?: unknown;
  status?: unknown;
  adjustmentStatus?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type PreviewTeacherWageBody = {
  teacherId?: unknown;
  yearMonth?: unknown;
  businessEntityId?: unknown;
};

export type LockTeacherWageBody = PreviewTeacherWageBody & {
  memo?: unknown;
};

export type UpdateTeacherWageAdjustmentsBody = {
  transportationFeeJpy?: unknown;
  classroomFeeJpy?: unknown;
  manualAdjustmentJpy?: unknown;
  memo?: unknown;
};

export type ConfirmTeacherWageAdjustmentsBody = {
  memo?: unknown;
};

export type RevokeTeacherWageSnapshotBody = {
  reason?: unknown;
};
