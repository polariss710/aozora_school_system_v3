#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const contractVersion = "aozora-cash-ledger-snapshot-v1";
const ownerMappingVersion = "aozora-v3-staging-cash-owner-map-v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tables = [
  ["accounts", "home_accounts"],
  ["paymentChannels", "home_payment_channels"],
  ["fixedTemplates", "home_fixed_templates"],
  ["fixedMonthItems", "home_fixed_month_items"],
  ["jpyTransactions", "home_jpy_transactions"],
  ["cnyTransactions", "home_cny_transactions"],
  ["externalRequests", "home_external_transaction_requests"],
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUuid(value, label) {
  invariant(typeof value === "string" && uuidPattern.test(value), `${label} must be a UUID`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function indexRows(rows, label) {
  const result = new Map();
  for (const row of rows) {
    assertUuid(row?.id, `${label}.id`);
    invariant(!result.has(row.id), `duplicate ${label} id: ${row.id}`);
    result.set(row.id, row);
  }
  return result;
}

function mappedRow(row, ownerMapping, label) {
  assertUuid(row.user_id, `${label} ${row.id}.user_id`);
  const targetUserId = ownerMapping.users?.[row.user_id];
  assertUuid(targetUserId, `missing Cash staging owner mapping: ${row.user_id}`);
  return { ...row, user_id: targetUserId };
}

function assertOptionalReference(row, field, targetIds, label) {
  const value = row[field];
  if (value === null || value === undefined) return;
  assertUuid(value, `${label}.${field}`);
  invariant(targetIds.has(value), `${label}.${field} references a missing source row: ${value}`);
}

export function buildCashLedgerMigrationPlan(snapshot, ownerMapping, options = {}) {
  const programVersion = options.programVersion ?? "cash-ledger-plan-v1";
  invariant(snapshot.contractVersion === contractVersion, `snapshot contract must be ${contractVersion}`);
  invariant(snapshot.sourceSnapshot?.sourceSystem === "cash_prod", "Cash snapshot source system is invalid");
  invariant(snapshot.sourceSnapshot?.capturedAt, "Cash snapshot capturedAt is required");
  invariant(snapshot.sourceSnapshot?.isolation === "repeatable_read_read_only", "Cash snapshot isolation is invalid");
  invariant(ownerMapping?.contractVersion === ownerMappingVersion, "Cash owner mapping contract is invalid");

  const rows = Object.fromEntries(tables.map(([key]) => [key, snapshot[key] ?? []]));
  for (const [key] of tables) {
    invariant(Array.isArray(rows[key]), `${key} must be an array`);
  }
  const accounts = indexRows(rows.accounts, "account");
  const templates = indexRows(rows.fixedTemplates, "fixed template");
  const jpyTransactions = indexRows(rows.jpyTransactions, "JPY transaction");
  const cnyTransactions = indexRows(rows.cnyTransactions, "CNY transaction");
  const allTransactions = new Set([...jpyTransactions.keys(), ...cnyTransactions.keys()]);

  for (const row of rows.fixedMonthItems) {
    assertOptionalReference(row, "template_id", templates, `fixed month item ${row.id}`);
    assertOptionalReference(row, "account_id", accounts, `fixed month item ${row.id}`);
  }
  for (const [currency, transactions, linkedField, opposite] of [
    ["JPY", rows.jpyTransactions, "linked_cny_transaction_id", cnyTransactions],
    ["CNY", rows.cnyTransactions, "linked_jpy_transaction_id", jpyTransactions],
  ]) {
    for (const row of transactions) {
      assertOptionalReference(row, "account_id", accounts, `${currency} transaction ${row.id}`);
      assertOptionalReference(row, "transfer_account_id", accounts, `${currency} transaction ${row.id}`);
      assertOptionalReference(row, linkedField, opposite, `${currency} transaction ${row.id}`);
    }
  }
  for (const row of rows.externalRequests) {
    assertOptionalReference(row, "account_id", accounts, `external request ${row.id}`);
    assertOptionalReference(row, "created_transaction_id", allTransactions, `external request ${row.id}`);
  }

  const target = {};
  for (const [key] of tables) {
    target[key] = rows[key].map((row) => mappedRow(row, ownerMapping, key));
  }
  const summary = Object.fromEntries(tables.map(([key]) => [key, target[key].length]));
  summary.totalTransactions = summary.jpyTransactions + summary.cnyTransactions;
  summary.mappedOwners = new Set(rows.accounts.map((row) => row.user_id)).size;
  summary.authUsersCopied = 0;
  const plan = {
    contractVersion,
    programVersion,
    sourceSnapshotSha256: sha256(snapshot),
    ownerMappingSha256: sha256(ownerMapping),
    capturedAt: snapshot.sourceSnapshot.capturedAt,
    summary,
    target,
  };
  return { ...plan, planSha256: sha256(plan) };
}

async function main() {
  const [snapshotPath, ownerMappingPath] = process.argv.slice(2);
  invariant(snapshotPath && ownerMappingPath, "usage: node plan-cash-ledger-migration.mjs <snapshot.json> <cash-owner-map.json>");
  const [snapshot, ownerMapping] = await Promise.all([
    readFile(snapshotPath, "utf8").then(JSON.parse),
    readFile(ownerMappingPath, "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(buildCashLedgerMigrationPlan(snapshot, ownerMapping), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
