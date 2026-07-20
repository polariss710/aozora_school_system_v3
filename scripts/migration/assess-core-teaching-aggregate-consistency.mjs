#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalJsonSha256 } from "./validate-core-teaching-snapshot.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function coreTeachingAggregateBusinessFingerprint(inventory) {
  invariant(inventory?.contractVersion === "aozora-v2-core-teaching-aggregate-inventory-v2", "aggregate inventory contract must be aozora-v2-core-teaching-aggregate-inventory-v2");
  const comparable = structuredClone(inventory);
  invariant(comparable.sourceSnapshot && typeof comparable.sourceSnapshot === "object", "aggregate inventory sourceSnapshot is required");
  delete comparable.sourceSnapshot.capturedAt;
  return canonicalJsonSha256(comparable);
}

export function assessCoreTeachingAggregateConsistency(beforeInventory, afterInventory) {
  const beforeBusinessFingerprint = coreTeachingAggregateBusinessFingerprint(beforeInventory);
  const afterBusinessFingerprint = coreTeachingAggregateBusinessFingerprint(afterInventory);
  return {
    contractVersion: "aozora-v3-core-teaching-aggregate-consistency-v1",
    consistent: beforeBusinessFingerprint === afterBusinessFingerprint,
    ignoredVolatileFields: ["sourceSnapshot.capturedAt"],
    beforeBusinessFingerprint,
    afterBusinessFingerprint,
  };
}

async function main() {
  const [beforePath, afterPath] = process.argv.slice(2);
  invariant(beforePath && afterPath, "usage: node assess-core-teaching-aggregate-consistency.mjs <before-aggregate.json> <after-aggregate.json>");
  const [beforeInventory, afterInventory] = await Promise.all([
    readFile(beforePath, "utf8").then(JSON.parse),
    readFile(afterPath, "utf8").then(JSON.parse),
  ]);
  process.stdout.write(`${JSON.stringify(assessCoreTeachingAggregateConsistency(beforeInventory, afterInventory), null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
