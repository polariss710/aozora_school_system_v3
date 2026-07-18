-- Reconciliation-aware staging-only cleanup for tuition-receipt-smoke.mjs.
begin;

create temporary table staging_tuition_target_ids (
  id text primary key
) on commit drop;

insert into staging_tuition_target_ids (id)
select s.id::text from public.students s where s.memo like 'STAGING-E2E-TUITION-%'
union
select t.id::text from public.teachers t where t.memo like 'STAGING-E2E-TUITION-%'
union
select s.id::text from public.subjects s where s.memo like 'STAGING-E2E-TUITION-%'
union
select l.id::text from public.student_planned_lessons l where l.memo like 'STAGING-E2E-TUITION-%'
union
select b.id::text
from public.student_tuition_bills b
join public.students s on s.id = b.student_id
where s.memo like 'STAGING-E2E-TUITION-%'
union
select i.id::text
from public.income_records i
join public.students s on s.id = i.student_id
where s.memo like 'STAGING-E2E-TUITION-%'
union
select cr.id::text
from public.cash_requests cr
join public.income_records i on i.id = cr.income_record_id
join public.students s on s.id = i.student_id
where s.memo like 'STAGING-E2E-TUITION-%'
union
select r.id::text
from public.receipt_records r
join public.income_records i on i.id = r.income_record_id
join public.students s on s.id = i.student_id
where s.memo like 'STAGING-E2E-TUITION-%'
union
select er.id::text
from public.home_external_transaction_requests er
join public.cash_requests cr on cr.external_cash_request_id::text = er.id::text
join public.income_records i on i.id = cr.income_record_id
join public.students s on s.id = i.student_id
where s.memo like 'STAGING-E2E-TUITION-%'
union
select er.created_transaction_id::text
from public.home_external_transaction_requests er
join public.cash_requests cr on cr.external_cash_request_id::text = er.id::text
join public.income_records i on i.id = cr.income_record_id
join public.students s on s.id = i.student_id
where s.memo like 'STAGING-E2E-TUITION-%'
  and er.created_transaction_id is not null;

do $$
begin
  if (
    select count(*)
    from public.home_external_transaction_requests er
    join public.cash_requests cr on cr.external_cash_request_id::text = er.id::text
    join public.income_records i on i.id = cr.income_record_id
    join public.students s on s.id = i.student_id
    where s.memo like 'STAGING-E2E-TUITION-%'
  ) <> 1 then
    raise exception 'Expected exactly one tuition Cash request.';
  end if;

  if exists (
    select 1
    from public.home_external_transaction_requests er
    join public.cash_requests cr on cr.external_cash_request_id::text = er.id::text
    join public.income_records i on i.id = cr.income_record_id
    join public.students s on s.id = i.student_id
    where s.memo like 'STAGING-E2E-TUITION-%'
      and (
        er.status <> 'approved'
        or er.transaction_type <> 'income'
        or er.currency <> 'JPY'
        or er.amount <> 6000
        or er.created_transaction_id is null
      )
  ) then
    raise exception 'Tuition Cash request does not match accepted approval.';
  end if;

  if (
    select count(*)
    from public.receipt_records r
    join public.income_records i on i.id = r.income_record_id
    join public.students s on s.id = i.student_id
    where s.memo like 'STAGING-E2E-TUITION-%'
      and r.snapshot_currency = 'JPY'
      and r.snapshot_amount_jpy = 6000
      and r.authority_source = 'cash_confirmation'
  ) <> 1 then
    raise exception 'Expected exactly one immutable tuition receipt.';
  end if;

  if exists (
    select 1
    from public.income_records i
    join public.students s on s.id = i.student_id
    where s.memo like 'STAGING-E2E-TUITION-%'
      and (i.record_status <> 'cash_confirmed' or i.cash_status <> 'cash_confirmed')
  ) then
    raise exception 'Tuition income is not cash-confirmed.';
  end if;
end
$$;

delete from public.audit_events
where target_id in (select id from staging_tuition_target_ids);

delete from public.receipt_records
where id::text in (select id from staging_tuition_target_ids);

delete from public.home_external_transaction_requests
where id::text in (select id from staging_tuition_target_ids);

delete from public.cash_requests
where id::text in (select id from staging_tuition_target_ids);

delete from public.home_jpy_transactions
where id::text in (select id from staging_tuition_target_ids);

delete from public.student_tuition_bills
where id::text in (select id from staging_tuition_target_ids);

delete from public.income_records
where id::text in (select id from staging_tuition_target_ids);

delete from public.student_planned_lessons
where id::text in (select id from staging_tuition_target_ids)
  and memo like 'STAGING-E2E-TUITION-%';

delete from public.subjects
where id::text in (select id from staging_tuition_target_ids)
  and memo like 'STAGING-E2E-TUITION-%';

delete from public.students
where id::text in (select id from staging_tuition_target_ids)
  and memo like 'STAGING-E2E-TUITION-%';

delete from public.teachers
where id::text in (select id from staging_tuition_target_ids)
  and memo like 'STAGING-E2E-TUITION-%';

do $$
begin
  if exists (
    select 1 from public.students where memo like 'STAGING-E2E-TUITION-%'
    union all
    select 1 from public.teachers where memo like 'STAGING-E2E-TUITION-%'
    union all
    select 1 from public.subjects where memo like 'STAGING-E2E-TUITION-%'
    union all
    select 1 from public.student_planned_lessons where memo like 'STAGING-E2E-TUITION-%'
    union all
    select 1
    from public.home_external_transaction_requests er
    join public.cash_requests cr on cr.external_cash_request_id::text = er.id::text
    join public.income_records i on i.id = cr.income_record_id
    join public.students s on s.id = i.student_id
    where s.memo like 'STAGING-E2E-TUITION-%'
  ) then
    raise exception 'Tuition receipt cleanup left residual rows.';
  end if;
end
$$;

commit;

select 0 as residual_rows;
