import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceFiles = [
  "export-v2-external-work-snapshot.sql",
  "export-cash-ledger-snapshot.sql",
];

for (const sourceFile of sourceFiles) {
  test(`${sourceFile} is a read-only rollback snapshot contract`, async () => {
    const sql = await readFile(new URL(`./${sourceFile}`, import.meta.url), "utf8");
    assert.match(sql, /begin transaction isolation level repeatable read read only;/i);
    assert.match(sql, /rollback;/i);
    assert.match(sql, /transaction_timestamp\(\)/i);
    assert.doesNotMatch(sql, /\b(insert\s+into|update\s+public|delete\s+from|alter\s+table|create\s+table|drop\s+table|copy\s)\b/i);
  });
}
