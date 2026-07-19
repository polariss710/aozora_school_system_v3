import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("./v2-core-teaching-aggregate-inventory.sql", import.meta.url), "utf8");

test("core teaching aggregate inventory is a read-only rollback contract", () => {
  assert.match(sql, /begin transaction isolation level repeatable read read only;/i);
  assert.match(sql, /containsBusinessRows', false/i);
  assert.match(sql, /scopeStartYearMonth/i);
  assert.match(sql, /scopeEndYearMonth/i);
  assert.match(sql, /outOfScopeFutureCounts/i);
  assert.match(sql, /rollback;/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter|create|drop)\b/i);
});
