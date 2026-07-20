#!/usr/bin/env node

import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJsonSha256, coreTeachingOmissionHandling } from "./validate-core-teaching-snapshot.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractVersion = "aozora-v2-core-teaching-exclusion-manifest-v1";
const omissionPolicy = "v2_readonly_retention_v1";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertPrivatePath(resolvedPath, label) {
  const relative = path.relative(repositoryRoot, resolvedPath);
  invariant(relative.startsWith("..") && !path.isAbsolute(relative), `${label} must be stored outside the repository`);
}

export function buildCoreTeachingExclusionManifest(snapshot) {
  invariant(snapshot?.contractVersion === "aozora-v2-core-teaching-snapshot-v1", "snapshot contract must be aozora-v2-core-teaching-snapshot-v1");
  invariant(Array.isArray(snapshot.omissionCandidates), "snapshot.omissionCandidates must be an array");

  const seen = new Set();
  const exclusions = snapshot.omissionCandidates.map((candidate) => {
    invariant(typeof candidate?.sourceTable === "string" && candidate.sourceTable.length > 0, "omission candidate sourceTable is required");
    invariant(typeof candidate?.sourceId === "string" && candidate.sourceId.length > 0, "omission candidate sourceId is required");
    invariant(Object.hasOwn(coreTeachingOmissionHandling, candidate.dependentFact), `unsupported omission candidate: ${candidate.dependentFact}`);
    invariant(Array.isArray(candidate.affectedFactKeys) && candidate.affectedFactKeys.length > 0, "omission candidate affectedFactKeys are required");
    const key = `${candidate.sourceTable}:${candidate.sourceId}:${candidate.dependentFact}`;
    invariant(!seen.has(key), `duplicate omission candidate: ${key}`);
    seen.add(key);
    return {
      sourceTable: candidate.sourceTable,
      sourceId: candidate.sourceId,
      dependentFact: candidate.dependentFact,
      affectedFactKeys: candidate.affectedFactKeys,
      handling: coreTeachingOmissionHandling[candidate.dependentFact],
    };
  });

  return {
    contractVersion,
    omissionPolicy,
    sourceSnapshotSha256: canonicalJsonSha256(snapshot),
    exclusions,
  };
}

async function loadPrivateSnapshot(snapshotPath) {
  const resolved = await realpath(snapshotPath);
  assertPrivatePath(resolved, "snapshot");
  const metadata = await stat(resolved);
  invariant(metadata.isFile(), "snapshot must be a regular file");
  invariant((metadata.mode & 0o077) === 0, "snapshot must not be group/world accessible");
  return JSON.parse(await readFile(resolved, "utf8"));
}

async function writePrivateManifest(manifestPath, manifest) {
  const outputDirectory = await realpath(path.dirname(manifestPath));
  assertPrivatePath(outputDirectory, "exclusion manifest");
  const directoryMetadata = await stat(outputDirectory);
  invariant(directoryMetadata.isDirectory(), "exclusion manifest directory must exist");
  invariant((directoryMetadata.mode & 0o077) === 0, "exclusion manifest directory must not be group/world accessible");
  const outputPath = path.join(outputDirectory, path.basename(manifestPath));
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

async function main() {
  const [snapshotPath, manifestPath] = process.argv.slice(2);
  invariant(snapshotPath && manifestPath, "usage: node create-core-teaching-exclusion-manifest.mjs <snapshot.json> <exclusions.json>");
  const manifest = buildCoreTeachingExclusionManifest(await loadPrivateSnapshot(snapshotPath));
  await writePrivateManifest(manifestPath, manifest);
  process.stdout.write(`${JSON.stringify({ contractVersion: manifest.contractVersion, sourceSnapshotSha256: manifest.sourceSnapshotSha256, exclusions: manifest.exclusions.length }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
