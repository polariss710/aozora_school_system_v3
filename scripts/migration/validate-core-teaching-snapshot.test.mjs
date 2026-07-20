import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateCoreTeachingSnapshot } from "./validate-core-teaching-snapshot.mjs";

const ids = {
  businessEntity: "11111111-1111-4111-8111-111111111111",
  student: "22222222-2222-4222-8222-222222222222",
  teacher: "33333333-3333-4333-8333-333333333333",
  subject: "44444444-4444-4444-8444-444444444444",
  plannedLesson: "55555555-5555-4555-8555-555555555555",
  actualLesson: "66666666-6666-4666-8666-666666666666",
  settlement: "77777777-7777-4777-8777-777777777777",
  bill: "88888888-8888-4888-8888-888888888888",
  income: "99999999-9999-4999-8999-999999999999",
  expense: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  wageLock: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function snapshotHash(snapshot) {
  return createHash("sha256").update(JSON.stringify(canonicalize(snapshot))).digest("hex");
}

function snapshot() {
  return {
    contractVersion: "aozora-v2-core-teaching-snapshot-v1",
    sourceKey: "SYNTHETIC-CORE-202607",
    sourceFilename: "synthetic-core-teaching.json",
    sourceSnapshot: {
      sourceSystem: "school_v2",
      isolation: "repeatable_read_read_only",
      containsBusinessRows: true,
      scopeStartYearMonth: "2026-07",
      scopeEndYearMonth: "2026-12",
      sourceQuerySha256: "1".repeat(64),
      aggregateInventorySha256: "2".repeat(64),
    },
    referenceData: {
      businessEntities: [{ id: ids.businessEntity, legacyTable: "school_business_entities", legacyId: ids.businessEntity }],
      students: [{ id: ids.student, legacyTable: "school_students", legacyId: ids.student }],
      teachers: [{ id: ids.teacher, legacyTable: "school_teachers", legacyId: ids.teacher }],
      subjects: [{ id: ids.subject, legacyTable: "school_subjects", legacyId: ids.subject }],
    },
    facts: {
      plannedLessons: [{ id: ids.plannedLesson, yearMonth: "2026-07", businessEntityId: ids.businessEntity, studentId: ids.student, teacherId: ids.teacher, subjectId: ids.subject }],
      actualLessons: [{ id: ids.actualLesson, yearMonth: "2026-07", plannedLessonId: ids.plannedLesson, businessEntityId: ids.businessEntity, studentId: ids.student, teacherId: ids.teacher, subjectId: ids.subject }],
      studentSettlements: [{ id: ids.settlement, yearMonth: "2026-07", studentId: ids.student }],
      tuitionBills: [{ id: ids.bill, billingMonth: "2026-07", studentId: ids.student, incomeRecordId: ids.income }],
      incomes: [{ id: ids.income, yearMonth: "2026-07", studentId: ids.student, businessEntityId: ids.businessEntity }],
      expenses: [{ id: ids.expense, yearMonth: "2026-07", teacherId: ids.teacher, businessEntityId: ids.businessEntity }],
    },
    omissionCandidates: [{
      sourceTable: "school_teacher_wage_locks",
      sourceId: ids.wageLock,
      dependentFact: "teacherWageLockDetails",
      affectedFactKeys: [`school_teacher_wage_locks:${ids.wageLock}`, `school_expense_records:${ids.expense}`],
    }],
  };
}

function manifestFor(source) {
  return {
    contractVersion: "aozora-v2-core-teaching-exclusion-manifest-v1",
    omissionPolicy: "v2_readonly_retention_v1",
    sourceSnapshotSha256: snapshotHash(source),
    exclusions: source.omissionCandidates.map((candidate) => ({
      ...candidate,
      handling: "retain_affected_teacher_wage_chain_in_v2_readonly",
    })),
  };
}

test("validates an eligible core-teaching snapshot with an explicit V2-readonly chain", () => {
  const source = snapshot();
  const result = validateCoreTeachingSnapshot(source, manifestFor(source));
  assert.equal(result.contractVersion, "aozora-v3-core-teaching-snapshot-validation-v1");
  assert.equal(result.omissionPolicy, "v2_readonly_retention_v1");
  assert.equal(result.eligibleSummary.plannedLessons, 1);
  assert.equal(result.eligibleSummary.expenses, 1);
  assert.equal(result.excludedChains, 1);
});

test("rejects an omission candidate without its exact manifest entry", () => {
  const source = snapshot();
  const manifest = manifestFor(source);
  manifest.exclusions = [];
  assert.throws(() => validateCoreTeachingSnapshot(source, manifest), /every omission candidate/);
});

test("rejects a manifest that was not hashed from this exact snapshot", () => {
  const source = snapshot();
  const manifest = manifestFor(source);
  source.facts.incomes[0].yearMonth = "2026-08";
  assert.throws(() => validateCoreTeachingSnapshot(source, manifest), /snapshot hash differs/);
});

test("rejects an actual lesson that bypasses the planned-lesson closure", () => {
  const source = snapshot();
  source.facts.actualLessons[0].plannedLessonId = ids.wageLock;
  const manifest = manifestFor(source);
  assert.throws(() => validateCoreTeachingSnapshot(source, manifest), /references missing planned lesson/);
});
