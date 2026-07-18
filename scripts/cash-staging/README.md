# Cash staging installation

This directory contains staging-only seed and verification files. The Cash
schema remains sourced from the frozen, production-data-free SQL in
`scripts/cash-dev/`; those structural files are environment-neutral despite
their historical directory name.

Run only against the new, empty `v3-staging` project:

```bash
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/target-preflight.sql
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/bootstrap.sql
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/verify.sql
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/verify-fx-school-sync.sql
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cash-dev/verify-teacher-wage-batches.sql
```

After creating a staging-only Cash Auth user:

```bash
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -v cash_user_id='<cash-staging-auth-user-uuid>' \
  -f scripts/cash-staging/seed-accounts.sql
psql "$SCHOOL_STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -v cash_user_id='<cash-staging-auth-user-uuid>' \
  -f scripts/cash-staging/verify-seed.sql
```

The deterministic account IDs and `STAGING Cash` labels are intentionally
different from dev. No production account, balance, user, request, transaction,
or ACL is included.

Rollback-only staging regression checks:

- `verify-teacher-wage-batch.sql`: aggregate approval, one-transaction invariant,
  retry idempotency, School marker conflict, and immutable transaction guards.
- `verify-teacher-wage-group-rejection.sql`: atomic rejection, retry idempotency,
  and mismatched-group zero-write behavior.
- `verify-fx-guard.sql`: CNY→JPY marker idempotency, conflicting identity rejection,
  and both transaction mutation guards.

All three scripts select only `STAGING Cash %` accounts, create `STAGING-E2E`
fixtures inside a transaction, and end with `rollback`.
