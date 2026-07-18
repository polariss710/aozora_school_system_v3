-- Reconciliation-aware staging-only cleanup for cny-callback-smoke.mjs.
begin;

create temporary table staging_cny_target_ids (id text primary key) on commit drop;

insert into staging_cny_target_ids (id)
select i.id::text from public.income_records i where i.memo like 'STAGING-E2E-CNY-%'
union select e.id::text from public.expense_records e where e.memo like 'STAGING-E2E-CNY-%'
union select cr.id::text from public.cash_requests cr
  left join public.income_records i on i.id=cr.income_record_id
  left join public.expense_records e on e.id=cr.expense_record_id
  where coalesce(i.memo,e.memo) like 'STAGING-E2E-CNY-%'
union select er.id::text from public.home_external_transaction_requests er
  where er.id::text in (
    select cr.external_cash_request_id from public.cash_requests cr
    left join public.income_records i on i.id=cr.income_record_id
    left join public.expense_records e on e.id=cr.expense_record_id
    where coalesce(i.memo,e.memo) like 'STAGING-E2E-CNY-%'
  )
union select er.created_transaction_id::text from public.home_external_transaction_requests er
  where er.id::text in (
    select cr.external_cash_request_id from public.cash_requests cr
    left join public.income_records i on i.id=cr.income_record_id
    left join public.expense_records e on e.id=cr.expense_record_id
    where coalesce(i.memo,e.memo) like 'STAGING-E2E-CNY-%'
  ) and er.created_transaction_id is not null;

do $$
begin
  if (select count(*) from public.income_records where memo like 'STAGING-E2E-CNY-%') <> 1
     or (select count(*) from public.expense_records where memo like 'STAGING-E2E-CNY-%') <> 1 then
    raise exception 'Expected one CNY income and one CNY expense.';
  end if;
  if exists (
    select 1 from public.income_records where memo like 'STAGING-E2E-CNY-%' and (cash_status <> 'cash_confirmed' or record_status <> 'cash_confirmed')
    union all
    select 1 from public.expense_records where memo like 'STAGING-E2E-CNY-%' and (cash_status <> 'cash_confirmed' or record_status <> 'cash_confirmed')
  ) then raise exception 'CNY School records are not confirmed.'; end if;
  if (select count(*) from public.home_external_transaction_requests er where er.id::text in (select id from staging_cny_target_ids) and er.status='approved' and er.transaction_type in ('income','expense') and er.currency='CNY' and er.created_transaction_id is not null) <> 2 then
    raise exception 'Expected two approved CNY Cash transactions.';
  end if;
end
$$;

delete from public.audit_events where target_id in (select id from staging_cny_target_ids);
delete from public.home_external_transaction_requests where id::text in (select id from staging_cny_target_ids) and created_transaction_id is null or id::text in (select id from staging_cny_target_ids);
delete from public.cash_requests where id::text in (select id from staging_cny_target_ids);
delete from public.home_cny_transactions where id::text in (select id from staging_cny_target_ids);
delete from public.income_records where id::text in (select id from staging_cny_target_ids) and memo like 'STAGING-E2E-CNY-%';
delete from public.expense_records where id::text in (select id from staging_cny_target_ids) and memo like 'STAGING-E2E-CNY-%';

do $$
begin
  if exists (select 1 from public.income_records where memo like 'STAGING-E2E-CNY-%')
     or exists (select 1 from public.expense_records where memo like 'STAGING-E2E-CNY-%') then
    raise exception 'CNY cleanup left residual records.';
  end if;
end
$$;
commit;
select 0 as residual_rows;
