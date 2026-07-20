#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const contractVersion = "aozora-v2-core-teaching-aggregate-inventory-v2";
const scopeStart = "2026-07";
const scopeEnd = "2026-12";
const omissionPolicy = "v2_readonly_retention_v1";
const v2ReadOnlyOmissions = [
  {
    key: "studentSettlementAdjustments",
    handling: "retain_affected_student_settlement_chain_in_v2_readonly",
  },
  {
    key: "studentSettlementCarryovers",
    handling: "retain_affected_student_settlement_chain_in_v2_readonly",
  },
  {
    key: "teacherWageLockDetails",
    handling: "retain_affected_teacher_wage_chain_in_v2_readonly",
  },
  {
    key: "teacherWageDetailAdjustments",
    handling: "retain_affected_teacher_wage_chain_in_v2_readonly",
  },
  {
    key: "expenseAttachments",
    handling: "omit_attachment_only_keep_eligible_expense_history",
  },
  {
    key: "paymentRequestsAtOrAfterScope",
    handling: "retain_legacy_payment_request_in_v2_readonly_no_v3_cash_request",
  },
];
const requiredZeroIntegrityChecks = [
  "wage_detail_missing_lesson",
  "wage_adjustment_missing_lock",
  "actual_missing_planned_source",
  "attachment_missing_scoped_expense",
  "carryover_missing_source_settlement",
];
const supportedActualStatuses = new Set(["completed", "makeup_completed", "cancelled"]);
const supportedPlannedStatuses = new Set(["planned", "pending_makeup"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function asNonNegativeInteger(value, label) {
  const numeric = Number(value);
  invariant(Number.isInteger(numeric) && numeric >= 0, `${label} must be a non-negative integer`);
  return numeric;
}

function array(value, label) {
  invariant(Array.isArray(value), `${label} must be an array`);
  return value;
}

export function assessCoreTeachingAggregateReadiness(inventory) {
  invariant(inventory?.contractVersion === contractVersion, `inventory contract must be ${contractVersion}`);
  invariant(inventory.sourceSnapshot?.sourceSystem === "school_v2", "inventory source system must be school_v2");
  invariant(inventory.sourceSnapshot?.isolation === "repeatable_read_read_only", "inventory must be read-only");
  invariant(inventory.sourceSnapshot?.containsBusinessRows === false, "inventory must not contain business rows");
  invariant(inventory.sourceSnapshot?.scopeStartYearMonth === scopeStart, `scope start must be ${scopeStart}`);
  invariant(inventory.sourceSnapshot?.scopeEndYearMonth === scopeEnd, `scope end must be ${scopeEnd}`);

  const blockers = [];
  const dependentCounts = inventory.dependentCounts ?? {};
  const integrityChecks = inventory.integrityChecks ?? {};

  const v2ReadOnlyExclusions = [];
  for (const omission of v2ReadOnlyOmissions) {
    const count = asNonNegativeInteger(dependentCounts[omission.key], `dependentCounts.${omission.key}`);
    if (count !== 0) {
      v2ReadOnlyExclusions.push({
        dependentFact: omission.key,
        count,
        handling: omission.handling,
      });
    }
  }
  for (const key of requiredZeroIntegrityChecks) {
    const count = asNonNegativeInteger(integrityChecks[key], `integrityChecks.${key}`);
    if (count !== 0) blockers.push(`${key}=${count}`);
  }

  for (const row of array(inventory.lessonLinkage?.actualByPlannedLink ?? [], "lessonLinkage.actualByPlannedLink")) {
    const rowCount = asNonNegativeInteger(row.row_count ?? row.rowCount, "actual lesson linkage row count");
    if (rowCount === 0) continue;
    if (row.link_state !== "linked") blockers.push(`actual lesson linkage is ${row.link_state}`);
    if (!supportedActualStatuses.has(row.actual_status)) blockers.push(`unsupported actual status: ${row.actual_status}`);
    if (!supportedPlannedStatuses.has(row.planned_status)) blockers.push(`unsupported planned status: ${row.planned_status}`);
  }

  for (const row of array(inventory.lessonLinkage?.plannedByActualLink ?? [], "lessonLinkage.plannedByActualLink")) {
    const rowCount = asNonNegativeInteger(row.row_count ?? row.rowCount, "planned lesson linkage row count");
    if (rowCount === 0) continue;
    if (!supportedPlannedStatuses.has(row.planned_status)) blockers.push(`unsupported planned status: ${row.planned_status}`);
    if (row.actual_status !== null && row.actual_status !== undefined && !supportedActualStatuses.has(row.actual_status)) {
      blockers.push(`unsupported actual status: ${row.actual_status}`);
    }
  }

  const outOfScopeFutureCounts = inventory.outOfScopeFutureCounts ?? {};
  const futureFactsExcluded = Object.fromEntries(
    ["incomeRecords", "expenseRecords", "lessonRecords"].map((key) => [
      key,
      asNonNegativeInteger(outOfScopeFutureCounts[key], `outOfScopeFutureCounts.${key}`),
    ]),
  );

  return {
    contractVersion: "aozora-v3-core-teaching-aggregate-readiness-v2",
    omissionPolicy,
    sourceCapturedAt: inventory.sourceSnapshot.capturedAt,
    scope: { yearMonthFrom: scopeStart, yearMonthTo: scopeEnd },
    aggregateGatePassed: blockers.length === 0,
    blockers,
    v2ReadOnlyExclusions,
    futureFactsExcluded,
    nextStep: blockers.length === 0
      ? "A restricted source snapshot may be prepared only for eligible facts; every listed dependent fact must remain in V2 read-only under the recorded omission policy."
      : "Do not export or import a core-teaching snapshot until every blocker is resolved.",
  };
}

async function main() {
  const [inventoryPath] = process.argv.slice(2);
  invariant(inventoryPath, "usage: node assess-core-teaching-aggregate-readiness.mjs <aggregate-inventory.json>");
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  process.stdout.write(`${JSON.stringify(assessCoreTeachingAggregateReadiness(inventory), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
