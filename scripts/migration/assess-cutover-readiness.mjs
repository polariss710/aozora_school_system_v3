#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const contractVersion = "aozora-v3-cutover-readiness-v1";
const stagingGates = [
  "allMigrationsBootstrapRepeatable",
  "e2eAndReconciliationVerified",
  "operationalMonitoringVerified",
  "historicalAuditUiVerified",
];
const migrationGates = [
  "externalWorkRehearsalVerified",
  "cashLedgerRehearsalVerified",
  "coreTeachingMappingResolved",
  "coreTeachingSnapshotContractVerified",
  "coreTeachingImporterVerified",
  "coreTeachingRehearsalVerified",
];
const limitationGates = ["cashPendingCancelAccepted", "fxPartialAllocationAccepted"];
const roleKeys = ["businessOwner", "releaseOperator", "schoolDataVerifier", "cashDataVerifier", "rollbackDecisionMaker"];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function onlyAllowedKeys(value, allowedKeys, label) {
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  invariant(unexpected.length === 0, `${label} contains unsupported fields: ${unexpected.join(", ")}`);
}

function nonEmptyString(value, label) {
  invariant(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string`);
  return value.trim();
}

function requiredBooleanGates(section, keys, prefix, blockers) {
  for (const key of keys) {
    if (section[key] !== true) blockers.push(`${prefix}.${key}`);
  }
}

export function assessCutoverReadiness(manifest) {
  invariant(manifest?.contractVersion === contractVersion, `manifest contract must be ${contractVersion}`);
  onlyAllowedKeys(manifest, ["contractVersion", "assessedAt", "containsBusinessRows", "readiness"], "manifest");
  nonEmptyString(manifest.assessedAt, "assessedAt");
  invariant(Number.isFinite(Date.parse(manifest.assessedAt)), "assessedAt must be an ISO timestamp");
  invariant(manifest.containsBusinessRows === false, "cutover manifest must not contain business rows");

  const readiness = object(manifest.readiness, "readiness");
  const staging = object(readiness.staging, "readiness.staging");
  const migration = object(readiness.migration, "readiness.migration");
  const production = object(readiness.production, "readiness.production");
  const operations = object(readiness.operations, "readiness.operations");
  const limitations = object(readiness.limitations, "readiness.limitations");
  onlyAllowedKeys(readiness, ["staging", "migration", "production", "operations", "limitations"], "readiness");
  onlyAllowedKeys(staging, stagingGates, "readiness.staging");
  onlyAllowedKeys(migration, migrationGates, "readiness.migration");
  onlyAllowedKeys(production, ["userAuthorized", "emptyTargetCreatedAndVerified"], "readiness.production");
  onlyAllowedKeys(operations, ["roles", "freezeWindow"], "readiness.operations");
  onlyAllowedKeys(limitations, limitationGates, "readiness.limitations");
  const blockers = [];

  requiredBooleanGates(staging, stagingGates, "staging", blockers);
  requiredBooleanGates(migration, migrationGates, "migration", blockers);
  requiredBooleanGates(limitations, limitationGates, "limitations", blockers);

  if (production.userAuthorized !== true) blockers.push("production.userAuthorized");
  if (production.emptyTargetCreatedAndVerified !== true) blockers.push("production.emptyTargetCreatedAndVerified");

  const roles = object(operations.roles, "readiness.operations.roles");
  onlyAllowedKeys(roles, roleKeys, "readiness.operations.roles");
  for (const key of roleKeys) {
    try {
      nonEmptyString(roles[key], `readiness.operations.roles.${key}`);
    } catch {
      blockers.push(`operations.roles.${key}`);
    }
  }

  const freezeWindow = object(operations.freezeWindow, "readiness.operations.freezeWindow");
  onlyAllowedKeys(freezeWindow, ["startsAt", "maxWritePauseMinutes"], "readiness.operations.freezeWindow");
  try {
    const startsAt = nonEmptyString(freezeWindow.startsAt, "readiness.operations.freezeWindow.startsAt");
    invariant(Number.isFinite(Date.parse(startsAt)), "freeze window startsAt must be an ISO timestamp");
  } catch {
    blockers.push("operations.freezeWindow.startsAt");
  }
  if (!Number.isInteger(freezeWindow.maxWritePauseMinutes) || freezeWindow.maxWritePauseMinutes <= 0) {
    blockers.push("operations.freezeWindow.maxWritePauseMinutes");
  }

  return {
    contractVersion,
    assessedAt: manifest.assessedAt,
    containsBusinessRows: false,
    readyForProductionCutoverPreparation: blockers.length === 0,
    blockers,
    nextStep:
      blockers.length === 0
        ? "Production cutover preparation may begin under the separate promotion runbook; this result does not authorize a cutover by itself."
        : "Do not create or write v3-prod, freeze source systems, or cut over until every listed gate is recorded as complete.",
  };
}

async function main() {
  const [manifestPath] = process.argv.slice(2);
  invariant(manifestPath, "usage: node assess-cutover-readiness.mjs <cutover-readiness.json>");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  process.stdout.write(`${JSON.stringify(assessCutoverReadiness(manifest), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
