# Migration tooling

All tools in this directory preserve the environment boundary documented in
`docs/v3-prod-migration-boundary.md`.

## External-work plan generator

`plan-external-work-migration.mjs` is deliberately database-free. It accepts a
versioned JSON snapshot plus an exact workplace map and prints a deterministic
V3 migration plan. It does not connect to School, Cash, Supabase, Render, or
GitHub and cannot write target rows.

```sh
node scripts/migration/plan-external-work-migration.mjs \
  scripts/migration/fixtures/external-work-synthetic-snapshot.json \
  scripts/migration/fixtures/external-work-synthetic-workplace-map.json
```

The plan contains SHA-256 hashes for the source snapshot, workplace mapping,
each audit source row, and the complete plan. The following are hard failures:

- scope outside `2025-12` through `2026-11`;
- duplicate or invalid UUIDs;
- missing exact workplace mapping;
- broken planned / actual / settlement / income references;
- multiple active actual lessons for one planned lesson;
- a historical confirmation carrying a Cash transaction;
- a synced linkage missing its Cash identity;
- a legacy request that is not safely audit-only.

The School migration plan always contains zero Cash requests and zero Cash
transactions. Cash ledger migration remains a separate program and phase.

Run the synthetic contract tests with:

```sh
node --test scripts/migration/plan-external-work-migration.test.mjs
```

The fixture files contain synthetic UUIDs and values only. They do not contain
production data.

## Transactional rollback apply verification

`verify-external-work-plan-apply.mjs` executes the plan in one database
transaction, reconciles every target row, verifies that no Cash request was
created, then intentionally rolls the transaction back. It never has a
persistent apply mode.

It requires explicit `MIGRATION_TEST_*` environment variables, accepts only
`dev` or `staging`, requires the target URL to contain the expected project
ref, and hard-rejects both current production project refs. For the synthetic
fixture only, absent mapped workplaces are created inside the rollback-only
transaction and therefore cannot persist.

With the required environment boundary variables set, run the synthetic
rollback verifier through `pnpm verify:migration:rollback`.

The v3-dev run has been recorded in `docs/staging-build-log.md`. The same
transactional verifier still needs a staging credential path; the existing
staging SQL-only constraint verifier is already recorded separately.

## Persistent School staging importer

`apply-external-work-plan.mjs` is the only persistent School importer. It is
deliberately difficult to invoke: it accepts only the explicit v3-staging
project ref, hard-rejects both current production refs, requires the literal
`--apply` argument and `MIGRATION_CONFIRM_STAGING_IMPORT=v3-staging`, checks
the 23-migration / staging-Cash baseline, and performs the entire plan in one
transaction.

It reads the snapshot and both mapping files only from outside this repository;
their filesystem mode must exclude group and world access. It prints only the
plan hash and aggregate counts, never source rows. A retry either verifies the
complete matching migration audit and returns `already_applied`, or refuses a
partial/conflicting target. It never deletes target rows.

The Cash linkage map is mandatory if the School snapshot contains a `synced`
linkage. It maps each source Cash owner and account to its staging identity;
the importer verifies that the mapped staging account exists and belongs to the
mapped staging owner. The historical account-name snapshot is intentionally
not compared to a current account name, because a source account might have
been renamed after a historical linkage was recorded.

```sh
MIGRATION_TARGET_ENV=staging \
MIGRATION_TARGET_PROJECT_REF=bxnxdkbjlxkcqwzzeyds \
MIGRATION_TARGET_DATABASE_URL='postgresql://…bxnxdkbjlxkcqwzzeyds…' \
MIGRATION_CONFIRM_STAGING_IMPORT=v3-staging \
node scripts/migration/apply-external-work-plan.mjs \
  /controlled/path/school-snapshot.json \
  /controlled/path/workplace-map.json \
  /controlled/path/cash-linkage-map.json \
  --apply
```

Do not run this until the separate Cash ledger importer has created the mapped
Cash accounts and the final mapping/reconciliation gates are satisfied.

## Production source snapshots

`export-v2-external-work-snapshot.sql` and
`export-cash-ledger-snapshot.sql` are source-side `REPEATABLE READ, READ ONLY`
queries. They return one versioned JSON value and roll the transaction back.
They do not contain `COPY`, file writes, DML, DDL, or RPC calls.

Run them only with dedicated source read-only credentials. Snapshot JSON is
production data: keep it encrypted and outside this repository, do not commit
it, and record its SHA-256 plus the `capturedAt` cutoff. The School snapshot
and Cash ledger snapshot are separate because the current production systems
are separate projects; their IDs are reconciled after extraction rather than
assuming a shared transaction across projects.

## Core teaching source discovery

`v2-core-teaching-readonly-inventory.sql` is the preliminary discovery contract
for ordinary teaching. It is a `REPEATABLE READ, READ ONLY` transaction that
only reads `information_schema`, returns the candidate table / column / foreign
key dictionary as one JSON value, and rolls back. It must never be used as a
business-data exporter.

The resulting field-level mapping and known target-model gaps are recorded in
`docs/v2-v3-core-teaching-migration-mapping.md`. Until the blocking items in
that document are resolved, there is intentionally no ordinary-teaching
snapshot exporter or persistent importer.

`v2-core-teaching-aggregate-inventory.sql` is the follow-up range contract. It
uses the same read-only rollback boundary and returns only aggregate counts,
amounts, reference-closure counts, and selected orphan counts for the fixed
initial teaching-rehearsal window `2026-07` through `2026-12`; it does not
return business rows. Run its static
contract test through `pnpm test:migration` before any source execution.

## Cash ledger plan generator

`plan-cash-ledger-migration.mjs` is also database-free. It accepts the Cash
read-only JSON snapshot and an explicit source-owner → staging-Auth-user map,
then produces a deterministic plan. It preserves ledger/account/transaction
UUIDs, rewrites only `user_id`, and never copies `auth.users` or Auth secrets.

It validates the account, fixed-item/template, transfer-account, JPY↔CNY FX
and external-request transaction references before a target is contacted. A
missing owner mapping or a broken reference is a hard failure. The persistent
Cash importer is `apply-cash-ledger-plan.mjs`. It uses the same explicit
v3-staging target/confirmation guard as the School importer, requires every
mapped staging Auth user to already exist, verifies the complete target table
column set before writing, inserts the JPY/CNY rows with FX links temporarily
null, restores those links in the same transaction, and then verifies every
target JSON row. A complete byte-equivalent retry returns `already_applied`;
partial or mismatched UUIDs fail without deletion.
