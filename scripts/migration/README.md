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
