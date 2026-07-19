#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const contractVersion = "aozora-v2-external-work-snapshot-v1";
const scopeStart = "2025-12";
const scopeEnd = "2026-11";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUuid(value, label) {
  invariant(typeof value === "string" && uuidPattern.test(value), `${label} must be a UUID`);
}

function assertScopedMonth(value, label) {
  invariant(
    typeof value === "string" && value >= scopeStart && value <= scopeEnd,
    `${label} must be between ${scopeStart} and ${scopeEnd}`,
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function indexUnique(rows, label) {
  const result = new Map();
  for (const row of rows) {
    assertUuid(row.id, `${label}.id`);
    invariant(!result.has(row.id), `duplicate ${label} id: ${row.id}`);
    result.set(row.id, row);
  }
  return result;
}

function migrationAudit(sourceTable, row, disposition, targetTable, programVersion, importBatchId = null) {
  return {
    importBatchId,
    sourceSystem: "school_v2",
    sourceTable,
    sourceId: row.id,
    targetTable: disposition === "migrated" ? targetTable : null,
    targetId: disposition === "migrated" ? row.id : null,
    disposition,
    sourceRowNumber: row.historicalSourceRow ?? null,
    sourceSnapshot: row,
    sourceSha256: sha256(row),
    migrationProgramVersion: programVersion,
  };
}

function validateHistoricalBatch(batch) {
  assertUuid(batch.id, "batch.id");
  invariant(typeof batch.sourceKey === "string" && batch.sourceKey.length > 0, "batch.sourceKey is required");
  invariant(/^[0-9a-f]{64}$/.test(batch.sourceSha256), "batch.sourceSha256 must be lowercase SHA-256");
  assertScopedMonth(batch.periodStart, "batch.periodStart");
  assertScopedMonth(batch.periodEnd, "batch.periodEnd");
  invariant(batch.periodStart <= batch.periodEnd, "batch period is inverted");
}

function resolveWorkplace(mapping, workplaceName) {
  const target = mapping[workplaceName];
  invariant(target, `missing exact workplace mapping: ${workplaceName}`);
  assertUuid(target.id, `workplace mapping ${workplaceName}.id`);
  invariant(typeof target.code === "string" && target.code.length > 0, `workplace mapping ${workplaceName}.code is required`);
  return target;
}

function mapLinkage(event, income) {
  invariant(event.sourceTable === "school_income_records", `unsupported linkage source table: ${event.sourceTable}`);
  invariant(event.sourceId === event.incomeRecordId, `linkage source identity mismatch: ${event.id}`);
  invariant(event.incomeRecordId === income.id, `linkage income mismatch: ${event.id}`);
  assertUuid(event.legacyBusinessEntityId, `linkage ${event.id}.legacyBusinessEntityId`);
  invariant(event.syncStatus === "historical_confirmed" || event.syncStatus === "synced", `unsupported linkage status: ${event.syncStatus}`);

  if (event.syncStatus === "historical_confirmed") {
    invariant(
      !event.cashUserId &&
        !event.cashAccountId &&
        !event.cashAccountNameSnapshot &&
        !event.cashTransactionTable &&
        !event.cashTransactionId &&
        !event.cashRequestId,
      `historical linkage must not contain Cash context: ${event.id}`,
    );
    invariant(event.confirmedAt && event.syncedAt, `historical linkage timestamps are incomplete: ${event.id}`);
  } else {
    assertUuid(event.cashTransactionId, `synced linkage ${event.id}.cashTransactionId`);
    assertUuid(event.cashUserId, `synced linkage ${event.id}.cashUserId`);
    assertUuid(event.cashAccountId, `synced linkage ${event.id}.cashAccountId`);
    invariant(
      event.cashTransactionTable === "home_jpy_transactions" || event.cashTransactionTable === "home_cny_transactions",
      `unsupported Cash transaction table: ${event.cashTransactionTable}`,
    );
    invariant(event.cashAccountNameSnapshot, `synced linkage account snapshot is missing: ${event.id}`);
  }

  return {
    id: event.id,
    importBatchId: event.importBatchId ?? null,
    incomeRecordId: event.incomeRecordId,
    sourceTable: event.sourceTable,
    sourceId: event.sourceId,
    sourceEventType: event.sourceEventType,
    legacyBusinessEntityId: event.legacyBusinessEntityId,
    cashAccountMappingId: event.cashAccountMappingId ?? null,
    cashUserId: event.cashUserId ?? null,
    cashAccountId: event.cashAccountId ?? null,
    cashAccountNameSnapshot: event.cashAccountNameSnapshot ?? null,
    cashAccountTypeSnapshot: event.cashAccountTypeSnapshot ?? null,
    cashTransactionTable: event.cashTransactionTable ?? null,
    cashTransactionId: event.cashTransactionId ?? null,
    originalCurrency: event.originalCurrency,
    originalAmount: event.originalAmount,
    paymentCurrency: event.paymentCurrency ?? null,
    paymentExchangeRate: event.paymentExchangeRate ?? null,
    paymentAmount: event.paymentAmount ?? null,
    idempotencyKey: event.idempotencyKey,
    syncStatus: event.syncStatus,
    attemptNo: event.attemptNo,
    cashRequestId: event.cashRequestId ?? null,
    cashRequestStatus: event.cashRequestStatus ?? null,
    requestedAt: event.requestedAt ?? null,
    confirmedAt: event.confirmedAt ?? null,
    rejectedAt: event.rejectedAt ?? null,
    rejectedReason: event.rejectedReason ?? null,
    cashRequestLastCheckedAt: event.cashRequestLastCheckedAt ?? null,
    retryCount: event.retryCount,
    lastError: event.lastError ?? null,
    note: event.note ?? null,
    sourceSnapshot: event,
    sourceCreatedAt: event.createdAt,
    sourceUpdatedAt: event.updatedAt,
    sourceSyncedAt: event.syncedAt ?? null,
  };
}

export function buildExternalWorkMigrationPlan(snapshot, workplaceMapping, options = {}) {
  const programVersion = options.programVersion ?? "external-work-plan-v1";
  invariant(snapshot.contractVersion === contractVersion, `snapshot contract must be ${contractVersion}`);
  invariant(snapshot.scope?.yearMonthFrom === scopeStart && snapshot.scope?.yearMonthTo === scopeEnd, "snapshot scope mismatch");

  const batches = snapshot.batches ?? [];
  const lessons = snapshot.lessons ?? [];
  const settlements = snapshot.settlements ?? [];
  const details = snapshot.settlementDetails ?? [];
  const incomes = snapshot.incomes ?? [];
  const linkages = snapshot.linkageEvents ?? [];
  const legacyRequests = snapshot.legacyIncomeRequests ?? [];

  batches.forEach(validateHistoricalBatch);
  const batchById = indexUnique(batches, "batch");
  const lessonById = indexUnique(lessons, "lesson");
  const settlementById = indexUnique(settlements, "settlement");
  const incomeById = indexUnique(incomes, "income");
  indexUnique(details, "settlement detail");
  indexUnique(linkages, "linkage event");
  indexUnique(legacyRequests, "legacy income request");

  const activeActualByPlannedId = new Map();
  for (const lesson of lessons) {
    if (lesson.recordKind !== "actual" || lesson.deletedAt) continue;
    invariant(!activeActualByPlannedId.has(lesson.plannedLessonId), `multiple active actual lessons for planned lesson: ${lesson.plannedLessonId}`);
    activeActualByPlannedId.set(lesson.plannedLessonId, lesson.id);
  }

  const target = {
    batches: [],
    lessons: [],
    settlements: [],
    settlementDetails: [],
    incomes: [],
    linkageEvents: [],
    migrationAudits: [],
    cashRequests: [],
    cashTransactions: [],
  };

  for (const batch of batches) {
    target.batches.push({ ...batch, migrationProgramVersion: programVersion });
    target.migrationAudits.push(migrationAudit("school_historical_part_time_work_import_batches", batch, "migrated", "historical_external_work_import_batches", programVersion, batch.id));
  }

  for (const lesson of lessons) {
    assertScopedMonth(lesson.yearMonth, `lesson ${lesson.id}.yearMonth`);
    if (lesson.historicalImportBatchId) {
      invariant(batchById.has(lesson.historicalImportBatchId), `lesson references missing historical batch: ${lesson.id}`);
      invariant(Number.isInteger(lesson.historicalSourceRow) && lesson.historicalSourceRow > 0, `lesson historical source row is invalid: ${lesson.id}`);
    }
    if (lesson.recordKind === "actual") {
      invariant(lesson.plannedLessonId && lessonById.has(lesson.plannedLessonId), `actual lesson references missing planned lesson: ${lesson.id}`);
      invariant(lessonById.get(lesson.plannedLessonId).recordKind === "planned", `actual lesson parent is not planned: ${lesson.id}`);
    }
    invariant(lesson.recordKind === "planned" || lesson.recordKind === "actual", `unsupported lesson kind: ${lesson.recordKind}`);

    const active = !lesson.deletedAt;
    const workplace = resolveWorkplace(workplaceMapping, lesson.workplaceName);
    if (active) {
      target.lessons.push({
        id: lesson.id,
        workplaceId: workplace.id,
        yearMonth: lesson.yearMonth,
        lessonType: lesson.recordKind,
        plannedLessonId: lesson.plannedLessonId ?? null,
        lessonDate: lesson.workDate,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        durationHours: lesson.recordKind === "planned" ? lesson.plannedHours : lesson.actualHours,
        instructorName: lesson.teacherName,
        lessonTitle: lesson.subjectName ?? null,
        hourlyRateJpy: lesson.hourlyRateJpy,
        transportationFeeJpy: lesson.transportationFeeJpy,
        lessonWageJpy: lesson.lessonWageJpy,
        status:
          lesson.recordKind === "planned"
            ? activeActualByPlannedId.has(lesson.id)
              ? "actual_created"
              : "scheduled"
            : "completed",
        content: lesson.classDescription ?? null,
        memo: lesson.memo ?? null,
        sourceType: "v2_historical_import",
        sourceId: lesson.id,
        historicalImportBatchId: lesson.historicalImportBatchId ?? null,
        historicalSourceRow: lesson.historicalSourceRow ?? null,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
      });
    }
    target.migrationAudits.push(migrationAudit("school_part_time_work_lessons", lesson, active ? "migrated" : "audit_only", "external_work_lessons", programVersion, lesson.historicalImportBatchId ?? null));
  }

  const activeLessonIds = new Set(target.lessons.map((row) => row.id));
  for (const settlement of settlements) {
    assertScopedMonth(settlement.yearMonth, `settlement ${settlement.id}.yearMonth`);
    const active = !settlement.deletedAt;
    const income = settlement.incomeRecordId ? incomeById.get(settlement.incomeRecordId) : null;
    invariant(!settlement.incomeRecordId || income, `settlement references missing income: ${settlement.id}`);
    const workplace = resolveWorkplace(workplaceMapping, settlement.workplaceName);
    if (active) {
      target.settlements.push({
        id: settlement.id,
        workplaceId: workplace.id,
        yearMonth: settlement.yearMonth,
        lessonCount: settlement.actualLessonCount,
        totalLessonHours: settlement.actualHoursTotal,
        lessonWageJpy: settlement.lessonWageJpy,
        transportationFeeJpy: settlement.transportationFeeJpy,
        adjustmentAmountJpy: settlement.adjustmentJpy,
        totalAmountJpy: settlement.totalWageJpy,
        status: income ? "income_created" : "locked",
        calculationSnapshot: { source: settlement, migrationProgramVersion: programVersion },
        incomeRecordId: settlement.incomeRecordId ?? null,
        lockedAt: settlement.lockedAt,
        revokedAt: null,
        memo: settlement.memo ?? null,
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt,
      });
    }
    target.migrationAudits.push(migrationAudit("school_part_time_work_monthly_settlements", settlement, active ? "migrated" : "audit_only", "external_work_monthly_settlements", programVersion));
  }

  const activeSettlementIds = new Set(target.settlements.map((row) => row.id));
  for (const detail of details) {
    const settlement = settlementById.get(detail.settlementId);
    const actualLesson = lessonById.get(detail.actualLessonId);
    invariant(settlement, `detail references missing settlement: ${detail.id}`);
    invariant(actualLesson?.recordKind === "actual", `detail references missing or non-actual lesson: ${detail.id}`);
    const active = activeSettlementIds.has(detail.settlementId) && activeLessonIds.has(detail.actualLessonId) && !detail.deletedAt;
    if (active) {
      target.settlementDetails.push({
        id: detail.id,
        settlementId: detail.settlementId,
        actualLessonId: detail.actualLessonId,
        lessonDate: detail.workDate,
        startTime: detail.startTime,
        endTime: detail.endTime,
        durationHours: detail.actualHours,
        instructorNameSnapshot: detail.teacherName,
        lessonTitleSnapshot: detail.subjectName ?? null,
        hourlyRateJpy: detail.hourlyRateJpy,
        lessonWageJpy: detail.lessonWageJpy,
        transportationFeeJpy: detail.transportationFeeJpy,
        contentSnapshot: detail.classDescription ?? null,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      });
    }
    target.migrationAudits.push(migrationAudit("school_part_time_work_monthly_settlement_details", detail, active ? "migrated" : "audit_only", "external_work_settlement_details", programVersion));
  }

  const linkageByIncome = new Map();
  for (const event of linkages) {
    invariant(!linkageByIncome.has(event.incomeRecordId), `multiple final linkage events for income: ${event.incomeRecordId}`);
    linkageByIncome.set(event.incomeRecordId, event);
  }

  for (const income of incomes) {
    invariant(income.sourceType === "part_time_work", `unsupported income source type: ${income.sourceType}`);
    invariant(settlementById.has(income.sourceId), `income references missing settlement: ${income.id}`);
    const event = linkageByIncome.get(income.id);
    invariant(event, `income has no final linkage event: ${income.id}`);
    const mappedEvent = mapLinkage(event, income);
    target.incomes.push({
      id: income.id,
      sourceType: "external_work",
      sourceId: income.sourceId,
      studentId: null,
      businessEntityId: null,
      yearMonth: income.yearMonth,
      title: income.title,
      originalCurrency: income.currency,
      originalAmountJpy: income.currency === "JPY" ? income.amount : null,
      originalAmountCny: income.currency === "CNY" ? income.amount : null,
      carryoverAmountCny: null,
      recordStatus: event.syncStatus === "synced" ? "cash_confirmed" : "historical_confirmed",
      cashStatus: event.syncStatus === "synced" ? "account_transaction_created" : "not_requested",
      memo: income.memo ?? null,
      createdAt: income.createdAt,
      updatedAt: income.updatedAt,
    });
    target.linkageEvents.push(mappedEvent);
    target.migrationAudits.push(migrationAudit("school_income_records", income, "migrated", "income_records", programVersion, event.importBatchId ?? null));
    target.migrationAudits.push(migrationAudit("school_personal_cash_income_linkage_events", event, "migrated", "legacy_income_linkage_events", programVersion, event.importBatchId ?? null));
  }

  for (const request of legacyRequests) {
    invariant(settlementById.has(request.settlementId), `legacy request references missing settlement: ${request.id}`);
    invariant(request.deletedAt && !request.cashRequestId && !request.cashTransactionId, `legacy request is not audit-only: ${request.id}`);
    target.migrationAudits.push(migrationAudit("school_part_time_work_income_requests", request, "audit_only", null, programVersion));
  }

  invariant(target.cashRequests.length === 0 && target.cashTransactions.length === 0, "School migration must not generate Cash facts");

  const summary = {
    batches: target.batches.length,
    lessons: target.lessons.length,
    settlements: target.settlements.length,
    settlementDetails: target.settlementDetails.length,
    incomes: target.incomes.length,
    linkageEvents: target.linkageEvents.length,
    migrationAudits: target.migrationAudits.length,
    auditOnly: target.migrationAudits.filter((row) => row.disposition === "audit_only").length,
    cashRequests: 0,
    cashTransactions: 0,
    totalSettlementJpy: target.settlements.reduce((sum, row) => sum + row.totalAmountJpy, 0),
  };

  const plan = {
    contractVersion,
    programVersion,
    sourceSnapshotSha256: sha256(snapshot),
    workplaceMappingSha256: sha256(workplaceMapping),
    scope: snapshot.scope,
    summary,
    target,
  };
  return { ...plan, planSha256: sha256(plan) };
}

async function main() {
  const [snapshotPath, workplaceMappingPath] = process.argv.slice(2);
  invariant(snapshotPath && workplaceMappingPath, "usage: node plan-external-work-migration.mjs <snapshot.json> <workplace-map.json>");
  const [snapshot, workplaceMapping] = await Promise.all([
    readFile(snapshotPath, "utf8").then(JSON.parse),
    readFile(workplaceMappingPath, "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(buildExternalWorkMigrationPlan(snapshot, workplaceMapping), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
