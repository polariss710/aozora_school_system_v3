#!/usr/bin/env node

import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { requireStagingTargetEnvironment } from "./apply-external-work-plan.mjs";
import { assessCoreTeachingAggregateReadiness } from "./assess-core-teaching-aggregate-readiness.mjs";
import { canonicalJsonSha256, validateCoreTeachingSnapshot } from "./validate-core-teaching-snapshot.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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

export function prepareCoreTeachingStagingImport({ snapshot, exclusionManifest, aggregateInventory, environment }) {
  const target = requireStagingTargetEnvironment(environment);
  const snapshotValidation = validateCoreTeachingSnapshot(snapshot, exclusionManifest);
  invariant(
    snapshot.sourceSnapshot.aggregateInventorySha256 === canonicalJsonSha256(aggregateInventory),
    "snapshot aggregate inventory hash differs",
  );
  const aggregateGate = assessCoreTeachingAggregateReadiness(aggregateInventory);
  invariant(aggregateGate.aggregateGatePassed, `aggregate readiness is blocked: ${aggregateGate.blockers.join(", ")}`);
  return {
    status: "prepared_not_applied",
    targetEnv: target.targetEnv,
    sourceKey: snapshotValidation.sourceKey,
    snapshotSha256: snapshotValidation.snapshotSha256,
    eligibleSummary: snapshotValidation.eligibleSummary,
    excludedChains: snapshotValidation.excludedChains,
    aggregateReadinessContract: aggregateGate.contractVersion,
  };
}

async function main() {
  const [snapshotPath, exclusionManifestPath, aggregateInventoryPath, prepareFlag] = process.argv.slice(2);
  invariant(
    snapshotPath && exclusionManifestPath && aggregateInventoryPath && prepareFlag === "--prepare-staging-import",
    "usage: node prepare-core-teaching-staging-import.mjs <snapshot.json> <exclusion-manifest.json> <aggregate-inventory.json> --prepare-staging-import",
  );
  const [snapshot, exclusionManifest, aggregateInventory] = await Promise.all([
    loadPrivateJson(snapshotPath, "snapshot"),
    loadPrivateJson(exclusionManifestPath, "exclusion manifest"),
    loadPrivateJson(aggregateInventoryPath, "aggregate inventory"),
  ]);
  process.stdout.write(`${JSON.stringify(prepareCoreTeachingStagingImport({ snapshot, exclusionManifest, aggregateInventory, environment: process.env }), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
