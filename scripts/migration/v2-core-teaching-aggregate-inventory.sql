\set ON_ERROR_STOP on

begin transaction isolation level repeatable read read only;
set local statement_timeout = '90s';
set local lock_timeout = '5s';

with scope as (
  select '2026-07'::text as start_year_month, '2026-12'::text as end_year_month
),
scoped_lessons as (
  select l.*
  from public.school_lesson_records l
  cross join scope s
  where l.year_month between s.start_year_month and s.end_year_month
),
scoped_settlements as (
  select s.*
  from public.school_student_monthly_settlements s
  cross join scope boundary
  where s.year_month between boundary.start_year_month and boundary.end_year_month
),
scoped_bills as (
  select b.*
  from public.school_student_tuition_bills b
  cross join scope s
  where b.billing_month between s.start_year_month and s.end_year_month
),
scoped_wage_locks as (
  select w.*
  from public.school_teacher_wage_locks w
  cross join scope s
  where w.settlement_month between s.start_year_month and s.end_year_month
),
scoped_income as (
  select i.*
  from public.school_income_records i
  cross join scope s
  where i.year_month between s.start_year_month and s.end_year_month
),
scoped_expense as (
  select e.*
  from public.school_expense_records e
  cross join scope s
  where e.year_month between s.start_year_month and s.end_year_month
),
reference_closure as (
  select business_entity_id as id, 'business_entity' as kind from scoped_lessons where business_entity_id is not null
  union
  select business_entity_id, 'business_entity' from scoped_settlements where business_entity_id is not null
  union
  select business_entity_id, 'business_entity' from scoped_bills where business_entity_id is not null
  union
  select business_entity_id, 'business_entity' from scoped_wage_locks where business_entity_id is not null
  union
  select business_entity_id, 'business_entity' from scoped_income where business_entity_id is not null
  union
  select business_entity_id, 'business_entity' from scoped_expense where business_entity_id is not null
  union
  select student_id, 'student' from scoped_lessons where student_id is not null
  union
  select student_id, 'student' from scoped_settlements where student_id is not null
  union
  select student_id, 'student' from scoped_bills where student_id is not null
  union
  select student_id, 'student' from scoped_income where student_id is not null
  union
  select teacher_id, 'teacher' from scoped_lessons where teacher_id is not null
  union
  select teacher_id, 'teacher' from scoped_wage_locks where teacher_id is not null
  union
  select teacher_id, 'teacher' from scoped_expense where teacher_id is not null
  union
  select subject_id, 'subject' from scoped_lessons where subject_id is not null
),
aggregate_rows as (
  select 'lessons'::text as section, year_month, lesson_type as dimension_a, status as dimension_b,
    count(*)::bigint as row_count,
    coalesce(sum(duration_hours), 0)::numeric as amount_a,
    coalesce(sum(lesson_fee), 0)::numeric as amount_b,
    null::numeric as amount_c
  from scoped_lessons
  group by year_month, lesson_type, status

  union all

  select 'student_settlements', year_month, settlement_status, null,
    count(*)::bigint,
    coalesce(sum(actual_lesson_fee_jpy), 0)::numeric,
    coalesce(sum(received_jpy), 0)::numeric,
    coalesce(sum(received_cny), 0)::numeric
  from scoped_settlements
  group by year_month, settlement_status

  union all

  select 'student_bills', billing_month, status, null,
    count(*)::bigint,
    coalesce(sum(bill_amount_jpy), 0)::numeric,
    coalesce(sum(billing_amount_cny), 0)::numeric,
    null::numeric
  from scoped_bills
  group by billing_month, status

  union all

  select 'teacher_wage_locks', settlement_month, settlement_type, status,
    count(*)::bigint,
    coalesce(sum(total_jpy), 0)::numeric,
    coalesce(sum(total_cny), 0)::numeric,
    coalesce(sum(fee_jpy), 0)::numeric
  from scoped_wage_locks
  group by settlement_month, settlement_type, status

  union all

  select 'income_records', year_month, currency, status,
    count(*)::bigint,
    coalesce(sum(amount_jpy), 0)::numeric,
    coalesce(sum(amount_cny), 0)::numeric,
    coalesce(sum(amount), 0)::numeric
  from scoped_income
  group by year_month, currency, status

  union all

  select 'expense_records', year_month, currency, status,
    count(*)::bigint,
    coalesce(sum(amount_jpy), 0)::numeric,
    coalesce(sum(amount_cny), 0)::numeric,
    coalesce(sum(amount), 0)::numeric
  from scoped_expense
  group by year_month, currency, status
),
integrity_checks as (
  select 'wage_detail_missing_lesson'::text as check_name,
    count(*) filter (where l.id is null)::bigint as issue_count
  from public.school_teacher_wage_lock_details d
  join scoped_wage_locks w on w.id = d.lock_id
  left join public.school_lesson_records l on l.id = d.lesson_record_id

  union all

  select 'carryover_missing_source_settlement',
    count(*) filter (where source_settlement_id is not null and settlement.id is null)::bigint
  from public.school_student_settlement_carryovers c
  cross join scope boundary
  left join public.school_student_monthly_settlements settlement on settlement.id = c.source_settlement_id
  where c.to_year_month between boundary.start_year_month and boundary.end_year_month

  union all

  select 'attachment_missing_scoped_expense',
    count(*) filter (where e.id is null)::bigint
  from public.school_expense_attachments a
  left join public.school_expense_records e on e.id = a.expense_id
  where a.expense_id is not null

  union all

  select 'wage_adjustment_missing_lock',
    count(*) filter (where w.id is null)::bigint
  from public.school_teacher_wage_detail_adjustments a
  left join public.school_teacher_wage_locks w on w.id = a.wage_lock_id
  where a.wage_lock_id is not null

  union all

  select 'actual_missing_planned_source',
    count(*) filter (where actual.planned_lesson_id is not null and planned.id is null)::bigint
  from scoped_lessons actual
  left join public.school_lesson_records planned
    on planned.id = actual.planned_lesson_id
   and planned.lesson_type = 'planned'
  where actual.lesson_type = 'actual'
)
select jsonb_build_object(
  'contractVersion', 'aozora-v2-core-teaching-aggregate-inventory-v2',
  'sourceSnapshot', jsonb_build_object(
    'sourceSystem', 'school_v2',
    'capturedAt', clock_timestamp(),
    'isolation', 'repeatable_read_read_only',
    'containsBusinessRows', false,
    'scopeStartYearMonth', (select start_year_month from scope),
    'scopeEndYearMonth', (select end_year_month from scope)
  ),
  'aggregates', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'section', section,
      'yearMonth', year_month,
      'dimensionA', dimension_a,
      'dimensionB', dimension_b,
      'rowCount', row_count,
      'amountA', amount_a,
      'amountB', amount_b,
      'amountC', amount_c
    ) order by section, year_month, dimension_a nulls first, dimension_b nulls first), '[]'::jsonb)
    from aggregate_rows
  ),
  'dependentCounts', jsonb_build_object(
    'studentSettlementAdjustments', (
      select count(*)::bigint
      from public.school_student_settlement_adjustments a
      join scoped_settlements s on s.id = a.settlement_id
    ),
    'studentSettlementCarryovers', (
      select count(*)::bigint
      from public.school_student_settlement_carryovers c
      cross join scope s
      where c.to_year_month between s.start_year_month and s.end_year_month
    ),
    'teacherWageLockDetails', (
      select count(*)::bigint
      from public.school_teacher_wage_lock_details d
      join scoped_wage_locks w on w.id = d.lock_id
    ),
    'teacherWageDetailAdjustments', (
      select count(*)::bigint
      from public.school_teacher_wage_detail_adjustments a
      join scoped_wage_locks w on w.id = a.wage_lock_id
    ),
    'expenseAttachments', (
      select count(*)::bigint
      from public.school_expense_attachments a
      join scoped_expense e on e.id = a.expense_id
    ),
    'paymentRequestsAtOrAfterScope', (
      select count(*)::bigint
      from public.school_payment_requests p
      cross join scope s
      where p.request_month between s.start_year_month and s.end_year_month
    )
  ),
  'outOfScopeFutureCounts', jsonb_build_object(
    'incomeRecords', (
      select count(*)::bigint
      from public.school_income_records i
      cross join scope s
      where i.year_month > s.end_year_month
    ),
    'expenseRecords', (
      select count(*)::bigint
      from public.school_expense_records e
      cross join scope s
      where e.year_month > s.end_year_month
    ),
    'lessonRecords', (
      select count(*)::bigint
      from public.school_lesson_records l
      cross join scope s
      where l.year_month > s.end_year_month
    )
  ),
  'lessonLinkage', jsonb_build_object(
    'actualByPlannedLink', (
      select coalesce(jsonb_agg(to_jsonb(rows) order by rows.actual_status, rows.planned_status nulls first), '[]'::jsonb)
      from (
        select actual.status as actual_status,
          case
            when actual.planned_lesson_id is null then 'no_planned_link'
            when planned.id is null then 'missing_planned_source'
            else 'linked'
          end as link_state,
          planned.status as planned_status,
          count(*)::bigint as row_count
        from scoped_lessons actual
        left join public.school_lesson_records planned
          on planned.id = actual.planned_lesson_id
         and planned.lesson_type = 'planned'
        where actual.lesson_type = 'actual'
        group by actual.status,
          case
            when actual.planned_lesson_id is null then 'no_planned_link'
            when planned.id is null then 'missing_planned_source'
            else 'linked'
          end,
          planned.status
      ) rows
    ),
    'plannedByActualLink', (
      select coalesce(jsonb_agg(to_jsonb(rows) order by rows.planned_status, rows.actual_status nulls first), '[]'::jsonb)
      from (
        select planned.status as planned_status,
          actual.status as actual_status,
          count(*)::bigint as row_count
        from scoped_lessons planned
        left join scoped_lessons actual
          on actual.planned_lesson_id = planned.id
         and actual.lesson_type = 'actual'
        where planned.lesson_type = 'planned'
        group by planned.status, actual.status
      ) rows
    )
  ),
  'referenceClosureCounts', (
    select coalesce(jsonb_object_agg(kind, row_count), '{}'::jsonb)
    from (
      select kind, count(*)::bigint as row_count
      from reference_closure
      group by kind
    ) closure_counts
  ),
  'integrityChecks', (
    select coalesce(jsonb_object_agg(check_name, issue_count), '{}'::jsonb)
    from integrity_checks
  )
) as core_teaching_aggregate_inventory;

rollback;
