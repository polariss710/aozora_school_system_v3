\set ON_ERROR_STOP on

-- Cash production ledger inventory.
-- Contract: SELECT-only, aggregate-only, no account names, UUIDs, notes, or row-level output.
-- Run only after explicit authorization against the current Cash production database.

begin transaction read only;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

select 'cash_home_schema' as check_name, jsonb_build_object(
  'tables', (
    select jsonb_agg(table_name order by table_name)
    from information_schema.tables
    where table_schema = 'public' and table_name like 'home\_%' escape '\'
  ),
  'table_count', (
    select count(*)
    from information_schema.tables
    where table_schema = 'public' and table_name like 'home\_%' escape '\'
  ),
  'function_count', (
    select count(*)
    from information_schema.routines
    where routine_schema = 'public' and routine_name like 'home\_%' escape '\'
  ),
  'rls_policy_count', (
    select count(*)
    from pg_policies
    where schemaname = 'public' and tablename like 'home\_%' escape '\'
  )
) as result;

select 'cash_accounts' as check_name, jsonb_agg(to_jsonb(x) order by currency, account_type, is_active) as result
from (
  select
    currency,
    account_type,
    is_active,
    count(*) as row_count,
    coalesce(sum(opening_balance), 0) as opening_balance
  from public.home_accounts
  group by currency, account_type, is_active
) x;

select 'cash_transactions' as check_name, jsonb_agg(to_jsonb(x) order by currency, transaction_type) as result
from (
  select
    'JPY' as currency,
    transaction_type,
    count(*) as row_count,
    coalesce(sum(amount), 0) as amount,
    min(transacted_at) as first_date,
    max(transacted_at) as last_date,
    count(*) filter (where created_by_external is true) as external_count
  from public.home_jpy_transactions
  group by transaction_type
  union all
  select
    'CNY' as currency,
    transaction_type,
    count(*) as row_count,
    coalesce(sum(amount), 0) as amount,
    min(transacted_at) as first_date,
    max(transacted_at) as last_date,
    count(*) filter (where created_by_external is true) as external_count
  from public.home_cny_transactions
  group by transaction_type
) x;

select 'cash_fixed_data' as check_name, jsonb_build_object(
  'payment_channels', (select count(*) from public.home_payment_channels),
  'active_payment_channels', (select count(*) from public.home_payment_channels where is_active),
  'fixed_templates', (select count(*) from public.home_fixed_templates),
  'active_fixed_templates', (select count(*) from public.home_fixed_templates where is_active),
  'fixed_month_items', (select count(*) from public.home_fixed_month_items),
  'fixed_month_amount', (select coalesce(sum(amount), 0) from public.home_fixed_month_items),
  'fixed_month_statuses', (
    select coalesce(jsonb_object_agg(status, row_count), '{}'::jsonb)
    from (
      select status, count(*) as row_count
      from public.home_fixed_month_items
      group by status
    ) s
  )
) as result;

select 'cash_external_requests' as check_name, jsonb_agg(to_jsonb(x) order by currency, request_type, status) as result
from (
  select
    currency,
    request_type,
    status,
    count(*) as row_count,
    coalesce(sum(amount), 0) as amount,
    count(*) filter (where created_transaction_id is not null) as with_transaction
  from public.home_external_transaction_requests
  group by currency, request_type, status
) x;

select 'cash_integrity' as check_name, jsonb_build_object(
  'jpy_account_orphans', (
    select count(*)
    from public.home_jpy_transactions t
    left join public.home_accounts a on a.id = t.account_id
    where a.id is null
  ),
  'cny_account_orphans', (
    select count(*)
    from public.home_cny_transactions t
    left join public.home_accounts a on a.id = t.account_id
    where a.id is null
  ),
  'fixed_template_orphans', (
    select count(*)
    from public.home_fixed_month_items i
    left join public.home_fixed_templates t on t.id = i.template_id
    where i.template_id is not null and t.id is null
  ),
  'fixed_account_orphans', (
    select count(*)
    from public.home_fixed_month_items i
    left join public.home_accounts a on a.id = i.account_id
    where i.account_id is not null and a.id is null
  ),
  'request_account_orphans', (
    select count(*)
    from public.home_external_transaction_requests r
    left join public.home_accounts a on a.id = r.account_id
    where a.id is null
  ),
  'approved_request_transaction_orphans', (
    select count(*)
    from public.home_external_transaction_requests r
    left join public.home_jpy_transactions j
      on r.currency = 'JPY' and j.id = r.created_transaction_id
    left join public.home_cny_transactions c
      on r.currency = 'CNY' and c.id = r.created_transaction_id
    where r.status = 'approved' and coalesce(j.id, c.id) is null
  ),
  'nonapproved_with_transaction', (
    select count(*)
    from public.home_external_transaction_requests
    where status <> 'approved' and created_transaction_id is not null
  )
) as result;

select 'cash_user_scope' as check_name, jsonb_build_object(
  'auth_users', (select count(*) from auth.users),
  'account_users', (select count(distinct user_id) from public.home_accounts),
  'jpy_transaction_users', (select count(distinct user_id) from public.home_jpy_transactions),
  'cny_transaction_users', (select count(distinct user_id) from public.home_cny_transactions),
  'external_request_users', (select count(distinct user_id) from public.home_external_transaction_requests)
) as result;

rollback;
