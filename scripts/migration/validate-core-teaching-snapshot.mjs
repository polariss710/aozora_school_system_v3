#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const snapshotContractVersion = "aozora-v2-core-teaching-snapshot-v1";
const exclusionManifestContractVersion = "aozora-v2-core-teaching-exclusion-manifest-v1";
const omissionPolicy = "v2_readonly_retention_v1";
const scopeStart = "2026-07";
const scopeEnd = "2026-12";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const referenceSections = ["businessEntities", "students", "teachers", "subjects"];
const factSections = ["plannedLessons", "actualLessons", "studentSettlements", "tuitionBills", "incomes", "expenses"];
const omissionHandling = {
  studentSettlementAdjustments: "retain_affected_student_settlement_chain_in_v2_readonly",
  studentSettlementCarryovers: "retain_affected_student_settlement_chain_in_v2_readonly",
  teacherWageLockDetails: "retain_affected_teacher_wage_chain_in_v2_readonly",
  teacherWageDetailAdjustments: "retain_affected_teacher_wage_chain_in_v2_readonly",
  expenseAttachments: "omit_attachment_only_keep_eligible_expense_history",
  paymentRequestsAtOrAfterScope: "retain_legacy_payment_request_in_v2_readonly_no_v3_cash_request",
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function asArray(value, label) {
  invariant(Array.isArray(value), `${label} must be an array`);
  return value;
}

function assertUuid(value, label) {
  invariant(typeof value === "string" && uuidPattern.test(value), `${label} must be a UUID`);
}

function assertSha256(value, label) {
  invariant(typeof value === "string" && /^[0-9a-f]{64}$/.test(value), `${label} must be a lowercase SHA-256`);
}

function assertScopedMonth(value, label) {
  invariant(typeof value === "string" && value >= scopeStart && value <= scopeEnd, `${label} must be between ${scopeStart} and ${scopeEnd}`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJsonSha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function indexRows(rows, label) {
  const indexed = new Map();
  for (const row of rows) {
    assertUuid(row.id, `${label}.id`);
    invariant(!indexed.has(row.id), `duplicate ${label} id: ${row.id}`);
    indexed.set(row.id, row);
  }
  return indexed;
}

function assertReference(row, label, index) {
  assertUuid(row.id, `${label}.id`);
  invariant(typeof row.legacyTable === "string" && row.legacyTable.length > 0, `${label}.legacyTable is required`);
  assertUuid(row.legacyId, `${label}.legacyId`);
  invariant(row.id === row.legacyId, `${label}.id must preserve the source UUID`);
  invariant(index.has(row.id), `missing ${label} reference: ${row.id}`);
}

function assertFactReferences(facts, references) {
  for (const row of facts.plannedLessons) {
    assertScopedMonth(row.yearMonth, `planned lesson ${row.id}.yearMonth`);
    assertReference({ id: row.businessEntityId, legacyTable: "school_business_entities", legacyId: row.businessEntityId }, "business entity", references.businessEntities);
    assertReference({ id: row.studentId, legacyTable: "school_students", legacyId: row.studentId }, "student", references.students);
    assertReference({ id: row.teacherId, legacyTable: "school_teachers", legacyId: row.teacherId }, "teacher", references.teachers);
    assertReference({ id: row.subjectId, legacyTable: "school_subjects", legacyId: row.subjectId }, "subject", references.subjects);
  }

  for (const row of facts.actualLessons) {
    assertScopedMonth(row.yearMonth, `actual lesson ${row.id}.yearMonth`);
    assertReference({ id: row.businessEntityId, legacyTable: "school_business_entities", legacyId: row.businessEntityId }, "business entity", references.businessEntities);
    assertReference({ id: row.studentId, legacyTable: "school_students", legacyId: row.studentId }, "student", references.students);
    assertReference({ id: row.teacherId, legacyTable: "school_teachers", legacyId: row.teacherId }, "teacher", references.teachers);
    assertReference({ id: row.subjectId, legacyTable: "school_subjects", legacyId: row.subjectId }, "subject", references.subjects);
    if (row.plannedLessonId !== null && row.plannedLessonId !== undefined) {
      assertUuid(row.plannedLessonId, `actual lesson ${row.id}.plannedLessonId`);
      invariant(facts.plannedLessonsById.has(row.plannedLessonId), `actual lesson references missing planned lesson: ${row.id}`);
    }
  }

  for (const row of facts.studentSettlements) {
    assertScopedMonth(row.yearMonth, `student settlement ${row.id}.yearMonth`);
    assertReference({ id: row.studentId, legacyTable: "school_students", legacyId: row.studentId }, "student", references.students);
  }
  for (const row of facts.tuitionBills) {
    assertScopedMonth(row.billingMonth, `tuition bill ${row.id}.billingMonth`);
    assertReference({ id: row.studentId, legacyTable: "school_students", legacyId: row.studentId }, "student", references.students);
    if (row.incomeRecordId !== null && row.incomeRecordId !== undefined) {
      assertUuid(row.incomeRecordId, `tuition bill ${row.id}.incomeRecordId`);
      invariant(facts.incomesById.has(row.incomeRecordId), `tuition bill references missing income: ${row.id}`);
    }
  }
  for (const row of facts.incomes) {
    if (row.yearMonth !== null && row.yearMonth !== undefined) assertScopedMonth(row.yearMonth, `income ${row.id}.yearMonth`);
    if (row.studentId !== null && row.studentId !== undefined) assertReference({ id: row.studentId, legacyTable: "school_students", legacyId: row.studentId }, "student", references.students);
    if (row.businessEntityId !== null && row.businessEntityId !== undefined) assertReference({ id: row.businessEntityId, legacyTable: "school_business_entities", legacyId: row.businessEntityId }, "business entity", references.businessEntities);
  }
  for (const row of facts.expenses) {
    if (row.yearMonth !== null && row.yearMonth !== undefined) assertScopedMonth(row.yearMonth, `expense ${row.id}.yearMonth`);
    if (row.teacherId !== null && row.teacherId !== undefined) assertReference({ id: row.teacherId, legacyTable: "school_teachers", legacyId: row.teacherId }, "teacher", references.teachers);
    if (row.businessEntityId !== null && row.businessEntityId !== undefined) assertReference({ id: row.businessEntityId, legacyTable: "school_business_entities", legacyId: row.businessEntityId }, "business entity", references.businessEntities);
  }
}

function candidateKey(candidate) {
  return `${candidate.sourceTable}:${candidate.sourceId}:${candidate.dependentFact}`;
}

function validateExclusionManifest(manifest, snapshotSha256, candidates) {
  invariant(manifest?.contractVersion === exclusionManifestContractVersion, `exclusion manifest contract must be ${exclusionManifestContractVersion}`);
  invariant(manifest.omissionPolicy === omissionPolicy, `exclusion manifest policy must be ${omissionPolicy}`);
  invariant(manifest.sourceSnapshotSha256 === snapshotSha256, "exclusion manifest snapshot hash differs");
  const exclusions = asArray(manifest.exclusions, "exclusion manifest exclusions");
  const candidateByKey = new Map(candidates.map((candidate) => [candidateKey(candidate), candidate]));
  invariant(exclusions.length === candidateByKey.size, "every omission candidate must have exactly one exclusion manifest row");
  const seen = new Set();
  for (const exclusion of exclusions) {
    assertUuid(exclusion.sourceId, "exclusion.sourceId");
    invariant(typeof exclusion.sourceTable === "string" && exclusion.sourceTable.length > 0, "exclusion.sourceTable is required");
    invariant(Object.hasOwn(omissionHandling, exclusion.dependentFact), `unsupported exclusion dependent fact: ${exclusion.dependentFact}`);
    invariant(exclusion.handling === omissionHandling[exclusion.dependentFact], `exclusion handling differs from policy: ${exclusion.dependentFact}`);
    const key = candidateKey(exclusion);
    invariant(candidateByKey.has(key), `exclusion does not match a source omission candidate: ${key}`);
    invariant(!seen.has(key), `duplicate exclusion manifest row: ${key}`);
    seen.add(key);
    const expectedAffected = candidateByKey.get(key).affectedFactKeys;
    invariant(JSON.stringify(exclusion.affectedFactKeys) === JSON.stringify(expectedAffected), `exclusion affected fact chain differs: ${key}`);
  }
}

export function validateCoreTeachingSnapshot(snapshot, exclusionManifest) {
  invariant(snapshot?.contractVersion === snapshotContractVersion, `snapshot contract must be ${snapshotContractVersion}`);
  invariant(snapshot.sourceSnapshot?.sourceSystem === "school_v2", "snapshot source system must be school_v2");
  invariant(snapshot.sourceSnapshot?.isolation === "repeatable_read_read_only", "snapshot must be read-only");
  invariant(snapshot.sourceSnapshot?.containsBusinessRows === true, "snapshot must explicitly declare business rows");
  invariant(snapshot.sourceSnapshot?.scopeStartYearMonth === scopeStart, `snapshot scope start must be ${scopeStart}`);
  invariant(snapshot.sourceSnapshot?.scopeEndYearMonth === scopeEnd, `snapshot scope end must be ${scopeEnd}`);
  assertSha256(snapshot.sourceSnapshot?.sourceQuerySha256, "snapshot source query hash");
  assertSha256(snapshot.sourceSnapshot?.aggregateInventorySha256, "snapshot aggregate inventory hash");
  invariant(typeof snapshot.sourceKey === "string" && snapshot.sourceKey.length > 0, "snapshot sourceKey is required");
  invariant(typeof snapshot.sourceFilename === "string" && snapshot.sourceFilename.length > 0, "snapshot sourceFilename is required");

  const referenceData = snapshot.referenceData ?? {};
  const references = Object.fromEntries(referenceSections.map((key) => [key, indexRows(asArray(referenceData[key], `referenceData.${key}`), key)]));
  for (const [section, rows] of Object.entries(references)) {
    for (const row of rows.values()) {
      invariant(typeof row.legacyTable === "string" && row.legacyTable.length > 0, `${section}.legacyTable is required`);
      assertUuid(row.legacyId, `${section}.legacyId`);
      invariant(row.id === row.legacyId, `${section}.id must preserve the source UUID`);
    }
  }

  const factData = snapshot.facts ?? {};
  const facts = Object.fromEntries(factSections.map((key) => [key, asArray(factData[key], `facts.${key}`)]));
  for (const [section, rows] of Object.entries(facts)) facts[`${section}ById`] = indexRows(rows, section);
  assertFactReferences(facts, references);

  const candidates = asArray(snapshot.omissionCandidates, "snapshot.omissionCandidates");
  const candidateKeys = new Set();
  for (const candidate of candidates) {
    assertUuid(candidate.sourceId, "omission candidate sourceId");
    invariant(typeof candidate.sourceTable === "string" && candidate.sourceTable.length > 0, "omission candidate sourceTable is required");
    invariant(Object.hasOwn(omissionHandling, candidate.dependentFact), `unsupported omission candidate: ${candidate.dependentFact}`);
    const affectedFactKeys = asArray(candidate.affectedFactKeys, "omission candidate affectedFactKeys");
    invariant(affectedFactKeys.length > 0 && affectedFactKeys.every((value) => typeof value === "string" && value.length > 0), "omission candidate must identify its affected fact chain");
    const key = candidateKey(candidate);
    invariant(!candidateKeys.has(key), `duplicate omission candidate: ${key}`);
    candidateKeys.add(key);
  }

  const snapshotSha256 = canonicalJsonSha256(snapshot);
  validateExclusionManifest(exclusionManifest, snapshotSha256, candidates);
  return {
    contractVersion: "aozora-v3-core-teaching-snapshot-validation-v1",
    snapshotSha256,
    omissionPolicy,
    sourceKey: snapshot.sourceKey,
    scope: { yearMonthFrom: scopeStart, yearMonthTo: scopeEnd },
    eligibleSummary: Object.fromEntries([...referenceSections, ...factSections].map((key) => [key, (references[key] ?? facts[key] ?? []).size ?? (facts[key] ?? []).length])),
    excludedChains: candidates.length,
  };
}

async function main() {
  const [snapshotPath, exclusionManifestPath] = process.argv.slice(2);
  invariant(snapshotPath && exclusionManifestPath, "usage: node validate-core-teaching-snapshot.mjs <snapshot.json> <exclusion-manifest.json>");
  const [snapshot, exclusionManifest] = await Promise.all([
    readFile(snapshotPath, "utf8").then(JSON.parse),
    readFile(exclusionManifestPath, "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(validateCoreTeachingSnapshot(snapshot, exclusionManifest), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
