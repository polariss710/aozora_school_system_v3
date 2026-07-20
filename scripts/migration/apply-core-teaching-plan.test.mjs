import assert from "node:assert/strict";
import test from "node:test";
import { applyCoreTeachingPlan } from "./apply-core-teaching-plan.mjs";

test("persistent core teaching importer requires its distinct staging confirmation before connecting", async () => {
  await assert.rejects(
    () => applyCoreTeachingPlan({}, { targetUrl: "postgresql://staging@db.bxnxdkbjlxkcqwzzeyds.supabase.co/postgres", MIGRATION_CONFIRM_CORE_TEACHING_APPLY: "wrong" }),
    /MIGRATION_CONFIRM_CORE_TEACHING_APPLY/,
  );
});
