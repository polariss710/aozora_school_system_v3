\set ON_ERROR_STOP on
\pset pager off

select to_regclass('public.home_school_fx_syncs') is not null
  as has_school_fx_sync_table;

select count(distinct trigger_name) = 2 as has_school_fx_guard_triggers
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'home_cny_transactions_school_fx_guard',
    'home_jpy_transactions_school_fx_guard'
  );

select has_function_privilege(
  'authenticated',
  'public.home_mark_cny_to_jpy_fx_school_synced(uuid,uuid,uuid)',
  'EXECUTE'
) as authenticated_can_mark_school_fx_sync;

select not has_table_privilege(
  'authenticated',
  'public.home_school_fx_syncs',
  'INSERT,UPDATE,DELETE'
) as authenticated_cannot_mutate_sync_table_directly;

select not has_function_privilege(
  'anon',
  'public.home_mark_cny_to_jpy_fx_school_synced(uuid,uuid,uuid)',
  'EXECUTE'
) as anon_cannot_mark_school_fx_sync;
