export type ListLessonsQuery = {
  yearMonth?: unknown;
  studentId?: unknown;
  teacherId?: unknown;
  subjectId?: unknown;
  businessEntityId?: unknown;
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type PlannedLessonWriteBody = {
  studentId?: unknown;
  teacherId?: unknown;
  subjectId?: unknown;
  businessEntityId?: unknown;
  weekAnchorDate?: unknown;
  lessonNo?: unknown;
  plannedStartTime?: unknown;
  plannedEndTime?: unknown;
  durationHours?: unknown;
  plannedFeeJpy?: unknown;
  content?: unknown;
  memo?: unknown;
  sourceType?: unknown;
  sourceId?: unknown;
};

export type BatchPlannedLessonRuleBody = {
  teacherId?: unknown;
  subjectId?: unknown;
  weeklyCount?: unknown;
  firstLessonNo?: unknown;
  plannedStartTime?: unknown;
  plannedEndTime?: unknown;
  durationHours?: unknown;
  plannedFeeJpy?: unknown;
  content?: unknown;
  memo?: unknown;
};

export type BatchPlannedLessonsBody = {
  studentId?: unknown;
  businessEntityId?: unknown;
  startWeekAnchorDate?: unknown;
  endWeekAnchorDate?: unknown;
  rules?: unknown;
  sourceType?: unknown;
  sourceId?: unknown;
  memo?: unknown;
};

export type ActualLessonWriteBody = {
  teacherId?: unknown;
  actualDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  durationHours?: unknown;
  content?: unknown;
  memo?: unknown;
  teacherWageEligible?: unknown;
};

export type NormalizedPlannedLessonInput = {
  studentId: string;
  teacherId: string;
  subjectId: string;
  businessEntityId: string;
  yearMonth: string;
  weekAnchorDate: Date;
  lessonNo: number | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  durationHours: string;
  plannedFeeJpy: number;
  content: string | null;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
};

export type NormalizedBatchPlannedLessonRule = {
  teacherId: string;
  subjectId: string;
  weeklyCount: number;
  firstLessonNo: number;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  durationHours: string;
  plannedFeeJpy: number;
  content: string | null;
  memo: string | null;
};

export type NormalizedBatchPlannedLessonsInput = {
  studentId: string;
  businessEntityId: string;
  startWeekAnchorDate: Date;
  endWeekAnchorDate: Date;
  rules: NormalizedBatchPlannedLessonRule[];
  sourceType: string;
  sourceId: string | null;
  memo: string | null;
};

export type NormalizedActualLessonInput = {
  teacherId: string;
  yearMonth: string;
  actualDate: Date;
  startTime: string | null;
  endTime: string | null;
  durationHours: string;
  content: string | null;
  memo: string | null;
  teacherWageEligible: boolean;
};
