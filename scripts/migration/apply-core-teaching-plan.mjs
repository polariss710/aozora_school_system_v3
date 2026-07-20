#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildCoreTeachingMigrationPlan } from "./plan-core-teaching-migration.mjs";
import { prepareCoreTeachingStagingImport } from "./prepare-core-teaching-staging-import.mjs";
import { canonicalJsonSha256 } from "./validate-core-teaching-snapshot.mjs";
import { requireStagingTargetEnvironment } from "./apply-external-work-plan.mjs";

const apiRequire = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const { PrismaClient } = apiRequire("@prisma/client");
const { PrismaPg } = apiRequire("@prisma/adapter-pg");
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requiredSchoolMigrationCount = 26;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function dateValue(value) {
  if (value === null || value === undefined) return value;
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

function withTemporalFields(row, fields) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, fields.includes(key) ? dateValue(value) : value]));
}

async function loadPrivateJson(filePath, label) {
  const resolved = await realpath(filePath);
  const relative = path.relative(repositoryRoot, resolved);
  invariant(relative.startsWith("..") && !path.isAbsolute(relative), `${label} must be stored outside the repository`);
  const metadata = await stat(resolved);
  invariant(metadata.isFile(), `${label} must be a regular file`);
  invariant((metadata.mode & 0o077) === 0, `${label} must not be group/world accessible`);
  return JSON.parse(await readFile(resolved, "utf8"));
}

async function assertTargetBaseline(prisma) {
  const migrations = await prisma.$queryRawUnsafe("select count(*)::int as count from public._prisma_migrations where finished_at is not null and rolled_back_at is null");
  invariant(migrations[0]?.count === requiredSchoolMigrationCount, `target does not have the required ${requiredSchoolMigrationCount} School migrations`);
  const stagingCash = await prisma.$queryRawUnsafe("select count(*)::int as count from public.home_accounts where name like 'STAGING Cash %'");
  invariant(stagingCash[0]?.count === 4, "target is not the verified v3-staging project");
}

async function countPlanRows(tx, plan) {
  const ids = (rows) => rows.map((row) => row.id);
  const auditKeys = plan.target.migrationAudits.map((row) => ({ sourceSystem: row.sourceSystem, sourceTable: row.sourceTable, sourceId: row.sourceId }));
  const [batches, businessEntities, students, teachers, subjects, plannedLessons, actualLessons, settlements, bills, incomes, expenses, audits, cashRequests] = await Promise.all([
    tx.coreTeachingMigrationBatch.count({ where: { id: plan.batch.id } }),
    tx.businessEntity.count({ where: { id: { in: ids(plan.target.businessEntities) } } }),
    tx.student.count({ where: { id: { in: ids(plan.target.students) } } }),
    tx.teacher.count({ where: { id: { in: ids(plan.target.teachers) } } }),
    tx.subject.count({ where: { id: { in: ids(plan.target.subjects) } } }),
    tx.studentPlannedLesson.count({ where: { id: { in: ids(plan.target.plannedLessons) } } }),
    tx.studentActualLesson.count({ where: { id: { in: ids(plan.target.actualLessons) } } }),
    tx.studentMonthlySettlement.count({ where: { id: { in: ids(plan.target.studentSettlements) } } }),
    tx.studentTuitionBill.count({ where: { id: { in: ids(plan.target.tuitionBills) } } }),
    tx.incomeRecord.count({ where: { id: { in: ids(plan.target.incomes) } } }),
    tx.expenseRecord.count({ where: { id: { in: ids(plan.target.expenses) } } }),
    tx.migrationRecordAudit.count({ where: { OR: auditKeys } }),
    tx.cashRequest.count({ where: { OR: [{ incomeRecordId: { in: ids(plan.target.incomes) } }, { expenseRecordId: { in: ids(plan.target.expenses) } }] } }),
  ]);
  return { batches, businessEntities, students, teachers, subjects, plannedLessons, actualLessons, settlements, bills, incomes, expenses, audits, cashRequests };
}

function assertCounts(counts, expected) {
  invariant(counts.batches === 1, "batch reconciliation failed");
  for (const [field, expectedCount] of Object.entries(expected)) {
    if (field === "exclusions" || field === "cashTransactions") continue;
    const countField = field === "studentSettlements" ? "settlements" : field === "tuitionBills" ? "bills" : field === "recordAudits" ? "audits" : field;
    invariant(counts[countField] === expectedCount, `${field} reconciliation failed`);
  }
  invariant(counts.cashRequests === 0, "core teaching migration created a Cash request");
}

async function assertExistingBatch(tx, plan) {
  const existing = await tx.coreTeachingMigrationBatch.findUnique({ where: { sourceKey: plan.batch.sourceKey } });
  if (!existing) return false;
  invariant(existing.id === plan.batch.id, "existing core teaching batch id differs");
  invariant(existing.sourceSha256 === plan.batch.sourceSha256, "existing core teaching batch snapshot hash differs");
  invariant(existing.sourceFilename === plan.batch.sourceFilename, "existing core teaching batch source filename differs");
  invariant(canonicalJsonSha256(existing.expectedSummary) === canonicalJsonSha256(plan.batch.expectedSummary), "existing core teaching batch expected summary differs");
  return true;
}

async function assertFreshTargetIds(tx, plan) {
  const counts = await countPlanRows(tx, plan);
  invariant(Object.values(counts).every((value) => value === 0), "target contains core teaching UUIDs without the complete matching batch");
}

async function createPlan(tx, plan) {
  await tx.coreTeachingMigrationBatch.create({ data: plan.batch });
  for (const row of plan.target.businessEntities) await tx.businessEntity.create({ data: withTemporalFields(row, ["createdAt", "updatedAt"]) });
  for (const row of plan.target.students) await tx.student.create({ data: withTemporalFields(row, ["createdAt", "updatedAt"]) });
  for (const row of plan.target.teachers) await tx.teacher.create({ data: withTemporalFields(row, ["createdAt", "updatedAt"]) });
  for (const row of plan.target.subjects) await tx.subject.create({ data: withTemporalFields(row, ["createdAt", "updatedAt"]) });
  for (const row of plan.target.plannedLessons) await tx.studentPlannedLesson.create({ data: withTemporalFields(row, ["weekAnchorDate", "createdAt", "updatedAt"]) });
  for (const row of plan.target.actualLessons) await tx.studentActualLesson.create({ data: withTemporalFields(row, ["actualDate", "createdAt", "updatedAt"]) });
  for (const row of plan.target.incomes) await tx.incomeRecord.create({ data: withTemporalFields(row, ["createdAt", "updatedAt"]) });
  for (const row of plan.target.tuitionBills) await tx.studentTuitionBill.create({ data: withTemporalFields(row, ["generatedAt", "createdAt", "updatedAt"]) });
  for (const row of plan.target.studentSettlements) await tx.studentMonthlySettlement.create({ data: withTemporalFields(row, ["lockedAt", "revokedAt", "createdAt", "updatedAt"]) });
  for (const row of plan.target.expenses) await tx.expenseRecord.create({ data: withTemporalFields(row, ["createdAt", "updatedAt"]) });
  for (const row of plan.target.migrationAudits) await tx.migrationRecordAudit.create({ data: row });
}

export async function applyCoreTeachingPlan(plan, environment = process.env) {
  invariant(environment.MIGRATION_CONFIRM_CORE_TEACHING_APPLY === "core-teaching-staging", "set MIGRATION_CONFIRM_CORE_TEACHING_APPLY=core-teaching-staging to authorize this import");
  const target = requireStagingTargetEnvironment(environment);
  const prisma = new PrismaClient({ adapter: new PrismaPg(target.targetUrl) });
  try {
    await prisma.$connect();
    await assertTargetBaseline(prisma);
    return await prisma.$transaction(async (tx) => {
      if (await assertExistingBatch(tx, plan)) {
        assertCounts(await countPlanRows(tx, plan), plan.expectedSummary);
        return { status: "already_applied", planSha256: plan.planSha256, expectedSummary: plan.expectedSummary };
      }
      await assertFreshTargetIds(tx, plan);
      await createPlan(tx, plan);
      assertCounts(await countPlanRows(tx, plan), plan.expectedSummary);
      return { status: "applied", planSha256: plan.planSha256, expectedSummary: plan.expectedSummary };
    }, { timeout: 90_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [snapshotPath, exclusionsPath, aggregatePath, applyFlag] = process.argv.slice(2);
  invariant(snapshotPath && exclusionsPath && aggregatePath && applyFlag === "--apply", "usage: node apply-core-teaching-plan.mjs <snapshot.json> <exclusions.json> <aggregate.json> --apply");
  const [snapshot, exclusions, aggregateInventory] = await Promise.all([
    loadPrivateJson(snapshotPath, "snapshot"), loadPrivateJson(exclusionsPath, "exclusion manifest"), loadPrivateJson(aggregatePath, "aggregate inventory"),
  ]);
  prepareCoreTeachingStagingImport({ snapshot, exclusionManifest: exclusions, aggregateInventory, environment: process.env });
  const plan = buildCoreTeachingMigrationPlan(snapshot, exclusions);
  process.stdout.write(`${JSON.stringify(await applyCoreTeachingPlan(plan), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
