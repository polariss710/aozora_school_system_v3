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
