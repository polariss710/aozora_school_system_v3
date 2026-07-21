import assert from "node:assert/strict";
import test from "node:test";
import { buildCoreTeachingMigrationPlan } from "./plan-core-teaching-migration.mjs";
import { canonicalJsonSha256 } from "./validate-core-teaching-snapshot.mjs";

const ids = {
  entity: "11111111-1111-4111-8111-111111111111", student: "22222222-2222-4222-8222-222222222222",
  teacher: "33333333-3333-4333-8333-333333333333", subject: "44444444-4444-4444-8444-444444444444",
  planned: "55555555-5555-4555-8555-555555555555", actual: "66666666-6666-4666-8666-666666666666",
  bill: "77777777-7777-4777-8777-777777777777", income: "88888888-8888-4888-8888-888888888888",
  expense: "99999999-9999-4999-8999-999999999999",
};

const now = "2026-07-20T00:00:00.000Z";
const date = "2026-07-01";
function reference(id, legacyTable, sourceRow) { return { id, legacyTable, legacyId: id, sourceRow }; }
function snapshot() {
  return {
    contractVersion: "aozora-v2-core-teaching-snapshot-v1", sourceKey: "SYNTHETIC-CORE-PLAN", sourceFilename: "synthetic.json",
    sourceSnapshot: { sourceSystem: "school_v2", isolation: "repeatable_read_read_only", containsBusinessRows: true, scopeStartYearMonth: "2026-07", scopeEndYearMonth: "2026-12", sourceQuerySha256: "1".repeat(64), aggregateInventorySha256: "2".repeat(64) },
    referenceData: {
      businessEntities: [reference(ids.entity, "school_business_entities", { id: ids.entity, code: "SYN", name: "Synthetic", is_active: true, created_at: now, updated_at: now })],
      students: [reference(ids.student, "school_students", { id: ids.student, student_code: "S-1", name: "Student", status: "active", business_entity_id: ids.entity, created_at: now, updated_at: now })],
      teachers: [reference(ids.teacher, "school_teachers", { id: ids.teacher, teacher_code: "T-1", name: "Teacher", status: "employed", created_at: now, updated_at: now })],
      subjects: [reference(ids.subject, "school_subjects", { id: ids.subject, name: "Math", sort_order: 1, is_active: true, created_at: now, updated_at: now })],
    },
    facts: {
      plannedLessons: [{ id: ids.planned, yearMonth: "2026-07", businessEntityId: ids.entity, studentId: ids.student, teacherId: ids.teacher, subjectId: ids.subject, sourceRow: { id: ids.planned, status: "planned", lesson_date: date, lesson_count: 1, start_time: "10:00", end_time: "11:00", duration_hours: "1.00", lesson_fee: 3000, is_billable: true, created_at: now, updated_at: now } }],
      actualLessons: [{ id: ids.actual, yearMonth: "2026-07", plannedLessonId: ids.planned, businessEntityId: ids.entity, studentId: ids.student, teacherId: ids.teacher, subjectId: ids.subject, sourceRow: { id: ids.actual, status: "completed", lesson_date: date, start_time: "10:00", end_time: "11:00", duration_hours: "1.00", is_billable: true, created_at: now, updated_at: now } }],
      studentSettlements: [],
      tuitionBills: [{ id: ids.bill, billingMonth: "2026-07", studentId: ids.student, incomeRecordId: ids.income, sourceRow: { id: ids.bill, status: "income_created", version: 1, planned_lesson_count: 1, planned_lesson_fee_jpy: 3000, previous_carryover_cny: "0", created_at: now, updated_at: now } }],
      incomes: [{ id: ids.income, yearMonth: "2026-07", studentId: ids.student, businessEntityId: ids.entity, sourceRow: { id: ids.income, status: "received", currency: "JPY", amount_jpy: 3000, source_label: "Tuition", created_at: now, updated_at: now } }],
      expenses: [{ id: ids.expense, yearMonth: "2026-07", teacherId: ids.teacher, businessEntityId: ids.entity, sourceRow: { id: ids.expense, status: "paid", currency: "JPY", amount_jpy: 500, expense_category: "Supplies", created_at: now, updated_at: now } }],
    },
    omissionCandidates: [],
  };
}
function manifest(source) { return { contractVersion: "aozora-v2-core-teaching-exclusion-manifest-v1", omissionPolicy: "v2_readonly_retention_v1", sourceSnapshotSha256: canonicalJsonSha256(source), exclusions: [] }; }

test("builds a UUID-preserving historical plan with no Cash facts", () => {
  const source = snapshot();
  const plan = buildCoreTeachingMigrationPlan(source, manifest(source));
  assert.equal(plan.batch.sourceKey, source.sourceKey);
  assert.equal(plan.target.businessEntities[0].code, "V2-SYN");
  assert.equal(plan.target.plannedLessons[0].id, ids.planned);
  assert.equal(plan.target.plannedLessons[0].status, "actual_created");
  assert.equal(plan.target.plannedLessons[0].plannedDate, "2026-07-01");
  assert.equal(plan.target.plannedLessons[0].weekAnchorDate, "2026-06-29");
  assert.equal(plan.target.actualLessons[0].id, ids.actual);
  assert.equal(plan.target.incomes[0].recordStatus, "historical_confirmed");
  assert.equal(plan.target.expenses[0].recordStatus, "historical_confirmed");
  assert.equal(plan.expectedSummary.cashRequests, 0);
  assert.equal(plan.expectedSummary.cashTransactions, 0);
  assert.equal(plan.expectedSummary.recordAudits, 9);
});

test("rejects a source status that cannot be mapped safely", () => {
  const source = snapshot();
  source.facts.incomes[0].sourceRow.status = "mystery";
  assert.throws(() => buildCoreTeachingMigrationPlan(source, manifest(source)), /unsupported income status/);
});

test("preserves extra historical actual links without breaking the operational one-to-one relation", () => {
  const source = snapshot();
  const duplicateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  source.facts.actualLessons.push({ ...source.facts.actualLessons[0], id: duplicateId, sourceRow: { ...source.facts.actualLessons[0].sourceRow, id: duplicateId } });
  const plan = buildCoreTeachingMigrationPlan(source, manifest(source));
  const duplicate = plan.target.actualLessons.find((row) => row.id === duplicateId);
  assert.equal(duplicate.plannedLessonId, null);
  assert.equal(duplicate.legacyPlannedLessonId, ids.planned);
});

test("assigns deterministic target bill versions without inventing replacement links", () => {
  const source = snapshot();
  const duplicateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  source.facts.tuitionBills.push({ ...source.facts.tuitionBills[0], id: duplicateId, incomeRecordId: null, sourceRow: { ...source.facts.tuitionBills[0].sourceRow, id: duplicateId } });
  const plan = buildCoreTeachingMigrationPlan(source, manifest(source));
  assert.deepEqual(plan.target.tuitionBills.map((row) => ({ id: row.id, version: row.version, replacesId: row.replacesId })).sort((left, right) => left.id.localeCompare(right.id)), [
    { id: ids.bill, version: 1, replacesId: null },
    { id: duplicateId, version: 2, replacesId: null },
  ]);
});
