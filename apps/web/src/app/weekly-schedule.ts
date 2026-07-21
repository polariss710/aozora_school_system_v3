import type { StudentPlannedLessonRecord } from "./api";

export function plannedLessonScheduleDate(plannedDate: string) {
  return plannedDate.slice(0, 10);
}

export function plannedLessonsForScheduleWeek(
  plannedLessons: StudentPlannedLessonRecord[],
  weekAnchorDate: string,
  weekEndDate: string,
) {
  return plannedLessons
    .filter((lesson) => {
      const scheduleDate = plannedLessonScheduleDate(lesson.plannedDate);
      return scheduleDate >= weekAnchorDate && scheduleDate <= weekEndDate;
    })
    .sort(
      (left, right) =>
        plannedLessonScheduleDate(left.plannedDate).localeCompare(plannedLessonScheduleDate(right.plannedDate)) ||
        (left.plannedStartTime ?? "").localeCompare(right.plannedStartTime ?? "") ||
        (left.lessonNo ?? 0) - (right.lessonNo ?? 0),
    );
}
