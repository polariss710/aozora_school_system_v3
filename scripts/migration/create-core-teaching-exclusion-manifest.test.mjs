import assert from "node:assert/strict";
import test from "node:test";
import { buildCoreTeachingExclusionManifest } from "./create-core-teaching-exclusion-manifest.mjs";
import { canonicalJsonSha256 } from "./validate-core-teaching-snapshot.mjs";

const snapshot = {
  contractVersion: "aozora-v2-core-teaching-snapshot-v1",
  omissionCandidates: [{
    sourceTable: "school_teacher_wage_locks",
    sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    dependentFact: "teacherWageLockDetails",
    affectedFactKeys: ["school_teacher_wage_locks:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  }],
};

test("builds an exact V2-readonly exclusion manifest from source candidates", () => {
  const manifest = buildCoreTeachingExclusionManifest(snapshot);
  assert.equal(manifest.contractVersion, "aozora-v2-core-teaching-exclusion-manifest-v1");
  assert.equal(manifest.sourceSnapshotSha256, canonicalJsonSha256(snapshot));
  assert.deepEqual(manifest.exclusions, [{
    sourceTable: "school_teacher_wage_locks",
    sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    dependentFact: "teacherWageLockDetails",
    affectedFactKeys: ["school_teacher_wage_locks:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    handling: "retain_affected_teacher_wage_chain_in_v2_readonly",
  }]);
});

test("rejects an unsupported exclusion candidate", () => {
  assert.throws(
    () => buildCoreTeachingExclusionManifest({ ...snapshot, omissionCandidates: [{ ...snapshot.omissionCandidates[0], dependentFact: "unknown" }] }),
    /unsupported omission candidate/,
  );
});
