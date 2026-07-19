import assert from "node:assert/strict";
import test from "node:test";
import { assessCutoverReadiness } from "./assess-cutover-readiness.mjs";

function manifest(overrides = {}) {
  return {
    contractVersion: "aozora-v3-cutover-readiness-v1",
    assessedAt: "2026-07-20T00:00:00.000Z",
    containsBusinessRows: false,
    readiness: {
      staging: {
        allMigrationsBootstrapRepeatable: true,
        e2eAndReconciliationVerified: true,
        operationalMonitoringVerified: true,
        historicalAuditUiVerified: true,
      },
      migration: {
        externalWorkRehearsalVerified: true,
        cashLedgerRehearsalVerified: true,
        coreTeachingMappingResolved: true,
        coreTeachingSnapshotContractVerified: true,
        coreTeachingImporterVerified: true,
        coreTeachingRehearsalVerified: true,
      },
      production: { userAuthorized: true, emptyTargetCreatedAndVerified: true },
      operations: {
        roles: {
          businessOwner: "business-owner",
          releaseOperator: "release-operator",
          schoolDataVerifier: "school-verifier",
          cashDataVerifier: "cash-verifier",
          rollbackDecisionMaker: "rollback-owner",
        },
        freezeWindow: { startsAt: "2026-08-01T00:00:00.000Z", maxWritePauseMinutes: 90 },
      },
      limitations: { cashPendingCancelAccepted: true, fxPartialAllocationAccepted: true },
    },
    ...overrides,
  };
}

test("permits only a complete, metadata-only cutover manifest", () => {
  const result = assessCutoverReadiness(manifest());
  assert.equal(result.readyForProductionCutoverPreparation, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.containsBusinessRows, false);
});

test("blocks current ordinary-teaching, authorization, and freeze-window gaps", () => {
  const candidate = manifest();
  candidate.readiness.migration.coreTeachingImporterVerified = false;
  candidate.readiness.production.userAuthorized = false;
  candidate.readiness.operations.roles.cashDataVerifier = "";
  candidate.readiness.operations.freezeWindow.maxWritePauseMinutes = 0;
  const result = assessCutoverReadiness(candidate);

  assert.equal(result.readyForProductionCutoverPreparation, false);
  assert.deepEqual(result.blockers, [
    "migration.coreTeachingImporterVerified",
    "production.userAuthorized",
    "operations.roles.cashDataVerifier",
    "operations.freezeWindow.maxWritePauseMinutes",
  ]);
});

test("rejects a manifest that attempts to carry source business rows", () => {
  const candidate = manifest({ containsBusinessRows: true });
  assert.throws(() => assessCutoverReadiness(candidate), /must not contain business rows/);
});

test("rejects a manifest that attempts to carry source identities or snapshots", () => {
  const candidate = manifest();
  candidate.sourceSnapshot = { sourceRecordId: "must-not-be-here" };
  assert.throws(() => assessCutoverReadiness(candidate), /contains unsupported fields: sourceSnapshot/);
});
