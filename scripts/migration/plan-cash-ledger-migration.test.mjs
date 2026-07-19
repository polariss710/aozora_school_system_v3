import assert from "node:assert/strict";
import test from "node:test";
import { buildCashLedgerMigrationPlan } from "./plan-cash-ledger-migration.mjs";

const sourceUser = "91000000-0000-4000-8000-000000000001";
const targetUser = "92000000-0000-4000-8000-000000000001";
const accountId = "91000000-0000-4000-8000-000000000002";
const cnyTransactionId = "91000000-0000-4000-8000-000000000003";
const jpyTransactionId = "91000000-0000-4000-8000-000000000004";

function snapshot() {
  return {
    contractVersion: "aozora-cash-ledger-snapshot-v1",
    sourceSnapshot: { sourceSystem: "cash_prod", capturedAt: "2026-07-19T00:00:00.000Z", isolation: "repeatable_read_read_only" },
    accounts: [{ id: accountId, user_id: sourceUser, currency: "CNY", name: "Synthetic Cash", account_type: "wallet" }],
    paymentChannels: [], fixedTemplates: [], fixedMonthItems: [],
    cnyTransactions: [{ id: cnyTransactionId, user_id: sourceUser, account_id: accountId, linked_jpy_transaction_id: jpyTransactionId }],
    jpyTransactions: [{ id: jpyTransactionId, user_id: sourceUser, account_id: accountId, linked_cny_transaction_id: cnyTransactionId }],
    externalRequests: [{ id: "91000000-0000-4000-8000-000000000005", user_id: sourceUser, account_id: accountId, created_transaction_id: cnyTransactionId }],
  };
}

function ownerMap() {
  return { contractVersion: "aozora-v3-staging-cash-owner-map-v1", users: { [sourceUser]: targetUser } };
}

test("builds a deterministic Cash ledger plan without copying Auth users", () => {
  const first = buildCashLedgerMigrationPlan(snapshot(), ownerMap());
  const second = buildCashLedgerMigrationPlan(snapshot(), ownerMap());
  assert.deepEqual(first, second);
  assert.equal(first.target.accounts[0].user_id, targetUser);
  assert.equal(first.target.cnyTransactions[0].linked_jpy_transaction_id, jpyTransactionId);
  assert.equal(first.summary.totalTransactions, 2);
  assert.equal(first.summary.authUsersCopied, 0);
});

test("rejects an owner without an explicit staging mapping", () => {
  assert.throws(() => buildCashLedgerMigrationPlan(snapshot(), { contractVersion: "aozora-v3-staging-cash-owner-map-v1", users: {} }), /missing Cash staging owner mapping/);
});

test("rejects broken Cash transaction references", () => {
  const invalid = snapshot();
  invalid.cnyTransactions[0].linked_jpy_transaction_id = "91000000-0000-4000-8000-000000000099";
  assert.throws(() => buildCashLedgerMigrationPlan(invalid, ownerMap()), /references a missing source row/);
});

test("rejects a fixed month item linked to a missing transaction", () => {
  const invalid = snapshot();
  invalid.fixedTemplates = [{ id: "91000000-0000-4000-8000-000000000006", user_id: sourceUser, default_account_id: accountId }];
  invalid.fixedMonthItems = [{
    id: "91000000-0000-4000-8000-000000000007",
    user_id: sourceUser,
    template_id: invalid.fixedTemplates[0].id,
    account_id: accountId,
    linked_jpy_transaction_id: "91000000-0000-4000-8000-000000000099",
    linked_cny_transaction_id: null,
  }];
  assert.throws(() => buildCashLedgerMigrationPlan(invalid, ownerMap()), /fixed month item .*references a missing source row/);
});
