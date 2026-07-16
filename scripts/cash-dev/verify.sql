\set ON_ERROR_STOP on
\pset pager off

select count(*) = 7 as has_expected_table_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname like 'home\_%' escape '\';

select count(*) = 42 as has_expected_function_count
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'home\_%' escape '\';

select count(*) = 7 as has_expected_policy_count
from pg_policies
where schemaname = 'public'
  and tablename like 'home\_%' escape '\';

select count(*) = 0 as anon_has_no_table_privileges
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname like 'home\_%' escape '\'
  and has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE');

select count(*) = 0 as anon_has_no_function_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'home\_%' escape '\'
  and has_function_privilege('anon', p.oid, 'EXECUTE');

select count(*) = 0 as authenticated_cannot_create_external_requests
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'home_create_external_transaction_request',
    'home_create_external_jpy_transaction',
    'home_create_external_cny_transaction'
  )
  and has_function_privilege('authenticated', p.oid, 'EXECUTE');

select count(*) = 0 as cash_dev_starts_without_transactions
from (
  select id from public.home_jpy_transactions
  union all
  select id from public.home_cny_transactions
) transactions;

select count(*) = 0 as cash_dev_starts_without_external_requests
from public.home_external_transaction_requests;
