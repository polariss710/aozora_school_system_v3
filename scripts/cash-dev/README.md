# Cash dev bootstrap

This directory contains the isolated Cash module installed beside School V3 in
the same **dev** Supabase project. It does not contain production Cash data,
credentials, `shop_*` objects, or School V3 schema objects.

Extraction provenance (read-only):

- Cash repository commit observed: `b0f6065`
- Extracted: `2026-07-17`
- Source inventory: 7 tables, 42 functions, 7 policies
- V3 dev extension: 1 sync table, 2 functions, 1 policy, and 2 guard
  triggers for immutable School FX handoff
- Teacher wage aggregate extension: 2 batch tables, 3 functions, 2 policies,
  and 2 transaction guard triggers
- `schema.sql` SHA-256: `de0550fb73598bd5af28b83145b5212ac7b8c1b6f92780520a5b9954af3baeee`

## Safety boundary

- Source inventory and schema export are read-only against the current Cash DB.
- `bootstrap.sql` refuses to run if the target already contains any `home_*`
  relation or function.
- The bootstrap is transactional and does not copy source ACLs.
- `anon` and `PUBLIC` cannot call Cash RPCs. Only `service_role` can create
  external School requests or call low-level external transaction writers.
- `seed-accounts.sql` accepts only an existing Supabase Auth user in the target
  project and creates deterministic `DEV Cash` accounts.

## Commands

Run against the V3 dev database only:

```bash
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/target-preflight.sql
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/bootstrap.sql
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/verify.sql
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/verify-fx-school-sync.sql
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/verify-teacher-wage-batches.sql
```

After creating a dedicated Cash dev user through Supabase Auth, seed accounts:

```bash
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 \
  -v cash_user_id='<cash-dev-auth-user-uuid>' \
  -f scripts/cash-dev/seed-accounts.sql
psql "$SCHOOL_DEV_DB_URL" -v ON_ERROR_STOP=1 \
  -v cash_user_id='<cash-dev-auth-user-uuid>' \
  -f scripts/cash-dev/verify-seed.sql
```

`verify.sql` checks schema and privilege invariants and remains valid after E2E
data exists. `verify-seed.sql` checks the dedicated Auth user and four
deterministic dev accounts. Transaction/request counts are intentionally not
treated as structural invariants after real integration testing begins.

`bootstrap.sql` also installs `fx-school-sync.sql`. The extension stores one
School sync marker per CNY / JPY FX pair, exposes only the authenticated marker
RPC, and rejects ordinary update or delete operations against either side of a
synced pair. Apply `fx-school-sync.sql` directly when upgrading an existing Cash
dev schema that was bootstrapped before this extension existed.

After at least one real dev FX handoff exists, run
`verify-synced-fx-guard.sql`. It attempts no-op updates and deletes against both
sides of the latest synced pair inside a rolled-back transaction and succeeds
only when all four mutations are rejected by the database guard.

After at least one real School-synced teacher wage aggregate batch exists, run
`verify-teacher-wage-batch-e2e.sql`. It verifies the Cash batch header, item
totals, approved requests, unique aggregate transaction, School batch callback
result, idempotent retries, conflicting marker rejection, and transaction
update/delete guards. The complete verification runs inside a rolled-back
transaction.

The isolated Cash dev frontend is deployed from the Cash repository branch
`codex/cash-dev-environment` at `https://aozora-cash-v3-dev.onrender.com`. Its
committed configuration contains only the dev Supabase URL, publishable key,
and V3 callback URL; the School API service-role key remains Render-only.

The schema was extracted from the current Cash project with an explicit
`home_*` allowlist. Refreshing it requires a new read-only inventory, diff, and
review; never replace it with a full `public` schema dump.
