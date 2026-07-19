begin;

do $$
declare
  v_cash_batch_id uuid := 'c9312d4f-4712-46b0-a08b-5081f3def62c';
  v_cash_transaction_id uuid := '4d7e6083-2c28-43ce-8a03-01314d3ba4a9';
  v_school_batch_id uuid := '6e55688a-1d74-44f6-ab9a-18fab19f4ea4';
begin
  if (select count(*) from public.home_external_transaction_batches where id=v_cash_batch_id and created_transaction_id=v_cash_transaction_id and school_payment_batch_id=v_school_batch_id and status='approved' and currency='JPY' and total_amount=3900 and request_count=2) <> 1 then
    raise exception 'Retained Cash wage batch identity does not match.';
  end if;
  if (select count(*) from public.home_external_transaction_batch_items bi join public.expense_records e on e.id=bi.external_reference_id where bi.batch_id=v_cash_batch_id and e.memo='STAGING-E2E-WAGE-BATCH-1784390004') <> 2 then
    raise exception 'Retained Cash wage items do not match.';
  end if;
  if (select coalesce(sum(amount),0) from public.home_external_transaction_batch_items where batch_id=v_cash_batch_id) <> 3900 then
    raise exception 'Retained Cash wage item total does not match.';
  end if;
  if (select count(*) from public.cash_payment_batches where id=v_school_batch_id and external_cash_batch_id=v_cash_batch_id and external_cash_transaction_id=v_cash_transaction_id and total_amount_jpy=3900 and status='cash_confirmed') <> 1
    or (select count(*) from public.cash_payment_batch_items where batch_id=v_school_batch_id) <> 2 then
    raise exception 'Retained School wage batch does not match.';
  end if;
end
$$;

create temporary table staging_wage_cleanup on commit drop as
select
  b.id as cash_batch_id,
  b.created_transaction_id as cash_transaction_id,
  b.school_payment_batch_id as school_batch_id,
  bi.request_id as external_request_id,
  bi.external_reference_id as expense_id,
  cr.id as school_request_id,
  e.source_id::uuid as snapshot_id,
  e.teacher_id,
  e.business_entity_id
from public.home_external_transaction_batches b
join public.home_external_transaction_batch_items bi on bi.batch_id=b.id
join public.expense_records e on e.id=bi.external_reference_id
join public.cash_requests cr on cr.expense_record_id=e.id and cr.external_cash_request_id=bi.request_id::text
where b.id='c9312d4f-4712-46b0-a08b-5081f3def62c'::uuid
  and e.memo='STAGING-E2E-WAGE-BATCH-1784390004';

delete from public.audit_events a using staging_wage_cleanup t
where a.target_id in (t.school_request_id::text,t.expense_id::text,t.snapshot_id::text,t.teacher_id::text,t.business_entity_id::text);
delete from public.cash_payment_batch_items pi where pi.batch_id='6e55688a-1d74-44f6-ab9a-18fab19f4ea4'::uuid;
delete from public.cash_payment_batches pb where pb.id='6e55688a-1d74-44f6-ab9a-18fab19f4ea4'::uuid;
delete from public.home_external_transaction_batch_items bi where bi.batch_id='c9312d4f-4712-46b0-a08b-5081f3def62c'::uuid;
delete from public.home_external_transaction_requests er using staging_wage_cleanup t where er.id=t.external_request_id;
delete from public.home_external_transaction_batches b where b.id='c9312d4f-4712-46b0-a08b-5081f3def62c'::uuid;
delete from public.home_jpy_transactions jt where jt.id='4d7e6083-2c28-43ce-8a03-01314d3ba4a9'::uuid;
delete from public.cash_requests cr using staging_wage_cleanup t where cr.id=t.school_request_id;
update public.teacher_wage_snapshots s set expense_record_id=null from staging_wage_cleanup t where s.id=t.snapshot_id;
delete from public.expense_records e using staging_wage_cleanup t where e.id=t.expense_id;
delete from public.teacher_wage_snapshots s using staging_wage_cleanup t where s.id=t.snapshot_id;
delete from public.teachers teacher using staging_wage_cleanup t where teacher.id=t.teacher_id;
delete from public.business_entities entity using staging_wage_cleanup t where entity.id=t.business_entity_id;

do $$
begin
  if exists (select 1 from public.expense_records where memo='STAGING-E2E-WAGE-BATCH-1784390004')
    or exists (select 1 from public.home_external_transaction_batches where id='c9312d4f-4712-46b0-a08b-5081f3def62c'::uuid)
    or exists (select 1 from public.cash_payment_batches where id='6e55688a-1d74-44f6-ab9a-18fab19f4ea4'::uuid) then
    raise exception 'Finalized wage batch cleanup left residual records.';
  end if;
end
$$;

commit;
select 0 as residual_rows;
