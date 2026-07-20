import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJsonSha256 } from "./validate-core-teaching-snapshot.mjs";
import { prepareCoreTeachingStagingImport } from "./prepare-core-teaching-staging-import.mjs";

function aggregateInventory() {
  return {
    contractVersion: "aozora-v2-core-teaching-aggregate-inventory-v2",
    sourceSnapshot: {
      sourceSystem: "school_v2",
      capturedAt: "2026-07-20T00:00:00.000Z",
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
    lessonLinkage: { actualByPlannedLink: [], plannedByActualLink: [] },
    outOfScopeFutureCounts: { incomeRecords: 0, expenseRecords: 0, lessonRecords: 0 },
  };
}

function snapshotFor(aggregate) {
  return {
    contractVersion: "aozora-v2-core-teaching-snapshot-v1",
    sourceKey: "SYNTHETIC-CORE-PREPARE",
    sourceFilename: "synthetic-core.json",
    sourceSnapshot: {
      sourceSystem: "school_v2",
      isolation: "repeatable_read_read_only",
      containsBusinessRows: true,
      scopeStartYearMonth: "2026-07",
      scopeEndYearMonth: "2026-12",
      sourceQuerySha256: "3".repeat(64),
      aggregateInventorySha256: canonicalJsonSha256(aggregate),
    },
    referenceData: { businessEntities: [], students: [], teachers: [], subjects: [] },
    facts: { plannedLessons: [], actualLessons: [], studentSettlements: [], tuitionBills: [], incomes: [], expenses: [] },
    omissionCandidates: [],
  };
}

function manifestFor(snapshot) {
  return {
    contractVersion: "aozora-v2-core-teaching-exclusion-manifest-v1",
    omissionPolicy: "v2_readonly_retention_v1",
    sourceSnapshotSha256: canonicalJsonSha256(snapshot),
    exclusions: [],
  };
}

function stagingEnvironment() {
  return {
    MIGRATION_TARGET_ENV: "staging",
    MIGRATION_TARGET_PROJECT_REF: "bxnxdkbjlxkcqwzzeyds",
    MIGRATION_TARGET_DATABASE_URL: "postgresql://staging@db.bxnxdkbjlxkcqwzzeyds.supabase.co/postgres",
    MIGRATION_CONFIRM_STAGING_IMPORT: "v3-staging",
  };
}

test("prepares a verified core-teaching staging import without connecting or writing", () => {
  const aggregate = aggregateInventory();
  const snapshot = snapshotFor(aggregate);
  const result = prepareCoreTeachingStagingImport({
    snapshot,
    exclusionManifest: manifestFor(snapshot),
    aggregateInventory: aggregate,
    environment: stagingEnvironment(),
  });
  assert.equal(result.status, "prepared_not_applied");
  assert.equal(result.targetEnv, "staging");
  assert.equal(result.excludedChains, 0);
});

test("rejects a snapshot that was not tied to the exact aggregate inventory", () => {
  const aggregate = aggregateInventory();
  const snapshot = snapshotFor(aggregate);
  const manifest = manifestFor(snapshot);
  aggregate.outOfScopeFutureCounts.incomeRecords = 1;
  assert.throws(
    () => prepareCoreTeachingStagingImport({ snapshot, exclusionManifest: manifest, aggregateInventory: aggregate, environment: stagingEnvironment() }),
    /aggregate inventory hash differs/,
  );
});

test("rejects production target references before any import preparation", () => {
  const aggregate = aggregateInventory();
  const snapshot = snapshotFor(aggregate);
  const environment = stagingEnvironment();
  environment.MIGRATION_TARGET_DATABASE_URL = "postgresql://prod@db.ahtgiwdzocerkonrjmdo.supabase.co/postgres";
  assert.throws(
    () => prepareCoreTeachingStagingImport({ snapshot, exclusionManifest: manifestFor(snapshot), aggregateInventory: aggregate, environment }),
    /target URL does not contain the v3-staging project ref/,
  );
});
