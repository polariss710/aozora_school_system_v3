#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildExternalWorkMigrationPlan } from "./plan-external-work-migration.mjs";

const apiRequire = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const { PrismaPg } = apiRequire("@prisma/adapter-pg");
const stagingProjectRef = "bxnxdkbjlxkcqwzzeyds";
const knownProductionProjectRefs = new Set([
  "ahtgiwdzocerkonrjmdo",
  "xlcdqvlfzspcxdoidsrr",
]);
const requiredSchoolMigrationCount = 22;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function dateValue(value) {
  if (value === null || value === undefined) return value;
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

function withTemporalFields(row, fields) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, fields.includes(key) ? dateValue(value) : value]),
  );
}

export function requireStagingTargetEnvironment(environment = process.env) {
  const targetUrl = environment.MIGRATION_TARGET_DATABASE_URL;
  const targetEnv = environment.MIGRATION_TARGET_ENV;
  const targetRef = environment.MIGRATION_TARGET_PROJECT_REF;
  invariant(targetEnv === "staging", "MIGRATION_TARGET_ENV must be staging for a persistent import");
  invariant(targetRef === stagingProjectRef, "MIGRATION_TARGET_PROJECT_REF must be the v3-staging project ref");
  invariant(targetUrl, "MIGRATION_TARGET_DATABASE_URL is required");
  invariant(targetUrl.includes(stagingProjectRef), "target URL does not contain the v3-staging project ref");
  for (const forbiddenRef of knownProductionProjectRefs) {
    invariant(!targetUrl.includes(forbiddenRef), "target URL points at a current production project");
  }
  invariant(environment.MIGRATION_CONFIRM_STAGING_IMPORT === "v3-staging", "set MIGRATION_CONFIRM_STAGING_IMPORT=v3-staging to authorize a staging import");
  return { targetUrl, targetEnv };
}

async function assertExternalControlledFile(filePath, label) {
  const resolved = await realpath(filePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(relative.startsWith("..") && !path.isAbsolute(relative), `${label} must be stored outside the repository`);
  const metadata = await stat(resolved);
  invariant(metadata.isFile(), `${label} must be a regular file`);
  invariant((metadata.mode & 0o077) === 0, `${label} must not be group/world accessible`);
  return resolved;
}

async function loadControlledJson(filePath, label) {
  const controlledPath = await assertExternalControlledFile(filePath, label);
  return JSON.parse(await readFile(controlledPath, "utf8"));
}

async function assertTargetBaseline(prisma) {
  const migrationRows = await prisma.$queryRawUnsafe(
    "select count(*)::int as count from public._prisma_migrations where finished_at is not null and rolled_back_at is null",
  );
  invariant(
    migrationRows[0]?.count === requiredSchoolMigrationCount,
    `target does not have the required ${requiredSchoolMigrationCount} School migrations`,
  );
  const stagingCashRows = await prisma.$queryRawUnsafe(
    "select count(*)::int as count from public.home_accounts where name like 'STAGING Cash %'",
  );
  invariant(stagingCashRows[0]?.count === 4, "target is not the verified v3-staging project");
}

async function assertMappedWorkplaces(prisma, workplaceMapping) {
  for (const [name, target] of Object.entries(workplaceMapping)) {
    const workplace = await prisma.externalWorkplace.findUnique({ where: { id: target.id } });
    invariant(workplace, `mapped staging workplace is missing: ${name}`);
    invariant(workplace.name === name && workplace.code === target.code, `mapped staging workplace differs: ${name}`);
    invariant(workplace.status === "active", `mapped staging workplace is inactive: ${name}`);
  }
}

async function assertMappedCashAccounts(prisma, plan) {
  const synced = plan.target.linkageEvents.filter((row) => row.syncStatus === "synced");
  if (synced.length === 0) return;
  const accountIds = [...new Set(synced.map((row) => row.cashAccountId))];
  const accounts = await prisma.$queryRawUnsafe(
    "select id::text, user_id::text, name from public.home_accounts where id = any($1::uuid[])",
    accountIds,
  );
  const accountById = new Map(accounts.map((row) => [row.id, row]));
  for (const linkage of synced) {
    const account = accountById.get(linkage.cashAccountId);
    invariant(account, `mapped staging Cash account is missing: ${linkage.cashAccountId}`);
    invariant(account.user_id === linkage.cashUserId, `mapped staging Cash account owner differs: ${linkage.cashAccountId}`);
  }
}

async function countPlanRows(tx, plan) {
  const [batches, lessons, settlements, details, incomes, linkages, audits, cashRequests] = await Promise.all([
    tx.historicalExternalWorkImportBatch.count({ where: { id: { in: plan.target.batches.map((row) => row.id) } } }),
    tx.externalWorkLesson.count({ where: { id: { in: plan.target.lessons.map((row) => row.id) } } }),
    tx.externalWorkMonthlySettlement.count({ where: { id: { in: plan.target.settlements.map((row) => row.id) } } }),
    tx.externalWorkSettlementDetail.count({ where: { id: { in: plan.target.settlementDetails.map((row) => row.id) } } }),
    tx.incomeRecord.count({ where: { id: { in: plan.target.incomes.map((row) => row.id) } } }),
    tx.legacyIncomeLinkageEvent.count({ where: { id: { in: plan.target.linkageEvents.map((row) => row.id) } } }),
    tx.migrationRecordAudit.count({
      where: {
        OR: plan.target.migrationAudits.map((row) => ({
          sourceSystem: row.sourceSystem,
          sourceTable: row.sourceTable,
          sourceId: row.sourceId,
        })),
      },
    }),
    tx.cashRequest.count({ where: { incomeRecordId: { in: plan.target.incomes.map((row) => row.id) } } }),
  ]);
  return { batches, lessons, settlements, details, incomes, linkages, audits, cashRequests };
}

function assertCounts(counts, plan) {
  invariant(counts.batches === plan.summary.batches, "batch reconciliation failed");
  invariant(counts.lessons === plan.summary.lessons, "lesson reconciliation failed");
  invariant(counts.settlements === plan.summary.settlements, "settlement reconciliation failed");
  invariant(counts.details === plan.summary.settlementDetails, "detail reconciliation failed");
  invariant(counts.incomes === plan.summary.incomes, "income reconciliation failed");
  invariant(counts.linkages === plan.summary.linkageEvents, "linkage reconciliation failed");
  invariant(counts.audits === plan.summary.migrationAudits, "migration audit reconciliation failed");
  invariant(counts.cashRequests === 0, "School migration created a Cash request");
}

async function existingAuditState(tx, plan) {
  const existing = await tx.migrationRecordAudit.findMany({
    where: {
      OR: plan.target.migrationAudits.map((row) => ({
        sourceSystem: row.sourceSystem,
        sourceTable: row.sourceTable,
        sourceId: row.sourceId,
      })),
    },
    select: { sourceSystem: true, sourceTable: true, sourceId: true, sourceSha256: true, targetTable: true, targetId: true, disposition: true },
  });
  if (existing.length === 0) return "empty";
  invariant(existing.length === plan.summary.migrationAudits, "target contains a partial or unrelated migration batch");
  const expectedByKey = new Map(
    plan.target.migrationAudits.map((row) => [`${row.sourceSystem}:${row.sourceTable}:${row.sourceId}`, row]),
  );
  for (const audit of existing) {
    const expected = expectedByKey.get(`${audit.sourceSystem}:${audit.sourceTable}:${audit.sourceId}`);
    invariant(expected, "target contains an unexpected migration audit");
    invariant(
      audit.sourceSha256 === expected.sourceSha256 &&
        audit.targetTable === expected.targetTable &&
        audit.targetId === expected.targetId &&
        audit.disposition === expected.disposition,
      "target migration audit conflicts with this plan",
    );
  }
  return "already_applied";
}

async function assertFreshTargetIds(tx, plan) {
  const counts = await countPlanRows(tx, plan);
  invariant(
    Object.values(counts).every((value) => value === 0),
    "target contains source UUIDs without a complete matching migration audit",
  );
}

async function createPlan(tx, plan) {
  for (const batch of plan.target.batches) {
    await tx.historicalExternalWorkImportBatch.create({ data: withTemporalFields(batch, ["sourceImportedAt", "sourceCreatedAt"]) });
  }
  for (const lesson of plan.target.lessons.filter((row) => row.lessonType === "planned")) {
    await tx.externalWorkLesson.create({ data: withTemporalFields(lesson, ["lessonDate", "createdAt", "updatedAt"]) });
  }
  for (const lesson of plan.target.lessons.filter((row) => row.lessonType === "actual")) {
    await tx.externalWorkLesson.create({ data: withTemporalFields(lesson, ["lessonDate", "createdAt", "updatedAt"]) });
  }
  for (const income of plan.target.incomes) {
    await tx.incomeRecord.create({ data: withTemporalFields(income, ["createdAt", "updatedAt"]) });
  }
  for (const settlement of plan.target.settlements) {
    await tx.externalWorkMonthlySettlement.create({ data: withTemporalFields(settlement, ["lockedAt", "revokedAt", "createdAt", "updatedAt"]) });
  }
  for (const detail of plan.target.settlementDetails) {
    await tx.externalWorkSettlementDetail.create({ data: withTemporalFields(detail, ["lessonDate", "createdAt", "updatedAt"]) });
  }
  for (const linkageEvent of plan.target.linkageEvents) {
    await tx.legacyIncomeLinkageEvent.create({
      data: withTemporalFields(linkageEvent, ["requestedAt", "confirmedAt", "rejectedAt", "cashRequestLastCheckedAt", "sourceCreatedAt", "sourceUpdatedAt", "sourceSyncedAt"]),
    });
  }
  for (const audit of plan.target.migrationAudits) {
    await tx.migrationRecordAudit.create({ data: audit });
  }
}

export async function applyExternalWorkPlan(plan, workplaceMapping, environment = requireStagingTargetEnvironment()) {
  const prisma = new PrismaClient({ adapter: new PrismaPg(environment.targetUrl) });
  try {
    await prisma.$connect();
    await assertTargetBaseline(prisma);
    await assertMappedWorkplaces(prisma, workplaceMapping);
    await assertMappedCashAccounts(prisma, plan);
    return await prisma.$transaction(async (tx) => {
      const state = await existingAuditState(tx, plan);
      if (state === "already_applied") {
        assertCounts(await countPlanRows(tx, plan), plan);
        return { status: "already_applied", planSha256: plan.planSha256, summary: plan.summary };
      }
      await assertFreshTargetIds(tx, plan);
      await createPlan(tx, plan);
      assertCounts(await countPlanRows(tx, plan), plan);
      return { status: "applied", planSha256: plan.planSha256, summary: plan.summary };
    }, { timeout: 90_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [snapshotPath, workplaceMappingPath, cashLinkageMappingPath, applyFlag] = process.argv.slice(2);
  invariant(
    snapshotPath && workplaceMappingPath && cashLinkageMappingPath && applyFlag === "--apply",
    "usage: node apply-external-work-plan.mjs <snapshot.json> <workplace-map.json> <cash-linkage-map.json> --apply",
  );
  const [snapshot, workplaceMapping, cashLinkageMapping] = await Promise.all([
    loadControlledJson(snapshotPath, "snapshot"),
    loadControlledJson(workplaceMappingPath, "workplace mapping"),
    loadControlledJson(cashLinkageMappingPath, "Cash linkage mapping"),
  ]);
  const plan = buildExternalWorkMigrationPlan(snapshot, workplaceMapping, { cashLinkageMapping });
  process.stdout.write(`${JSON.stringify(await applyExternalWorkPlan(plan, workplaceMapping), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
