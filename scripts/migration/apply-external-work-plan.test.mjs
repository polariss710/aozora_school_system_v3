import assert from "node:assert/strict";
import test from "node:test";
import { requireStagingTargetEnvironment } from "./apply-external-work-plan.mjs";

const stagingRef = "bxnxdkbjlxkcqwzzeyds";

function stagingEnvironment(overrides = {}) {
  return {
    MIGRATION_TARGET_ENV: "staging",
    MIGRATION_TARGET_PROJECT_REF: stagingRef,
    MIGRATION_TARGET_DATABASE_URL: `postgresql://migration@example.supabase.co/${stagingRef}`,
    MIGRATION_CONFIRM_STAGING_IMPORT: "v3-staging",
    ...overrides,
  };
}

test("persistent importer accepts only the explicit v3-staging target", () => {
  assert.deepEqual(requireStagingTargetEnvironment(stagingEnvironment()), {
    targetEnv: "staging",
    targetUrl: `postgresql://migration@example.supabase.co/${stagingRef}`,
  });
});

test("persistent importer rejects production and non-staging targets before connecting", () => {
  assert.throws(
    () => requireStagingTargetEnvironment(stagingEnvironment({ MIGRATION_TARGET_PROJECT_REF: "xlcdqvlfzspcxdoidsrr" })),
    /v3-staging project ref/,
  );
  assert.throws(
    () => requireStagingTargetEnvironment(stagingEnvironment({ MIGRATION_TARGET_ENV: "dev" })),
    /must be staging/,
  );
  assert.throws(
    () => requireStagingTargetEnvironment(stagingEnvironment({ MIGRATION_CONFIRM_STAGING_IMPORT: "yes" })),
    /MIGRATION_CONFIRM_STAGING_IMPORT/,
  );
});
