import test from "node:test";
import assert from "node:assert/strict";

import {
  applyQueryFilterDraft,
  createQueryFilterState,
  resetAndApplyQueryFilters,
  updateQueryFilterDraft,
} from "../../apps/web/src/app/query-filter-state.js";

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
