import assert from "node:assert/strict";
import test from "node:test";
import { assessCoreTeachingAggregateConsistency } from "./assess-core-teaching-aggregate-consistency.mjs";

function inventory(capturedAt, count = 1) {
  return {
    contractVersion: "aozora-v2-core-teaching-aggregate-inventory-v2",
    sourceSnapshot: { capturedAt },
    dependentCounts: { teacherWageLockDetails: count },
  };
}

test("treats capturedAt as volatile while preserving business aggregate equality", () => {
  const result = assessCoreTeachingAggregateConsistency(inventory("2026-07-20T00:00:00.000Z"), inventory("2026-07-20T00:01:00.000Z"));
  assert.equal(result.consistent, true);
  assert.deepEqual(result.ignoredVolatileFields, ["sourceSnapshot.capturedAt"]);
});

test("rejects a changed business aggregate", () => {
  const result = assessCoreTeachingAggregateConsistency(inventory("2026-07-20T00:00:00.000Z", 1), inventory("2026-07-20T00:01:00.000Z", 2));
  assert.equal(result.consistent, false);
});
