begin;

create temporary table staging_final_checks (
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

insert into staging_final_checks values
  ('school_migrations_applied', (select count(*) from public._prisma_migrations where finished_at is not null and rolled_back_at is null), 19),
  ('cash_home_tables', (select count(*) from information_schema.tables where table_schema='public' and table_name like 'home\_%' escape '\'), 10),
  ('cash_home_functions', (select count(*) from information_schema.routines where routine_schema='public' and routine_name like 'home\_%' escape '\'), 48),
  ('cash_home_rls_policies', (select count(*) from pg_policies where schemaname='public' and tablename like 'home\_%' escape '\'), 10),
  ('cash_sync_guard_triggers', (select count(distinct trigger_name) from information_schema.triggers where trigger_schema='public' and trigger_name in ('home_cny_transactions_school_fx_guard','home_jpy_transactions_school_fx_guard','home_cny_transactions_teacher_wage_batch_guard','home_jpy_transactions_teacher_wage_batch_guard')), 4),
  ('staging_cash_accounts', (select count(*) from public.home_accounts where name like 'STAGING Cash%'), 4),
  ('staging_cash_school_accounts', (select count(*) from public.home_accounts where name like 'STAGING Cash%' and allow_school_requests), 3),
  ('temporary_school_admins', (select count(*) from public.users where memo='STAGING-E2E-TEMP-ADMIN'), 0),
  ('synthetic_students', (select count(*) from public.students where memo like 'STAGING-E2E-%'), 0),
  ('synthetic_teachers', (select count(*) from public.teachers where memo like 'STAGING-E2E-%'), 0),
  ('synthetic_income_records', (select count(*) from public.income_records where memo like 'STAGING-E2E-%'), 0),
  ('synthetic_expense_records', (select count(*) from public.expense_records where memo like 'STAGING-E2E-%'), 0),
  ('synthetic_external_workplaces', (select count(*) from public.external_workplaces where memo like 'STAGING-E2E-%'), 0),
  ('synthetic_school_cash_requests', (select count(*) from public.cash_requests cr left join public.income_records i on i.id=cr.income_record_id left join public.expense_records e on e.id=cr.expense_record_id where coalesce(i.memo,e.memo,'') like 'STAGING-E2E-%'), 0),
  ('synthetic_external_cash_requests', (select count(*) from public.home_external_transaction_requests where payload_snapshot->>'note' like 'STAGING-E2E-%'), 0),
  ('cash_payment_batches', (select count(*) from public.home_external_transaction_batches), 0),
  ('school_payment_batches', (select count(*) from public.cash_payment_batches), 0),
  ('cash_fx_syncs', (select count(*) from public.home_school_fx_syncs), 0),
  ('orphan_school_external_requests', (
    select count(*) from public.cash_requests cr
    where cr.external_cash_request_id is not null
      and not exists (select 1 from public.home_external_transaction_requests er where er.id::text=cr.external_cash_request_id)
  ), 0),
  ('orphan_cash_school_requests', (
    select count(*) from public.home_external_transaction_requests er
    where er.external_source='aozora_school'
      and not exists (select 1 from public.cash_requests cr where cr.external_cash_request_id=er.id::text)
  ), 0),
  ('confirmed_request_status_mismatches', (
    select count(*) from public.cash_requests cr
    join public.home_external_transaction_requests er on er.id::text=cr.external_cash_request_id
    where (cr.status='cash_confirmed' and er.status<>'approved')
       or (cr.status='cash_rejected' and er.status<>'rejected')
  ), 0),
  ('anon_home_table_grants', (
    select count(*) from information_schema.role_table_grants
    where grantee='anon' and table_schema='public' and table_name like 'home\_%' escape '\'
  ), 0),
  ('anon_home_function_grants', (
    select count(*) from information_schema.role_routine_grants
    where grantee='anon' and specific_schema='public' and routine_name like 'home\_%' escape '\'
  ), 0);

do $$
declare
  v_failures text;
begin
  select string_agg(format('%s actual=%s expected=%s',check_name,actual,expected),'; ' order by check_name)
  into v_failures
  from staging_final_checks
  where actual <> expected;
  if v_failures is not null then raise exception 'Final staging reconciliation failed: %', v_failures; end if;
end
$$;

select check_name, actual, expected, actual=expected as passed
from staging_final_checks
order by check_name;

rollback;
