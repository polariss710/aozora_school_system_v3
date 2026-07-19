#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCashLedgerMigrationPlan } from "./plan-cash-ledger-migration.mjs";
import { buildExternalWorkMigrationPlan } from "./plan-external-work-migration.mjs";
import { requireStagingTargetEnvironment } from "./apply-external-work-plan.mjs";

const apiRequire = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const { PrismaPg } = apiRequire("@prisma/adapter-pg");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const cashTables = [
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

async function controlledJson(filePath, label) {
  const resolved = await realpath(filePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(relative.startsWith("..") && !path.isAbsolute(relative), `${label} must be stored outside the repository`);
  const metadata = await stat(resolved);
  invariant(metadata.isFile() && (metadata.mode & 0o077) === 0, `${label} must be a private regular file`);
  return JSON.parse(await readFile(resolved, "utf8"));
}

async function countIds(tx, table, ids) {
  if (ids.length === 0) return 0;
  const rows = await tx.$queryRawUnsafe(`select count(*)::int as count from public.${table} where id = any($1::uuid[])`, ids);
  return rows[0]?.count ?? 0;
}

async function assertCashState(tx, plan) {
  for (const [key, table] of cashTables) {
    const expected = plan.target[key].map((row) => row.id);
    invariant(await countIds(tx, table, expected) === expected.length, `Cash reconciliation failed: ${table}`);
  }
  const seed = await tx.$queryRawUnsafe("select count(*)::int as count from public.home_accounts where name like 'STAGING Cash %'");
  invariant(seed[0]?.count === 4, "staging Cash seed baseline differs");
}

async function assertSchoolState(tx, plan) {
  for (const [label, table, rows] of [
    ["batch", "historical_external_work_import_batches", plan.target.batches],
    ["lesson", "external_work_lessons", plan.target.lessons],
    ["settlement", "external_work_monthly_settlements", plan.target.settlements],
    ["settlement detail", "external_work_settlement_details", plan.target.settlementDetails],
    ["income", "income_records", plan.target.incomes],
    ["linkage", "legacy_income_linkage_events", plan.target.linkageEvents],
  ]) {
    invariant(await countIds(tx, table, rows.map((row) => row.id)) === rows.length, `School reconciliation failed: ${label}`);
  }

  const expectedAudits = plan.target.migrationAudits.map((row) => ({
    source_system: row.sourceSystem,
    source_table: row.sourceTable,
    source_id: row.sourceId,
  }));
  const auditRows = await tx.$queryRawUnsafe(
    `select count(*)::int as count
       from public.migration_record_audits a
       join jsonb_to_recordset($1::jsonb) as e(source_system text, source_table text, source_id uuid)
         on a.source_system = e.source_system and a.source_table = e.source_table and a.source_id = e.source_id`,
    JSON.stringify(expectedAudits),
  );
  invariant(auditRows[0]?.count === expectedAudits.length, "School reconciliation failed: migration audits");

  const externalRequests = await tx.$queryRawUnsafe(
    "select count(*)::int as count from public.cash_requests where income_record_id = any($1::uuid[])",
    plan.target.incomes.map((row) => row.id),
  );
  invariant(externalRequests[0]?.count === 0, "School snapshot rehearsal created a Cash request");
}

async function assertCrossSystemLinks(tx, plan) {
  const expectedLinks = plan.target.linkageEvents.map((row) => ({
    id: row.id,
    syncStatus: row.syncStatus,
  }));
  const rows = await tx.$queryRawUnsafe(
    `with expected as (
       select * from jsonb_to_recordset($1::jsonb) as e(id uuid, sync_status text)
     ), links as (
       select l.*, a.id as account_found, a.user_id as account_owner,
              case when l.cash_transaction_table = 'home_jpy_transactions' then j.id
                   when l.cash_transaction_table = 'home_cny_transactions' then c.id end as transaction_found
         from public.legacy_income_linkage_events l
         join expected e on e.id = l.id
         left join public.home_accounts a on a.id = l.cash_account_id
         left join public.home_jpy_transactions j on l.cash_transaction_table = 'home_jpy_transactions' and j.id = l.cash_transaction_id
         left join public.home_cny_transactions c on l.cash_transaction_table = 'home_cny_transactions' and c.id = l.cash_transaction_id
     )
     select count(*)::int as total,
            count(*) filter (where sync_status = 'synced')::int as synced,
            count(*) filter (where sync_status = 'synced' and (account_found is null or account_owner <> cash_user_id))::int as bad_account_owner,
            count(*) filter (where sync_status = 'synced' and transaction_found is null)::int as missing_transaction
       from links`,
    JSON.stringify(expectedLinks),
  );
  const result = rows[0];
  invariant(result?.total === expectedLinks.length, "cross-system linkage count differs");
  invariant(result?.synced === plan.target.linkageEvents.filter((row) => row.syncStatus === "synced").length, "synced linkage count differs");
  invariant(result?.bad_account_owner === 0, "synced linkage has a missing or wrong Cash account owner");
  invariant(result?.missing_transaction === 0, "synced linkage has a missing Cash transaction");
  return { syncedLinkages: result.synced };
}

export async function verifyStagingSnapshotRehearsal({ cashSnapshot, cashOwnerMap, schoolSnapshot, workplaceMap, cashLinkageMap }) {
  const environment = requireStagingTargetEnvironment();
  const cashPlan = buildCashLedgerMigrationPlan(cashSnapshot, cashOwnerMap);
  const schoolPlan = buildExternalWorkMigrationPlan(schoolSnapshot, workplaceMap, { cashLinkageMapping: cashLinkageMap });
  const prisma = new PrismaClient({ adapter: new PrismaPg(environment.targetUrl) });
  try {
    await prisma.$connect();
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("set transaction read only");
      await assertCashState(tx, cashPlan);
      await assertSchoolState(tx, schoolPlan);
      const crossSystem = await assertCrossSystemLinks(tx, schoolPlan);
      return {
        status: "verified",
        targetEnv: environment.targetEnv,
        cashPlanSha256: cashPlan.planSha256,
        schoolPlanSha256: schoolPlan.planSha256,
        cash: cashPlan.summary,
        school: schoolPlan.summary,
        crossSystem,
      };
    }, { timeout: 90_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [cashSnapshotPath, cashOwnerMapPath, schoolSnapshotPath, workplaceMapPath, cashLinkageMapPath] = process.argv.slice(2);
  invariant(
    cashSnapshotPath && cashOwnerMapPath && schoolSnapshotPath && workplaceMapPath && cashLinkageMapPath,
    "usage: node verify-staging-snapshot-rehearsal.mjs <cash-snapshot.json> <cash-owner-map.json> <school-snapshot.json> <workplace-map.json> <cash-linkage-map.json>",
  );
  const [cashSnapshot, cashOwnerMap, schoolSnapshot, workplaceMap, cashLinkageMap] = await Promise.all([
    controlledJson(cashSnapshotPath, "Cash snapshot"),
    controlledJson(cashOwnerMapPath, "Cash owner mapping"),
    controlledJson(schoolSnapshotPath, "School snapshot"),
    controlledJson(workplaceMapPath, "workplace mapping"),
    controlledJson(cashLinkageMapPath, "Cash linkage mapping"),
  ]);
  process.stdout.write(`${JSON.stringify(await verifyStagingSnapshotRehearsal({ cashSnapshot, cashOwnerMap, schoolSnapshot, workplaceMap, cashLinkageMap }), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
