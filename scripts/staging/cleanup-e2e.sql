-- Destructive staging-only cleanup for synthetic records created by the smoke
-- scripts. Never run this against dev or production.
begin;

create temporary table staging_e2e_target_ids (
  id text primary key
) on commit drop;

insert into staging_e2e_target_ids (id)
select id::text from public.students where memo like 'STAGING-E2E-API-%'
union
select id::text from public.teachers where memo like 'STAGING-E2E-API-%'
union
select id::text from public.income_records where memo like 'STAGING-E2E-%'
union
select id::text from public.expense_records where memo like 'STAGING-E2E-%'
union
select id::text from public.account_transactions where memo like 'STAGING-E2E-API-%'
union
select cr.id::text
from public.cash_requests cr
left join public.income_records i on i.id = cr.income_record_id
left join public.expense_records e on e.id = cr.expense_record_id
where coalesce(i.memo, e.memo) like 'STAGING-E2E-CROSS-%';

do $$
begin
  if exists (
    select 1
    from public.home_external_transaction_requests
    where note like 'STAGING-E2E-%'
      and status <> 'pending'
  ) then
    raise exception 'Synthetic Cash request is no longer pending; use reconciliation-aware cleanup.';
  end if;

  if exists (
    select 1
    from public.account_transactions
    where id::text in (select id from staging_e2e_target_ids)
      and status <> 'reversed'
  ) then
    raise exception 'Synthetic School account transaction is not reversed.';
  end if;
end
$$;

delete from public.audit_events
where target_id in (select id from staging_e2e_target_ids);

delete from public.home_external_transaction_requests
where note like 'STAGING-E2E-CROSS-%'
  and external_source = 'aozora_school'
  and status = 'pending';

delete from public.cash_requests
where id::text in (select id from staging_e2e_target_ids);

delete from public.account_transactions
where id::text in (select id from staging_e2e_target_ids)
  and status = 'reversed';

delete from public.income_records
where id::text in (select id from staging_e2e_target_ids)
  and memo like 'STAGING-E2E-%';

delete from public.expense_records
where id::text in (select id from staging_e2e_target_ids)
  and memo like 'STAGING-E2E-%';

delete from public.students
where id::text in (select id from staging_e2e_target_ids)
  and memo like 'STAGING-E2E-API-%';

delete from public.teachers
where id::text in (select id from staging_e2e_target_ids)
  and memo like 'STAGING-E2E-API-%';

commit;

select
  (select count(*) from public.students where memo like 'STAGING-E2E-%')
  + (select count(*) from public.teachers where memo like 'STAGING-E2E-%')
  + (select count(*) from public.income_records where memo like 'STAGING-E2E-%')
  + (select count(*) from public.expense_records where memo like 'STAGING-E2E-%')
  + (select count(*) from public.account_transactions where memo like 'STAGING-E2E-%')
  + (select count(*) from public.home_external_transaction_requests where note like 'STAGING-E2E-%')
  as residual_rows;
