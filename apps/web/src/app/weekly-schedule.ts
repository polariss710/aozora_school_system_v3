import type { StudentPlannedLessonRecord } from "./api";

export function plannedLessonsForScheduleWeek(
  plannedLessons: StudentPlannedLessonRecord[],
  weekAnchorDate: string,
  weekEndDate: string,
) {
  return plannedLessons
    .filter((lesson) => lesson.plannedDate >= weekAnchorDate && lesson.plannedDate <= weekEndDate)
    .sort(
      (left, right) =>
        left.plannedDate.localeCompare(right.plannedDate) ||
        (left.plannedStartTime ?? "").localeCompare(right.plannedStartTime ?? "") ||
        (left.lessonNo ?? 0) - (right.lessonNo ?? 0),
    );
}
