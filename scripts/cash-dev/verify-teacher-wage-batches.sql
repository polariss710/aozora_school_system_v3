\set ON_ERROR_STOP on
\pset pager off

select count(*) = 2 as has_teacher_wage_batch_tables
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'home_external_transaction_batches',
    'home_external_transaction_batch_items'
  );

select count(distinct trigger_name) = 2 as has_teacher_wage_batch_guards
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'home_jpy_transactions_teacher_wage_batch_guard',
    'home_cny_transactions_teacher_wage_batch_guard'
  );

select has_function_privilege(
  'authenticated',
  'public.home_approve_teacher_wage_request_batch(uuid[])',
  'EXECUTE'
) as authenticated_can_approve_teacher_wage_batch;

select has_function_privilege(
  'authenticated',
  'public.home_mark_teacher_wage_batch_school_synced(uuid,uuid)',
  'EXECUTE'
) as authenticated_can_mark_teacher_wage_batch_synced;

select not has_table_privilege(
  'authenticated',
  'public.home_external_transaction_batches',
  'INSERT,UPDATE,DELETE'
) as authenticated_cannot_mutate_batches_directly;

select not has_table_privilege(
  'authenticated',
  'public.home_external_transaction_batch_items',
  'INSERT,UPDATE,DELETE'
) as authenticated_cannot_mutate_batch_items_directly;

select not has_function_privilege(
  'anon',
  'public.home_approve_teacher_wage_request_batch(uuid[])',
  'EXECUTE'
) as anon_cannot_approve_teacher_wage_batch;
