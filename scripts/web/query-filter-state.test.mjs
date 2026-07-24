import test from "node:test";
import assert from "node:assert/strict";

import {
  applyQueryFilterDraft,
  applyDefaultQueryFilters,
  createQueryFilterState,
  resetQueryFilterDraft,
  updateQueryFilterDraft,
} from "../../apps/web/src/app/query-filter-state.js";
import { buildAppliedFilterSearch, readAppliedFilterQuery } from "../../apps/web/src/app/filter-query-url.js";
import { plannedLessonScheduleDate, plannedLessonsForScheduleWeek } from "../../apps/web/src/app/weekly-schedule.ts";

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

test("normal reset restores editable controls but preserves applied scope", () => {
  const applied = applyQueryFilterDraft(updateQueryFilterDraft(createQueryFilterState(initialScope), {
    studentId: "student-1",
  }));
  const reset = resetQueryFilterDraft(applied, initialScope);

  assert.deepEqual(reset.draft, initialScope);
  assert.equal(reset.applied.studentId, "student-1");
  assert.equal(reset.draft.studentId, "");
});

test("explicit date navigation may reset and apply its documented default scope", () => {
  const reset = applyDefaultQueryFilters(initialScope);

  assert.deepEqual(reset.draft, initialScope);
  assert.deepEqual(reset.applied, initialScope);
});

test("only an applied query scope is serialized into the URL", () => {
  const search = buildAppliedFilterSearch("?other=keep&filter-page=old&filter.学生=旧值&filter-keyword=old", "lesson-management", {
    月份: "2026-07",
    学生: "青空太郎",
    状态: "",
  }, "待登记");
  const params = new URLSearchParams(search);

  assert.equal(params.get("other"), "keep");
  assert.equal(params.get("filter-page"), "lesson-management");
  assert.equal(params.get("filter.月份"), "2026-07");
  assert.equal(params.get("filter.学生"), "青空太郎");
  assert.equal(params.get("filter.状态"), null);
  assert.equal(params.get("filter-keyword"), "待登记");
});

test("only a supported page and its declared filter fields are restored from the URL", () => {
  const restored = readAppliedFilterQuery(
    "?filter-page=external-lessons&filter.%E4%B8%9A%E5%8A%A1%E6%9C%88%E4%BB%BD=2026-07&filter.%E6%8E%88%E8%AF%BE%E6%9C%BA%E6%9E%84=%E6%97%A9%E7%A8%BB%E7%94%B0%E5%A1%BE&filter.%E9%9A%90%E8%97%8F%E5%AD%97%E6%AE%B5=ignore&filter-keyword=%E5%BE%85%E7%99%BB%E8%AE%B0",
    ["lesson-management", "external-lessons", "income-records"],
    ["业务月份", "授课机构", "对应状态"],
  );

  assert.deepEqual(restored, {
    pageKey: "external-lessons",
    scope: {
      values: { 业务月份: "2026-07", 授课机构: "早稻田塾" },
      keyword: "待登记",
    },
  });
  assert.equal(readAppliedFilterQuery("?filter-page=unknown&filter.月份=2026-07", ["lesson-management"], ["月份"]), null);
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

test("weekly schedule normalizes API date timestamps before grouping them by day", () => {
  const lesson = { id: "timestamped", plannedDate: "2026-07-20T00:00:00.000Z", plannedStartTime: "10:00", lessonNo: 1 };

  assert.equal(plannedLessonScheduleDate(lesson.plannedDate), "2026-07-20");
  assert.deepEqual(
    plannedLessonsForScheduleWeek([lesson], "2026-07-20", "2026-07-26").map((record) => record.id),
    ["timestamped"],
  );
});
