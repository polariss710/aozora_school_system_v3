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

`tuition-receipt-smoke.mjs` covers tuition preview fingerprint protection,
bill generation / replay, income generation, Cash approval and callback, and
live / issued receipt immutability. Its cleanup follows the School income →
Cash request → external Cash request chain because Cash external request notes
are not required to carry the School marker.

`cny-callback-smoke.mjs` covers one CNY income and one CNY expense through
external Cash approval, School callback, and replay; use
`cleanup-cny-callback-e2e.sql` after the run.

`wage-batch-callback-smoke.mjs` covers two pre-seeded 2099 teacher wage
expenses through the real Cash aggregate approval RPC, approval replay,
School batch callback / replay, and Cash School-sync marker / replay. It
expects exactly two expense IDs in `STAGING_WAGE_EXPENSE_IDS`. Run
`verify-wage-batch-e2e.sql` afterward; the verified evidence is intentionally
retained for UI acceptance and must not be removed by generic cleanup.

`fx-inbound-smoke.mjs` covers a confirmed CNY School income, the real Cash
CNY-to-JPY FX creation RPC, server-verified inbound options, School callback /
replay / conflict protection, and the Cash School-sync marker / replay. Run
`verify-fx-inbound-e2e.sql` afterward; it reconciles the source income, FX pair,
School event and account transaction, then exercises all four Cash mutation
guards inside a rolled-back transaction. Evidence is retained for UI review.

`external-work-smoke.mjs` covers external workplace creation, planned→actual
lesson generation, settlement preview / lock / export, post-lock mutation
protection, idempotent income generation, post-income revoke protection, and
real JPY Cash approval / callback / replay. `cleanup-external-work-e2e.sql`
requires the fully reconciled JPY 5,300 chain before deleting it.

After manual UI review, use the evidence-specific
`cleanup-finalized-wage-batch-e2e.sql` and
`cleanup-finalized-fx-inbound-e2e.sql`. They pin every retained identity and
reconcile both systems before deleting anything; a mismatch rolls back the
whole cleanup transaction.

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
