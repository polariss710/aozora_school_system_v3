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
