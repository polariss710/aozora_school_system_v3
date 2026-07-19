\set ON_ERROR_STOP on

-- Read-only Cash production ledger snapshot for the independent V3 Cash
-- migration phase. Run only with a dedicated Cash production read-only
-- connection. The JSON result must be stored outside the repository.

begin transaction isolation level repeatable read read only;
set local statement_timeout = '90s';
set local lock_timeout = '5s';

with snapshot_context as (
  select transaction_timestamp() as captured_at
), accounts as (
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb) as rows
  from public.home_accounts a
), payment_channels as (
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb) as rows
  from public.home_payment_channels p
), fixed_templates as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as rows
  from public.home_fixed_templates t
), fixed_month_items as (
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) as rows
  from public.home_fixed_month_items i
), jpy_transactions as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as rows
  from public.home_jpy_transactions t
), cny_transactions as (
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as rows
  from public.home_cny_transactions t
), external_requests as (
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) as rows
  from public.home_external_transaction_requests r
)
select jsonb_build_object(
  'contractVersion', 'aozora-cash-ledger-snapshot-v1',
  'sourceSnapshot', jsonb_build_object(
    'sourceSystem', 'cash_prod',
    'capturedAt', (select captured_at from snapshot_context),
    'isolation', 'repeatable_read_read_only'
  ),
  'accounts', (select rows from accounts),
  'paymentChannels', (select rows from payment_channels),
  'fixedTemplates', (select rows from fixed_templates),
  'fixedMonthItems', (select rows from fixed_month_items),
  'jpyTransactions', (select rows from jpy_transactions),
  'cnyTransactions', (select rows from cny_transactions),
  'externalRequests', (select rows from external_requests)
) as cash_ledger_snapshot;

rollback;
