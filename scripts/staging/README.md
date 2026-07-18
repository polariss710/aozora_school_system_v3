# Staging synthetic E2E

These scripts are for the empty-data `v3-staging` environment only. They do
not read or import production data.

## API smoke

Pass credentials through the process environment. Do not store them in a file
or commit them.

```bash
STAGING_API_URL=https://example-staging-api/api \
STAGING_ADMIN_EMAIL=staging-admin@example.invalid \
STAGING_ADMIN_PASSWORD='...' \
node scripts/staging/api-smoke.mjs
```

The script covers authentication, student and teacher lifecycle, duplicate
code rejection, manual income / expense void guards, and manual account
transaction reversal guards.

`school-core-smoke.mjs` covers the School core chain with synthetic 2099 data:
planned lesson, actual lesson, student settlement lock, post-lock lesson guard,
teacher wage preview / lock / adjustment / confirmation / revoke, and the
actual-lesson guard while the wage snapshot is locked. Run it with the same
three environment variables. `cleanup-school-core-e2e.sql` only removes these
facts after the settlement and wage snapshot are revoked and no income or
expense was generated.

## School to Cash smoke

Use the same three environment variables with:

```bash
node scripts/staging/school-cash-smoke.mjs
```

The script requires `CASH_INTEGRATION_MODE=supabase`. It creates one JPY income
and one JPY expense pending request, verifies external IDs, and verifies that
School cannot confirm or withdraw an externally owned request.

`cash-callback-smoke.mjs` accepts the Supabase URL / anon key, a temporary Cash
staging login, the School API URL, and the two external request IDs through
environment variables. It approves the income, rejects the expense, applies
each School callback, replays both callbacks, and verifies that conflicting
callback actions are rejected. Never put those credentials in a repository
file. If the Cash password is temporarily rotated for the run, preserve and
restore the original encrypted password even when the script fails.

Run `verify-callback-e2e.sql` after the callback smoke to reconcile both sides,
the unique approved Cash transaction, and one result audit event per request.
Approved / rejected evidence is intentionally retained for UI acceptance and
is not eligible for `cleanup-e2e.sql`.

After the 2026-07-18 UI acceptance, the retained callback facts are eligible
for the evidence-specific `cleanup-finalized-callback-e2e.sql`. That script
requires every accepted School / Cash ID, final status, amount, and generated
transaction ID to match before it deletes anything; a mismatch rolls back the
whole transaction.

## Inventory and cleanup

Run `inventory-e2e.sql` before and after cleanup. `cleanup-e2e.sql` only targets
records carrying a `STAGING-E2E-*` marker and only removes pending external Cash
requests. Approved Cash requests and Cash transactions intentionally stop the
simple cleanup path and require a separate reconciliation-aware cleanup plan.
