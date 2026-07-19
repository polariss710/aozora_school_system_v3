import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExternalWorkMigrationPlan } from "./plan-external-work-migration.mjs";

const fixtureRoot = new URL("./fixtures/", import.meta.url);

async function loadFixture(name) {
  return JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
}

test("builds a deterministic plan without Cash writes", async () => {
  const snapshot = await loadFixture("external-work-synthetic-snapshot.json");
  const workplaceMap = await loadFixture("external-work-synthetic-workplace-map.json");
  const first = buildExternalWorkMigrationPlan(snapshot, workplaceMap);
  const second = buildExternalWorkMigrationPlan(snapshot, workplaceMap);

  assert.deepEqual(first, second);
  assert.equal(first.summary.batches, 1);
  assert.equal(first.summary.lessons, 2);
  assert.equal(first.summary.settlements, 1);
  assert.equal(first.summary.settlementDetails, 1);
  assert.equal(first.summary.incomes, 1);
  assert.equal(first.summary.linkageEvents, 1);
  assert.equal(first.summary.migrationAudits, 8);
  assert.equal(first.summary.auditOnly, 1);
  assert.equal(first.summary.cashRequests, 0);
  assert.equal(first.summary.cashTransactions, 0);
  assert.equal(first.summary.totalSettlementJpy, 5000);
  assert.equal(first.target.lessons.find((row) => row.lessonType === "planned").status, "actual_created");
  assert.equal(first.target.incomes[0].recordStatus, "historical_confirmed");
  assert.equal(first.target.incomes[0].cashStatus, "not_requested");
  assert.equal(first.target.linkageEvents[0].cashTransactionId, null);
  assert.match(first.sourceSnapshotSha256, /^[0-9a-f]{64}$/);
  assert.match(first.planSha256, /^[0-9a-f]{64}$/);
});

test("rejects a historical confirmation carrying a Cash transaction", async () => {
  const snapshot = await loadFixture("external-work-synthetic-snapshot.json");
  const workplaceMap = await loadFixture("external-work-synthetic-workplace-map.json");
  snapshot.linkageEvents[0].cashTransactionId = "92000000-0000-4000-8000-000000000011";

  assert.throws(
    () => buildExternalWorkMigrationPlan(snapshot, workplaceMap),
    /historical linkage must not contain Cash context/,
  );
});

test("requires exact workplace mapping", async () => {
  const snapshot = await loadFixture("external-work-synthetic-snapshot.json");
  assert.throws(
    () => buildExternalWorkMigrationPlan(snapshot, {}),
    /missing exact workplace mapping/,
  );
});

test("preserves synced Cash identity without generating Cash facts", async () => {
  const snapshot = await loadFixture("external-work-synthetic-snapshot.json");
  const workplaceMap = await loadFixture("external-work-synthetic-workplace-map.json");
  const event = snapshot.linkageEvents[0];
  event.syncStatus = "synced";
  event.cashUserId = "92000000-0000-4000-8000-000000000011";
  event.cashAccountId = "92000000-0000-4000-8000-000000000012";
  event.cashAccountNameSnapshot = "Synthetic CNY Account";
  event.cashAccountTypeSnapshot = "wallet";
  event.cashTransactionTable = "home_cny_transactions";
  event.cashTransactionId = "92000000-0000-4000-8000-000000000013";
  event.paymentCurrency = "CNY";
  event.paymentExchangeRate = 0.05;
  event.paymentAmount = 250;

  const plan = buildExternalWorkMigrationPlan(snapshot, workplaceMap);
  assert.equal(plan.target.incomes[0].recordStatus, "cash_confirmed");
  assert.equal(plan.target.incomes[0].cashStatus, "account_transaction_created");
  assert.equal(plan.target.linkageEvents[0].cashTransactionId, event.cashTransactionId);
  assert.deepEqual(plan.target.cashRequests, []);
  assert.deepEqual(plan.target.cashTransactions, []);
});

test("rejects duplicate active actual lessons", async () => {
  const snapshot = await loadFixture("external-work-synthetic-snapshot.json");
  const workplaceMap = await loadFixture("external-work-synthetic-workplace-map.json");
  snapshot.lessons[2].deletedAt = null;

  assert.throws(
    () => buildExternalWorkMigrationPlan(snapshot, workplaceMap),
    /multiple active actual lessons/,
  );
});
