import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./export-v2-core-teaching-snapshot.sql", import.meta.url), "utf8");

test("core teaching snapshot export is a read-only rollback contract with explicit omissions", () => {
  assert.match(sql, /begin transaction isolation level repeatable read read only;/i);
  assert.match(sql, /rollback;/i);
  assert.match(sql, /transaction_timestamp\(\)/i);
  assert.match(sql, /'containsBusinessRows', true/i);
  assert.match(sql, /'omissionCandidates'/i);
  assert.match(sql, /studentSettlementAdjustments/);
  assert.match(sql, /studentSettlementCarryovers/);
  assert.match(sql, /teacherWageLockDetails/);
  assert.match(sql, /teacherWageDetailAdjustments/);
  assert.match(sql, /expenseAttachments/);
  assert.match(sql, /paymentRequestsAtOrAfterScope/);
  assert.match(sql, /source_query_sha256/);
  assert.match(sql, /aggregate_inventory_sha256/);
  assert.doesNotMatch(sql, /\b(insert\s+into|update\s+public|delete\s+from|truncate|alter\s+table|create\s+table|drop\s+table|copy\s)\b/i);
});
