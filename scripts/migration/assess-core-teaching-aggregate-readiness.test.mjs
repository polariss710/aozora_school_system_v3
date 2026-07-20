import assert from "node:assert/strict";
import test from "node:test";
import { assessCoreTeachingAggregateReadiness } from "./assess-core-teaching-aggregate-readiness.mjs";

function inventory(overrides = {}) {
  return {
    contractVersion: "aozora-v2-core-teaching-aggregate-inventory-v2",
    sourceSnapshot: {
      sourceSystem: "school_v2",
      capturedAt: "2026-07-19T00:00:00.000Z",
      isolation: "repeatable_read_read_only",
      containsBusinessRows: false,
      scopeStartYearMonth: "2026-07",
      scopeEndYearMonth: "2026-12",
    },
    dependentCounts: {
      studentSettlementAdjustments: 0,
      studentSettlementCarryovers: 0,
      teacherWageLockDetails: 0,
      teacherWageDetailAdjustments: 0,
      expenseAttachments: 0,
      paymentRequestsAtOrAfterScope: 0,
    },
    integrityChecks: {
      wage_detail_missing_lesson: 0,
      wage_adjustment_missing_lock: 0,
      actual_missing_planned_source: 0,
      attachment_missing_scoped_expense: 0,
      carryover_missing_source_settlement: 0,
    },
    lessonLinkage: {
      actualByPlannedLink: [
        { actual_status: "completed", planned_status: "planned", link_state: "linked", row_count: 2 },
        { actual_status: "makeup_completed", planned_status: "pending_makeup", link_state: "linked", row_count: 1 },
      ],
      plannedByActualLink: [
        { planned_status: "planned", actual_status: null, row_count: 4 },
        { planned_status: "pending_makeup", actual_status: "makeup_completed", row_count: 1 },
      ],
    },
    outOfScopeFutureCounts: { incomeRecords: 3, expenseRecords: 0, lessonRecords: 0 },
    ...overrides,
  };
}

test("permits a restricted snapshot only after all aggregate gates pass", () => {
  const result = assessCoreTeachingAggregateReadiness(inventory());
  assert.equal(result.contractVersion, "aozora-v3-core-teaching-aggregate-readiness-v2");
  assert.equal(result.aggregateGatePassed, true);
  assert.equal(result.omissionPolicy, "v2_readonly_retention_v1");
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.futureFactsExcluded, { incomeRecords: 3, expenseRecords: 0, lessonRecords: 0 });
});

test("records the approved V2-readonly omission policy instead of importing unsupported dependent facts", () => {
  const source = inventory();
  source.dependentCounts.teacherWageDetailAdjustments = 1;
  const result = assessCoreTeachingAggregateReadiness(source);
  assert.equal(result.aggregateGatePassed, true);
  assert.equal(result.omissionPolicy, "v2_readonly_retention_v1");
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.v2ReadOnlyExclusions, [
    {
      dependentFact: "teacherWageDetailAdjustments",
      count: 1,
      handling: "retain_affected_teacher_wage_chain_in_v2_readonly",
    },
  ]);
});

test("rejects an actual lesson without a supported planned source", () => {
  const source = inventory();
  source.lessonLinkage.actualByPlannedLink = [
    { actual_status: "completed", planned_status: null, link_state: "no_planned_link", row_count: 1 },
  ];
  const result = assessCoreTeachingAggregateReadiness(source);
  assert.equal(result.aggregateGatePassed, false);
  assert.deepEqual(result.blockers, ["actual lesson linkage is no_planned_link", "unsupported planned status: null"]);
});
