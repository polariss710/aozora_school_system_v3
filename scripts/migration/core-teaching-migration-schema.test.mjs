import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../../apps/api/prisma/schema.prisma", import.meta.url);
const migrationPath = new URL(
  "../../apps/api/prisma/migrations/20260720123000_add_reference_data_legacy_identity/migration.sql",
  import.meta.url,
);
const constraintMigrationPath = new URL(
  "../../apps/api/prisma/migrations/20260720130000_constrain_reference_legacy_identity/migration.sql",
  import.meta.url,
);

test("reference data preserves paired, unique legacy identities for core-teaching migration", async () => {
  const [schema, migration, constraintMigration] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(migrationPath, "utf8"),
    readFile(constraintMigrationPath, "utf8"),
  ]);

  for (const modelName of ["BusinessEntity", "Student", "Teacher", "Subject"]) {
    const block = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? "";
    assert.match(block, /legacyTable\s+String\?\s+@map\("legacy_table"\)/);
    assert.match(block, /legacyId\s+String\?\s+@map\("legacy_id"\)/);
    assert.match(block, /@@unique\(\[legacyTable, legacyId\]\)/);
  }

  assert.match(migration, /business_entities_legacy_identity_check/);
  assert.match(migration, /subjects_legacy_identity_check/);
  assert.match(migration, /business_entities_legacy_table_legacy_id_key/);
  assert.match(migration, /subjects_legacy_table_legacy_id_key/);
  assert.match(constraintMigration, /students_legacy_identity_check/);
  assert.match(constraintMigration, /teachers_legacy_identity_check/);
  assert.match(constraintMigration, /students_legacy_table_legacy_id_key/);
  assert.match(constraintMigration, /teachers_legacy_table_legacy_id_key/);
});
