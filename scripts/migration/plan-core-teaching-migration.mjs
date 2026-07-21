#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalJsonSha256, validateCoreTeachingSnapshot } from "./validate-core-teaching-snapshot.mjs";

const programVersion = "core-teaching-staging-v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceRow(row, label) {
  invariant(row?.sourceRow && typeof row.sourceRow === "object", `${label} sourceRow is required`);
  return row.sourceRow;
}

function required(value, label) {
  invariant(value !== null && value !== undefined && value !== "", `${label} is required`);
  return value;
}

function integer(value, label) {
  const parsed = Number(value);
  invariant(Number.isInteger(parsed), `${label} must be an integer`);
  return parsed;
}

function decimal(value, label) {
  invariant(value !== null && value !== undefined && value !== "", `${label} is required`);
  return String(value);
}

function optionalDecimal(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function optionalDate(value) {
  return value === null || value === undefined ? null : value;
}

function mondayAnchorForDate(value, label) {
  const dateValue = required(value, label);
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(dateValue), `${label} must be YYYY-MM-DD`);
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  invariant(!Number.isNaN(date.getTime()), `${label} must be a valid date`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function recordStatus(active) {
  return active === false ? "inactive" : "active";
}

function studentStatus(status) {
  return status === "active" ? "active" : "inactive";
}

function teacherStatus(status) {
  return status === "employed" || status === "active" ? "active" : "inactive";
}

function plannedStatus(row, actualByPlannedId) {
  const actual = actualByPlannedId.get(row.id);
  if (actual?.status === "makeup_completed") return "makeup_completed";
  if (actual?.status === "completed") return "actual_created";
  if (row.status === "pending_makeup") return "makeup_pending";
  if (row.status === "planned") return "scheduled";
  if (row.status === "cancelled") return "cancelled";
  throw new Error(`unsupported planned lesson status: ${row.status}`);
}

function actualStatus(status) {
  if (status === "completed" || status === "makeup_completed") return "completed";
  if (status === "cancelled") return "cancelled";
  throw new Error(`unsupported actual lesson status: ${status}`);
}

function tuitionBillStatus(status) {
  if (status === "income_created") return "income_created";
  if (status === "cancelled") return "voided";
  if (status === "generated") return "generated";
  throw new Error(`unsupported tuition bill status: ${status}`);
}

function historicalRecordStatus(status, label) {
  if (status === "received" || status === "paid") return "historical_confirmed";
  if (status === "cancelled") return "voided";
  throw new Error(`unsupported ${label} status: ${status}`);
}

function currency(value, label) {
  invariant(value === "JPY" || value === "CNY", `${label} must be JPY or CNY`);
  return value;
}

function deterministicBatchId(sourceKey) {
  const hex = createHash("sha256").update(`aozora-core-teaching:${sourceKey}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 17), 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function namespacedLegacyCode(value, label) {
  return `V2-${required(value, label)}`;
}

function optionalNamespacedLegacyCode(value) {
  return value === null || value === undefined || value === "" ? null : `V2-${value}`;
}

function audit(sourceTable, sourceId, targetTable, targetId, disposition, raw, batchId) {
  return {
    coreTeachingBatchId: batchId,
    sourceSystem: "school_v2",
    sourceTable,
    sourceId,
    targetTable,
    targetId,
    disposition,
    sourceRowNumber: null,
    sourceSnapshot: raw,
    sourceSha256: canonicalJsonSha256(raw),
    migrationProgramVersion: programVersion,
  };
}

function buildExpectedSummary(target, exclusions) {
  return {
    businessEntities: target.businessEntities.length,
    students: target.students.length,
    teachers: target.teachers.length,
    subjects: target.subjects.length,
    plannedLessons: target.plannedLessons.length,
    actualLessons: target.actualLessons.length,
    studentSettlements: target.studentSettlements.length,
    tuitionBills: target.tuitionBills.length,
    incomes: target.incomes.length,
    expenses: target.expenses.length,
    recordAudits: target.migrationAudits.length,
    exclusions: exclusions.length,
    cashRequests: 0,
    cashTransactions: 0,
  };
}

export function buildCoreTeachingMigrationPlan(snapshot, exclusionManifest) {
  const snapshotValidation = validateCoreTeachingSnapshot(snapshot, exclusionManifest);
  const batchId = deterministicBatchId(snapshot.sourceKey);
  const actualRowsByPlannedId = new Map();
  for (const row of snapshot.facts.actualLessons.filter((row) => row.plannedLessonId)) {
    const rows = actualRowsByPlannedId.get(row.plannedLessonId) ?? [];
    rows.push(row);
    actualRowsByPlannedId.set(row.plannedLessonId, rows);
  }
  for (const rows of actualRowsByPlannedId.values()) rows.sort((left, right) => left.id.localeCompare(right.id));
  const actualByPlannedId = new Map([...actualRowsByPlannedId.entries()].map(([plannedId, rows]) => [plannedId, sourceRow(rows[0], "actual lesson")]));
  const billRowsByStudentMonth = new Map();
  for (const row of snapshot.facts.tuitionBills) {
    const key = `${row.studentId}:${row.billingMonth}`;
    const rows = billRowsByStudentMonth.get(key) ?? [];
    rows.push(row);
    billRowsByStudentMonth.set(key, rows);
  }
  for (const rows of billRowsByStudentMonth.values()) rows.sort((left, right) => left.id.localeCompare(right.id));

  const target = {
    businessEntities: snapshot.referenceData.businessEntities.map((row) => {
      const raw = sourceRow(row, "business entity");
      return {
        id: row.id, code: namespacedLegacyCode(raw.code, "business entity code"), name: required(raw.name, "business entity name"),
        status: recordStatus(raw.is_active), memo: raw.note ?? null, legacyTable: row.legacyTable, legacyId: row.legacyId,
        createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    students: snapshot.referenceData.students.map((row) => {
      const raw = sourceRow(row, "student");
      return {
        id: row.id, code: optionalNamespacedLegacyCode(raw.student_code), name: required(raw.name ?? raw.display_name, "student name"), kanaName: raw.kana_name ?? null,
        status: studentStatus(raw.status), primaryBusinessEntityId: raw.business_entity_id ?? null, memo: raw.note ?? null,
        legacyTable: row.legacyTable, legacyId: row.legacyId, createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    teachers: snapshot.referenceData.teachers.map((row) => {
      const raw = sourceRow(row, "teacher");
      return {
        id: row.id, code: optionalNamespacedLegacyCode(raw.teacher_code), name: required(raw.name ?? raw.display_name, "teacher name"), kanaName: raw.kana_name ?? null,
        status: teacherStatus(raw.status), memo: raw.note ?? null, legacyTable: row.legacyTable, legacyId: row.legacyId,
        createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    subjects: snapshot.referenceData.subjects.map((row) => {
      const raw = sourceRow(row, "subject");
      return {
        id: row.id, code: `V2-${row.id}`, name: required(raw.name, "subject name"), category: raw.primary_category ?? raw.category ?? null,
        sortOrder: integer(raw.sort_order ?? 0, "subject sortOrder"), status: recordStatus(raw.is_active), memo: raw.note ?? null,
        legacyTable: row.legacyTable, legacyId: row.legacyId, createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    plannedLessons: snapshot.facts.plannedLessons.map((row) => {
      const raw = sourceRow(row, "planned lesson");
      const plannedDate = required(raw.lesson_date, "planned lesson date");
      return {
        id: row.id, studentId: row.studentId, teacherId: row.teacherId, subjectId: row.subjectId, businessEntityId: row.businessEntityId,
        yearMonth: row.yearMonth, weekAnchorDate: mondayAnchorForDate(plannedDate, "planned lesson date"), plannedDate, lessonNo: raw.lesson_count ?? null,
        plannedStartTime: raw.start_time ?? null, plannedEndTime: raw.end_time ?? null, durationHours: decimal(raw.duration_hours, "planned lesson duration"),
        plannedFeeJpy: integer(raw.lesson_fee ?? 0, "planned lesson fee"), content: raw.lesson_content ?? null, memo: raw.note ?? null,
        status: plannedStatus(raw, actualByPlannedId), sourceType: "legacy_v2_import", sourceId: row.id,
        createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    actualLessons: snapshot.facts.actualLessons.map((row) => {
      const raw = sourceRow(row, "actual lesson");
      const ordinal = row.plannedLessonId ? actualRowsByPlannedId.get(row.plannedLessonId).findIndex((candidate) => candidate.id === row.id) : -1;
      return {
        id: row.id, plannedLessonId: ordinal <= 0 ? row.plannedLessonId ?? null : null, legacyPlannedLessonId: ordinal > 0 ? row.plannedLessonId : null, studentId: row.studentId, teacherId: row.teacherId, subjectId: row.subjectId,
        businessEntityId: row.businessEntityId, yearMonth: row.yearMonth, actualDate: required(raw.lesson_date, "actual lesson date"),
        startTime: raw.start_time ?? null, endTime: raw.end_time ?? null, durationHours: decimal(raw.duration_hours, "actual lesson duration"),
        content: raw.lesson_content ?? null, memo: raw.note ?? null, status: actualStatus(raw.status),
        teacherWageEligible: raw.is_billable !== false, sourceType: "legacy_v2_import", sourceId: row.id,
        createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    studentSettlements: snapshot.facts.studentSettlements.map((row) => {
      const raw = sourceRow(row, "student settlement");
      return {
        id: row.id, studentId: row.studentId, yearMonth: row.yearMonth,
        plannedLessonCount: integer(raw.planned_lesson_count, "settlement plannedLessonCount"), billableLessonCount: integer(raw.billable_lesson_count, "settlement billableLessonCount"),
        cancelledLessonCount: integer(raw.cancelled_lesson_count, "settlement cancelledLessonCount"), actualLessonCount: integer(raw.actual_lesson_count, "settlement actualLessonCount"),
        plannedAmountJpy: integer(raw.planned_amount_jpy, "settlement plannedAmountJpy"), billableAmountJpy: integer(raw.billable_amount_jpy, "settlement billableAmountJpy"),
        receivedAmountJpy: integer(raw.received_amount_jpy ?? 0, "settlement receivedAmountJpy"), receivedAmountCny: decimal(raw.received_amount_cny ?? 0, "settlement receivedAmountCny"),
        previousCarryoverAmountCny: decimal(raw.previous_carryover_amount_cny ?? 0, "settlement previousCarryoverAmountCny"), settlementExchangeRate: optionalDecimal(raw.settlement_exchange_rate),
        adjustmentAmountCny: decimal(raw.adjustment_amount_cny ?? 0, "settlement adjustmentAmountCny"), carryoverAmountCny: decimal(raw.carryover_amount_cny ?? 0, "settlement carryoverAmountCny"),
        status: raw.status === "revoked" ? "revoked" : "locked", calculationSnapshot: raw.calculation_snapshot ?? raw,
        lockedAt: raw.locked_at ?? raw.created_at, revokedAt: optionalDate(raw.revoked_at), memo: raw.note ?? null, createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    tuitionBills: snapshot.facts.tuitionBills.map((row) => {
      const raw = sourceRow(row, "tuition bill");
      const billRows = billRowsByStudentMonth.get(`${row.studentId}:${row.billingMonth}`);
      const version = billRows.findIndex((candidate) => candidate.id === row.id) + 1;
      return {
        id: row.id, studentId: row.studentId, yearMonth: row.billingMonth, version,
        plannedLessonCount: integer(raw.planned_lesson_count ?? 0, "tuition bill plannedLessonCount"), plannedAmountJpy: integer(raw.planned_lesson_fee_jpy ?? raw.bill_amount_jpy ?? 0, "tuition bill plannedAmountJpy"),
        carryoverAmountCny: decimal(raw.previous_carryover_cny ?? 0, "tuition bill carryoverAmountCny"), status: tuitionBillStatus(raw.status),
        calculationSnapshot: raw.source_snapshot ?? raw, incomeRecordId: row.incomeRecordId ?? null, replacesId: null,
        generatedAt: raw.created_at, createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    incomes: snapshot.facts.incomes.map((row) => {
      const raw = sourceRow(row, "income");
      const originalCurrency = currency(raw.currency, "income currency");
      return {
        id: row.id, sourceType: "legacy_v2_import", sourceId: row.id, studentId: row.studentId ?? null, businessEntityId: row.businessEntityId ?? null,
        yearMonth: row.yearMonth ?? null, title: required(raw.source_label ?? raw.income_category ?? raw.description, "income title"), originalCurrency,
        originalAmountJpy: originalCurrency === "JPY" ? integer(raw.amount_jpy ?? raw.amount, "income amountJpy") : null,
        originalAmountCny: originalCurrency === "CNY" ? decimal(raw.amount_cny ?? raw.amount, "income amountCny") : null,
        carryoverAmountCny: optionalDecimal(raw.previous_carryover_cny), recordStatus: historicalRecordStatus(raw.status, "income"), cashStatus: "not_requested",
        memo: raw.note ?? null, createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    expenses: snapshot.facts.expenses.map((row) => {
      const raw = sourceRow(row, "expense");
      const originalCurrency = currency(raw.currency, "expense currency");
      return {
        id: row.id, sourceType: "legacy_v2_import", sourceId: row.id, teacherId: row.teacherId ?? null, businessEntityId: row.businessEntityId ?? null,
        yearMonth: row.yearMonth ?? null, title: required(raw.expense_category ?? raw.description, "expense title"), originalCurrency,
        originalAmountJpy: originalCurrency === "JPY" ? integer(raw.amount_jpy ?? raw.amount, "expense amountJpy") : null,
        originalAmountCny: originalCurrency === "CNY" ? decimal(raw.amount_cny ?? raw.amount, "expense amountCny") : null,
        recordStatus: historicalRecordStatus(raw.status, "expense"), cashStatus: "not_requested", memo: raw.note ?? null,
        createdAt: raw.created_at, updatedAt: raw.updated_at,
      };
    }),
    migrationAudits: [],
  };

  const migratedSections = [
    ["businessEntities", "school_business_entities", "business_entities", snapshot.referenceData.businessEntities],
    ["students", "school_students", "students", snapshot.referenceData.students],
    ["teachers", "school_teachers", "teachers", snapshot.referenceData.teachers],
    ["subjects", "school_subjects", "subjects", snapshot.referenceData.subjects],
    ["plannedLessons", "school_lesson_records", "student_planned_lessons", snapshot.facts.plannedLessons],
    ["actualLessons", "school_lesson_records", "student_actual_lessons", snapshot.facts.actualLessons],
    ["studentSettlements", "school_student_monthly_settlements", "student_monthly_settlements", snapshot.facts.studentSettlements],
    ["tuitionBills", "school_student_tuition_bills", "student_tuition_bills", snapshot.facts.tuitionBills],
    ["incomes", "school_income_records", "income_records", snapshot.facts.incomes],
    ["expenses", "school_expense_records", "expense_records", snapshot.facts.expenses],
  ];
  for (const [section, sourceTable, targetTable, sourceRows] of migratedSections) {
    for (const source of sourceRows) target.migrationAudits.push(audit(sourceTable, source.id, targetTable, source.id, "migrated", sourceRow(source, section), batchId));
  }
  for (const candidate of snapshot.omissionCandidates) {
    target.migrationAudits.push(audit(candidate.sourceTable, candidate.sourceId, null, null, "audit_only", candidate, batchId));
  }

  const expectedSummary = buildExpectedSummary(target, snapshot.omissionCandidates);
  const batch = {
    id: batchId, sourceKey: snapshot.sourceKey, sourceSha256: snapshotValidation.snapshotSha256, sourceFilename: snapshot.sourceFilename,
    periodStart: "2026-07", periodEnd: "2026-12", expectedSummary,
    sourceSnapshotMetadata: snapshot.sourceSnapshot, migrationProgramVersion: programVersion,
  };
  const plan = { contractVersion: "aozora-v3-core-teaching-migration-plan-v1", batch, target, expectedSummary };
  return { ...plan, planSha256: canonicalJsonSha256(plan) };
}

async function main() {
  const [snapshotPath, exclusionsPath] = process.argv.slice(2);
  invariant(snapshotPath && exclusionsPath, "usage: node plan-core-teaching-migration.mjs <snapshot.json> <exclusions.json>");
  const [snapshot, exclusions] = await Promise.all([readFile(snapshotPath, "utf8").then(JSON.parse), readFile(exclusionsPath, "utf8").then(JSON.parse)]);
  const plan = buildCoreTeachingMigrationPlan(snapshot, exclusions);
  process.stdout.write(`${JSON.stringify({ contractVersion: plan.contractVersion, sourceKey: plan.batch.sourceKey, planSha256: plan.planSha256, expectedSummary: plan.expectedSummary }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
