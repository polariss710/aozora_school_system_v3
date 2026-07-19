#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildExternalWorkMigrationPlan } from "./plan-external-work-migration.mjs";

const apiRequire = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const { PrismaPg } = apiRequire("@prisma/adapter-pg");
const knownProductionProjectRefs = new Set([
  "ahtgiwdzocerkonrjmdo",
  "xlcdqvlfzspcxdoidsrr",
]);
const rollbackMarker = "STAGING-E2E-MIGRATION-PLAN rollback-only";

class RollbackVerified extends Error {}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function requireTargetEnvironment() {
  const targetUrl = process.env.MIGRATION_TEST_DATABASE_URL;
  const targetEnv = process.env.MIGRATION_TEST_ENV;
  const targetRef = process.env.MIGRATION_TEST_PROJECT_REF;
  invariant(targetEnv === "dev" || targetEnv === "staging", "MIGRATION_TEST_ENV must be dev or staging");
  invariant(targetUrl, "MIGRATION_TEST_DATABASE_URL is required");
  invariant(targetRef, "MIGRATION_TEST_PROJECT_REF is required");
  invariant(targetUrl.includes(targetRef), "target URL does not contain MIGRATION_TEST_PROJECT_REF");
  invariant(!knownProductionProjectRefs.has(targetRef), "production project refs are forbidden");
  for (const forbiddenRef of knownProductionProjectRefs) {
    invariant(!targetUrl.includes(forbiddenRef), "target URL points at a current production project");
  }
  return { targetUrl, targetEnv };
}

async function createMappedWorkplaces(tx, workplaceMapping) {
  for (const [name, target] of Object.entries(workplaceMapping)) {
    const existing = await tx.externalWorkplace.findUnique({ where: { id: target.id } });
    if (existing) {
      invariant(existing.code === target.code && existing.name === name, `workplace mapping conflicts with target: ${name}`);
      continue;
    }
    await tx.externalWorkplace.create({
      data: { id: target.id, code: target.code, name, memo: rollbackMarker },
    });
  }
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

async function applyPlan(tx, plan) {
  for (const batch of plan.target.batches) {
    await tx.historicalExternalWorkImportBatch.create({
      data: withTemporalFields(batch, ["sourceImportedAt", "sourceCreatedAt"]),
    });
  }
  for (const lesson of plan.target.lessons.filter((row) => row.lessonType === "planned")) {
    await tx.externalWorkLesson.create({
      data: withTemporalFields(lesson, ["lessonDate", "createdAt", "updatedAt"]),
    });
  }
  for (const lesson of plan.target.lessons.filter((row) => row.lessonType === "actual")) {
    await tx.externalWorkLesson.create({
      data: withTemporalFields(lesson, ["lessonDate", "createdAt", "updatedAt"]),
    });
  }
  for (const income of plan.target.incomes) {
    await tx.incomeRecord.create({ data: withTemporalFields(income, ["createdAt", "updatedAt"]) });
  }
  for (const settlement of plan.target.settlements) {
    await tx.externalWorkMonthlySettlement.create({
      data: withTemporalFields(settlement, ["lockedAt", "revokedAt", "createdAt", "updatedAt"]),
    });
  }
  for (const detail of plan.target.settlementDetails) {
    await tx.externalWorkSettlementDetail.create({
      data: withTemporalFields(detail, ["lessonDate", "createdAt", "updatedAt"]),
    });
  }
  for (const linkageEvent of plan.target.linkageEvents) {
    await tx.legacyIncomeLinkageEvent.create({
      data: withTemporalFields(linkageEvent, [
        "requestedAt",
        "confirmedAt",
        "rejectedAt",
        "cashRequestLastCheckedAt",
        "sourceCreatedAt",
        "sourceUpdatedAt",
        "sourceSyncedAt",
      ]),
    });
  }
  for (const audit of plan.target.migrationAudits) {
    await tx.migrationRecordAudit.create({ data: audit });
  }
}

async function assertApplied(tx, plan) {
  const [batches, lessons, settlements, details, incomes, linkages, audits, cashRequests] = await Promise.all([
    tx.historicalExternalWorkImportBatch.count({ where: { id: { in: plan.target.batches.map((row) => row.id) } } }),
    tx.externalWorkLesson.count({ where: { id: { in: plan.target.lessons.map((row) => row.id) } } }),
    tx.externalWorkMonthlySettlement.count({ where: { id: { in: plan.target.settlements.map((row) => row.id) } } }),
    tx.externalWorkSettlementDetail.count({ where: { id: { in: plan.target.settlementDetails.map((row) => row.id) } } }),
    tx.incomeRecord.count({ where: { id: { in: plan.target.incomes.map((row) => row.id) } } }),
    tx.legacyIncomeLinkageEvent.count({ where: { id: { in: plan.target.linkageEvents.map((row) => row.id) } } }),
    tx.migrationRecordAudit.count({ where: { sourceSha256: { in: plan.target.migrationAudits.map((row) => row.sourceSha256) } } }),
    tx.cashRequest.count({ where: { incomeRecordId: { in: plan.target.incomes.map((row) => row.id) } } }),
  ]);
  invariant(batches === plan.summary.batches, "batch reconciliation failed");
  invariant(lessons === plan.summary.lessons, "lesson reconciliation failed");
  invariant(settlements === plan.summary.settlements, "settlement reconciliation failed");
  invariant(details === plan.summary.settlementDetails, "detail reconciliation failed");
  invariant(incomes === plan.summary.incomes, "income reconciliation failed");
  invariant(linkages === plan.summary.linkageEvents, "linkage reconciliation failed");
  invariant(audits === plan.summary.migrationAudits, "audit reconciliation failed");
  invariant(cashRequests === 0, "School migration created a Cash request");
}

async function assertTargetBaseline(prisma, targetEnv) {
  const migrationRows = await prisma.$queryRawUnsafe(
    'select count(*)::int as count from public._prisma_migrations where finished_at is not null and rolled_back_at is null',
  );
  invariant(migrationRows[0]?.count === 21, "target does not have the required 21 School migrations");
  if (targetEnv === "staging") {
    const stagingCashRows = await prisma.$queryRawUnsafe(
      "select count(*)::int as count from public.home_accounts where name like 'STAGING Cash %'",
    );
    invariant(stagingCashRows[0]?.count === 4, "target is not the verified v3-staging project");
  }
}

async function assertRollback(prisma, plan, workplaceMapping) {
  const [batches, incomes, workplaces] = await Promise.all([
    prisma.historicalExternalWorkImportBatch.count({ where: { id: { in: plan.target.batches.map((row) => row.id) } } }),
    prisma.incomeRecord.count({ where: { id: { in: plan.target.incomes.map((row) => row.id) } } }),
    prisma.externalWorkplace.count({ where: { id: { in: Object.values(workplaceMapping).map((row) => row.id) }, memo: rollbackMarker } }),
  ]);
  invariant(batches === 0 && incomes === 0 && workplaces === 0, "rollback left synthetic migration records behind");
}

export async function verifyRollbackPlanApply(snapshot, workplaceMapping, environment = requireTargetEnvironment()) {
  const plan = buildExternalWorkMigrationPlan(snapshot, workplaceMapping);
  const prisma = new PrismaClient({ adapter: new PrismaPg(environment.targetUrl) });
  try {
    await prisma.$connect();
    await assertTargetBaseline(prisma, environment.targetEnv);
    try {
      await prisma.$transaction(async (tx) => {
        await createMappedWorkplaces(tx, workplaceMapping);
        await applyPlan(tx, plan);
        await assertApplied(tx, plan);
        throw new RollbackVerified();
      }, { timeout: 30_000 });
    } catch (error) {
      if (!(error instanceof RollbackVerified)) throw error;
    }
    await assertRollback(prisma, plan, workplaceMapping);
    return { planSha256: plan.planSha256, summary: plan.summary, targetEnv: environment.targetEnv, rollbackResiduals: 0 };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [snapshotPath, workplaceMappingPath] = process.argv.slice(2);
  invariant(snapshotPath && workplaceMappingPath, "usage: node verify-external-work-plan-apply.mjs <snapshot.json> <workplace-map.json>");
  const [snapshot, workplaceMapping] = await Promise.all([
    readFile(snapshotPath, "utf8").then(JSON.parse),
    readFile(workplaceMappingPath, "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(await verifyRollbackPlanApply(snapshot, workplaceMapping), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
