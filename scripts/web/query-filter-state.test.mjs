import test from "node:test";
import assert from "node:assert/strict";

import {
  applyQueryFilterDraft,
  createQueryFilterState,
  resetAndApplyQueryFilters,
  updateQueryFilterDraft,
} from "../../apps/web/src/app/query-filter-state.js";
import { plannedLessonsForScheduleWeek } from "../../apps/web/src/app/weekly-schedule.ts";

const initialScope = {
  weekAnchorDate: "2026-07-20",
  studentId: "",
  businessEntityId: "",
};

test("changing a query control only changes draft scope", () => {
  const initial = createQueryFilterState(initialScope);
  const changed = updateQueryFilterDraft(initial, { studentId: "student-1" });

  assert.equal(changed.draft.studentId, "student-1");
  assert.equal(changed.applied.studentId, "");
  assert.deepEqual(changed.applied, initialScope);
});

test("only an explicit query applies the edited filter scope", () => {
  const changed = updateQueryFilterDraft(createQueryFilterState(initialScope), {
    studentId: "student-1",
    businessEntityId: "entity-1",
  });
  const applied = applyQueryFilterDraft(changed);

  assert.deepEqual(applied.applied, changed.draft);
  assert.equal(applied.applied.studentId, "student-1");
  assert.equal(applied.applied.businessEntityId, "entity-1");
});

test("explicit reset resets and applies the default scope together", () => {
  const reset = resetAndApplyQueryFilters(initialScope);

  assert.deepEqual(reset.draft, initialScope);
  assert.deepEqual(reset.applied, initialScope);
});

test("weekly schedule follows the formal planned date, not the settlement week anchor", () => {
  const lessons = [
    { id: "sunday-anchor", plannedDate: "2026-07-20", weekAnchorDate: "2026-07-19", plannedStartTime: "10:00", lessonNo: 2 },
    { id: "monday-anchor", plannedDate: "2026-07-20", weekAnchorDate: "2026-07-20", plannedStartTime: "09:00", lessonNo: 1 },
    { id: "outside-week", plannedDate: "2026-07-27", weekAnchorDate: "2026-07-20", plannedStartTime: "09:00", lessonNo: 1 },
  ];

  assert.deepEqual(
    plannedLessonsForScheduleWeek(lessons, "2026-07-20", "2026-07-26").map((lesson) => lesson.id),
    ["monday-anchor", "sunday-anchor"],
  );
});
