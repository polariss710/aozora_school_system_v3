begin;

create temporary table staging_external_work_targets on commit drop as
select
  w.id as workplace_id,
  s.id as settlement_id,
  s.income_record_id,
  cr.id as cash_request_id,
  cr.external_cash_request_id::uuid as external_request_id,
  cr.external_cash_transaction_id::uuid as cash_transaction_id
from public.external_workplaces w
join public.external_work_monthly_settlements s on s.workplace_id = w.id
join public.cash_requests cr on cr.income_record_id = s.income_record_id
where w.memo like 'STAGING-E2E-EXTERNAL-WORK-%';

do $$
begin
  if (select count(*) from staging_external_work_targets) <> 1 then raise exception 'Expected one finalized external-work target chain.'; end if;
  if (select count(*) from public.external_work_lessons l join staging_external_work_targets t on t.workplace_id=l.workplace_id) <> 2 then raise exception 'Expected one planned and one actual external-work lesson.'; end if;
  if exists (
    select 1 from staging_external_work_targets t
    join public.external_work_monthly_settlements s on s.id=t.settlement_id
    join public.income_records i on i.id=t.income_record_id
    join public.cash_requests cr on cr.id=t.cash_request_id
    join public.home_external_transaction_requests er on er.id=t.external_request_id
    where s.status <> 'income_created' or s.total_amount_jpy <> 5300
      or i.source_type <> 'external_work' or i.original_amount_jpy <> 5300
      or i.record_status <> 'cash_confirmed' or i.cash_status <> 'cash_confirmed'
      or cr.status <> 'cash_confirmed' or er.status <> 'approved'
      or er.created_transaction_id <> t.cash_transaction_id
  ) then raise exception 'External-work target chain is not fully reconciled.'; end if;
end
$$;

delete from public.audit_events a using staging_external_work_targets t
where a.target_id in (t.workplace_id::text,t.settlement_id::text,t.income_record_id::text,t.cash_request_id::text);
delete from public.home_external_transaction_requests er using staging_external_work_targets t where er.id=t.external_request_id;
delete from public.cash_requests cr using staging_external_work_targets t where cr.id=t.cash_request_id;
delete from public.home_jpy_transactions jt using staging_external_work_targets t where jt.id=t.cash_transaction_id;
update public.external_work_monthly_settlements s set income_record_id=null from staging_external_work_targets t where s.id=t.settlement_id;
delete from public.income_records i using staging_external_work_targets t where i.id=t.income_record_id;
delete from public.external_work_settlement_details d using staging_external_work_targets t where d.settlement_id=t.settlement_id;
delete from public.external_work_monthly_settlements s using staging_external_work_targets t where s.id=t.settlement_id;
delete from public.audit_events a using staging_external_work_targets t
where a.target_id in (select l.id::text from public.external_work_lessons l where l.workplace_id=t.workplace_id);
delete from public.external_work_lessons l using staging_external_work_targets t where l.workplace_id=t.workplace_id;
delete from public.external_workplaces w using staging_external_work_targets t where w.id=t.workplace_id;

do $$
begin
  if exists (select 1 from public.external_workplaces where memo like 'STAGING-E2E-EXTERNAL-WORK-%')
    or exists (select 1 from public.income_records where memo like 'STAGING-E2E-EXTERNAL-WORK-%') then
    raise exception 'External-work cleanup left residual records.';
  end if;
end
$$;

commit;
select 0 as residual_rows;
