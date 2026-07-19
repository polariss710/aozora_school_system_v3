#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCashLedgerMigrationPlan } from "./plan-cash-ledger-migration.mjs";
import { requireStagingTargetEnvironment } from "./apply-external-work-plan.mjs";

const apiRequire = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const { PrismaPg } = apiRequire("@prisma/adapter-pg");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tableSteps = [
  ["accounts", "home_accounts"],
  ["paymentChannels", "home_payment_channels"],
  ["fixedTemplates", "home_fixed_templates"],
  ["fixedMonthItems", "home_fixed_month_items"],
  ["jpyTransactions", "home_jpy_transactions"],
  ["cnyTransactions", "home_cny_transactions"],
  ["externalRequests", "home_external_transaction_requests"],
];

function invariant(condition, message) { if (!condition) throw new Error(message); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }

async function controlledJson(filePath, label) {
  const resolved = await realpath(filePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(relative.startsWith("..") && !path.isAbsolute(relative), `${label} must be stored outside the repository`);
  const metadata = await stat(resolved);
  invariant(metadata.isFile() && (metadata.mode & 0o077) === 0, `${label} must be a private regular file`);
  return JSON.parse(await readFile(resolved, "utf8"));
}

async function assertCashBaseline(prisma, ownerMapping) {
  const [seed, users] = await Promise.all([
    prisma.$queryRawUnsafe("select count(*)::int as count from public.home_accounts where name like 'STAGING Cash %'"),
    prisma.$queryRawUnsafe("select id::text from auth.users where id = any($1::uuid[])", Object.values(ownerMapping.users)),
  ]);
  invariant(seed[0]?.count === 4, "target is not the verified v3-staging Cash project");
  invariant(users.length === Object.keys(ownerMapping.users).length, "one or more mapped staging Cash Auth users do not exist");
}

async function assertSchemaMatchesPlan(prisma, plan) {
  for (const [key, table] of tableSteps) {
    const rows = plan.target[key];
    if (rows.length === 0) continue;
    const expected = new Set(Object.keys(rows[0]));
    for (const row of rows) invariant(canonicalJson(Object.keys(row).sort()) === canonicalJson([...expected].sort()), `${table} snapshot rows use inconsistent columns`);
    const columns = await prisma.$queryRawUnsafe(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by column_name",
      table,
    );
    const actual = new Set(columns.map((row) => row.column_name));
    invariant(expected.size === actual.size && [...expected].every((column) => actual.has(column)), `${table} target schema differs from the source snapshot`);
  }
}

async function targetRows(prisma, table, ids) {
  if (ids.length === 0) return [];
  return prisma.$queryRawUnsafe(`select to_jsonb(t) as row from public.${table} t where id = any($1::uuid[])`, ids);
}

async function existingState(prisma, plan) {
  let expectedTotal = 0;
  let actualTotal = 0;
  for (const [key, table] of tableSteps) {
    const expectedRows = plan.target[key];
    const existing = await targetRows(prisma, table, expectedRows.map((row) => row.id));
    expectedTotal += expectedRows.length;
    actualTotal += existing.length;
    if (existing.length === expectedRows.length && existing.length > 0) {
      const actualById = new Map(existing.map((entry) => [entry.row.id, entry.row]));
      for (const expected of expectedRows) {
        invariant(canonicalJson(actualById.get(expected.id)) === canonicalJson(expected), `existing ${table} row conflicts with migration plan: ${expected.id}`);
      }
    }
  }
  if (actualTotal === 0) return "empty";
  invariant(actualTotal === expectedTotal, "target contains a partial Cash ledger migration");
  return "already_applied";
}

async function insertRow(tx, table, row) {
  await tx.$executeRawUnsafe(
    `insert into public.${table} select * from jsonb_populate_record(null::public.${table}, $1::jsonb)`,
    JSON.stringify(row),
  );
}

function withoutLink(row, field) {
  if (!(field in row)) return row;
  return { ...row, [field]: null };
}

async function insertPlan(tx, plan) {
  for (const [key, table] of tableSteps) {
    const linkField = key === "jpyTransactions" ? "linked_cny_transaction_id" : key === "cnyTransactions" ? "linked_jpy_transaction_id" : null;
    for (const row of plan.target[key]) await insertRow(tx, table, linkField ? withoutLink(row, linkField) : row);
  }
  for (const [key, table, field] of [
    ["jpyTransactions", "home_jpy_transactions", "linked_cny_transaction_id"],
    ["cnyTransactions", "home_cny_transactions", "linked_jpy_transaction_id"],
  ]) {
    for (const row of plan.target[key]) {
      if (row[field]) await tx.$executeRawUnsafe(`update public.${table} set ${field} = $2::uuid where id = $1::uuid`, row.id, row[field]);
    }
  }
}

export async function applyCashLedgerPlan(plan, ownerMapping, environment = requireStagingTargetEnvironment()) {
  const prisma = new PrismaClient({ adapter: new PrismaPg(environment.targetUrl) });
  try {
    await prisma.$connect();
    await assertCashBaseline(prisma, ownerMapping);
    await assertSchemaMatchesPlan(prisma, plan);
    return await prisma.$transaction(async (tx) => {
      const state = await existingState(tx, plan);
      if (state === "empty") await insertPlan(tx, plan);
      invariant((await existingState(tx, plan)) === "already_applied", "Cash ledger reconciliation failed");
      return { status: state === "empty" ? "applied" : "already_applied", planSha256: plan.planSha256, summary: plan.summary };
    }, { timeout: 90_000 });
  } finally { await prisma.$disconnect(); }
}

async function main() {
  const [snapshotPath, ownerMapPath, applyFlag] = process.argv.slice(2);
  invariant(snapshotPath && ownerMapPath && applyFlag === "--apply", "usage: node apply-cash-ledger-plan.mjs <snapshot.json> <cash-owner-map.json> --apply");
  const [snapshot, ownerMapping] = await Promise.all([controlledJson(snapshotPath, "snapshot"), controlledJson(ownerMapPath, "Cash owner mapping")]);
  const plan = buildCashLedgerMigrationPlan(snapshot, ownerMapping);
  process.stdout.write(`${JSON.stringify(await applyCashLedgerPlan(plan, ownerMapping), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
