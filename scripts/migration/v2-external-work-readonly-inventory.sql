\set ON_ERROR_STOP on

-- V2 private-tutoring work migration inventory.
-- Contract: SELECT-only, aggregate-only, no row-level personal data output.
-- Run only after explicit authorization against the current School V2 production database.

begin transaction read only;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

select 'scope' as check_name, jsonb_build_object(
  'year_month_from', '2025-12',
  'year_month_to', '2026-11'
) as result;

select 'historical_batches' as check_name, jsonb_build_object(
  'count', count(*),
  'expected_lesson_count', coalesce(sum(expected_lesson_count), 0),
  'expected_total_jpy', coalesce(sum(expected_total_jpy), 0),
  'expected_total_cny', coalesce(sum(expected_total_cny), 0),
  'distinct_source_keys', count(distinct source_key),
  'distinct_source_hashes', count(distinct source_sha256)
) as result
from public.school_historical_part_time_work_import_batches
where period_end >= '2025-12'
  and period_start <= '2026-11';

select 'lessons_by_kind_and_delete_state' as check_name, jsonb_agg(to_jsonb(x) order by record_kind, delete_state) as result
from (
  select
    record_kind,
    case when deleted_at is null then 'active' else 'soft_deleted' end as delete_state,
    count(*) as row_count,
    count(*) filter (where historical_import_batch_id is not null) as historical_count,
    coalesce(sum(lesson_wage_jpy), 0) as lesson_wage_jpy,
    coalesce(sum(transportation_fee_jpy), 0) as transportation_fee_jpy
  from public.school_part_time_work_lessons
  where year_month between '2025-12' and '2026-11'
  group by record_kind, case when deleted_at is null then 'active' else 'soft_deleted' end
) x;

select 'lesson_reference_integrity' as check_name, jsonb_build_object(
  'actual_without_planned', count(*) filter (where p.id is null),
  'actual_linked_to_soft_deleted_planned', count(*) filter (where p.deleted_at is not null),
  'duplicate_active_actual_groups', (
    select count(*)
    from (
      select planned_lesson_id
      from public.school_part_time_work_lessons
      where record_kind = 'actual'
        and deleted_at is null
        and year_month between '2025-12' and '2026-11'
      group by planned_lesson_id
      having count(*) > 1
    ) duplicate_actual
  )
) as result
from public.school_part_time_work_lessons a
left join public.school_part_time_work_lessons p on p.id = a.planned_lesson_id
where a.record_kind = 'actual'
  and a.year_month between '2025-12' and '2026-11';

select 'settlements_by_status' as check_name, jsonb_agg(to_jsonb(x) order by status) as result
from (
  select
    status,
    count(*) as row_count,
    coalesce(sum(actual_lesson_count), 0) as lesson_count,
    coalesce(sum(actual_hours_total), 0) as lesson_hours,
    coalesce(sum(lesson_wage_jpy), 0) as lesson_wage_jpy,
    coalesce(sum(transportation_fee_jpy), 0) as transportation_fee_jpy,
    coalesce(sum(adjustment_jpy), 0) as adjustment_jpy,
    coalesce(sum(total_wage_jpy), 0) as total_wage_jpy
  from public.school_part_time_work_monthly_settlements
  where year_month between '2025-12' and '2026-11'
  group by status
) x;

select 'settlement_integrity' as check_name, jsonb_build_object(
  'duplicate_active_workplace_month_groups', (
    select count(*)
    from (
      select workplace_name, year_month
      from public.school_part_time_work_monthly_settlements
      where deleted_at is null
        and year_month between '2025-12' and '2026-11'
      group by workplace_name, year_month
      having count(*) > 1
    ) duplicate_settlement
  ),
  'details_without_settlement', count(*) filter (where s.id is null),
  'details_without_actual_lesson', count(*) filter (where l.id is null),
  'details_linked_to_non_actual', count(*) filter (where l.id is not null and l.record_kind <> 'actual')
) as result
from public.school_part_time_work_monthly_settlement_details d
left join public.school_part_time_work_monthly_settlements s on s.id = d.settlement_id
left join public.school_part_time_work_lessons l on l.id = d.actual_lesson_id
where coalesce(s.year_month, to_char(d.work_date, 'YYYY-MM')) between '2025-12' and '2026-11';

with scoped_settlements as (
  select id, income_record_id
  from public.school_part_time_work_monthly_settlements
  where year_month between '2025-12' and '2026-11'
), scoped_incomes as (
  select i.*
  from public.school_income_records i
  join scoped_settlements s on s.income_record_id = i.id
)
select 'income_integrity' as check_name, jsonb_build_object(
  'settlements', (select count(*) from scoped_settlements),
  'settlements_with_income', (select count(*) from scoped_settlements where income_record_id is not null),
  'resolved_incomes', count(*),
  'source_mismatch', count(*) filter (
    where source_type is distinct from 'external_part_time_work'
       or source_id is null
  ),
  'amount_total', coalesce(sum(amount), 0)
) as result
from scoped_incomes;

with scoped_incomes as (
  select i.id
  from public.school_part_time_work_monthly_settlements s
  join public.school_income_records i on i.id = s.income_record_id
  where s.year_month between '2025-12' and '2026-11'
)
select 'linkage_by_status' as check_name, jsonb_agg(to_jsonb(x) order by sync_status) as result
from (
  select
    e.sync_status,
    count(*) as row_count,
    count(distinct e.idempotency_key) as distinct_idempotency_keys,
    count(*) filter (where e.cash_transaction_id is not null) as with_cash_transaction,
    count(distinct e.cash_transaction_id) filter (where e.cash_transaction_id is not null) as distinct_cash_transactions,
    coalesce(sum(e.amount), 0) as original_amount,
    coalesce(sum(e.payment_amount), 0) as payment_amount
  from public.school_personal_cash_income_linkage_events e
  join scoped_incomes i on i.id = e.income_record_id
  group by e.sync_status
) x;

with scoped_incomes as (
  select i.id
  from public.school_part_time_work_monthly_settlements s
  join public.school_income_records i on i.id = s.income_record_id
  where s.year_month between '2025-12' and '2026-11'
), scoped_events as (
  select e.*
  from public.school_personal_cash_income_linkage_events e
  join scoped_incomes i on i.id = e.income_record_id
)
select 'linkage_integrity' as check_name, jsonb_build_object(
  'source_identity_mismatch', count(*) filter (
    where source_table is distinct from 'school_income_records'
       or source_id is distinct from income_record_id
  ),
  'duplicate_idempotency_keys', (
    select count(*) from (
      select idempotency_key from scoped_events group by idempotency_key having count(*) > 1
    ) duplicate_key
  ),
  'synced_without_transaction', count(*) filter (
    where sync_status = 'synced' and cash_transaction_id is null
  ),
  'historical_confirmed_with_transaction', count(*) filter (
    where sync_status = 'historical_confirmed' and cash_transaction_id is not null
  )
) as result
from scoped_events;

with scoped_settlements as (
  select id
  from public.school_part_time_work_monthly_settlements
  where year_month between '2025-12' and '2026-11'
)
select 'legacy_income_requests' as check_name, jsonb_build_object(
  'referenced_count', count(*),
  'active_count', count(*) filter (where r.deleted_at is null),
  'with_cash_request_id', count(*) filter (where r.cash_request_id is not null),
  'with_cash_transaction_id', count(*) filter (where r.cash_transaction_id is not null),
  'amount_jpy', coalesce(sum(r.amount_jpy), 0)
) as result
from public.school_part_time_work_income_requests r
join scoped_settlements s on s.id = r.settlement_id;

rollback;
