\set ON_ERROR_STOP on

-- Read-only V2 source contract for the future V3 ordinary-teaching rehearsal.
-- Invoke only with a dedicated School V2 read-only connection and explicit
-- psql variables: source_key, source_filename, source_query_sha256 and
-- aggregate_inventory_sha256. The single JSON result belongs outside this
-- repository in a private file. No target is contacted by this query.

begin transaction isolation level repeatable read read only;
set local statement_timeout = '90s';
set local lock_timeout = '5s';

with scope as (
  select '2026-07'::text as start_year_month, '2026-12'::text as end_year_month
), snapshot_context as (
  select transaction_timestamp() as captured_at
), scoped_lessons as (
  select l.* from public.school_lesson_records l cross join scope s
  where l.app_type = 'school' and l.year_month between s.start_year_month and s.end_year_month
), scoped_settlements as (
  select s.* from public.school_student_monthly_settlements s cross join scope b
  where s.year_month between b.start_year_month and b.end_year_month
), scoped_bills as (
  select b.* from public.school_student_tuition_bills b cross join scope s
  where b.app_type = 'school' and b.billing_month between s.start_year_month and s.end_year_month
), scoped_wage_locks as (
  select w.* from public.school_teacher_wage_locks w cross join scope s
  where w.settlement_month between s.start_year_month and s.end_year_month
), scoped_income as (
  select i.* from public.school_income_records i cross join scope s
  where i.app_type = 'school' and i.year_month between s.start_year_month and s.end_year_month
), scoped_expense as (
  select e.* from public.school_expense_records e cross join scope s
  where e.app_type = 'school' and e.year_month between s.start_year_month and s.end_year_month
), selected_planned_lessons as (
  select l.*, false as is_reference_closure
  from scoped_lessons l
  where l.lesson_type = 'planned'
  union
  select p.*, true as is_reference_closure
  from public.school_lesson_records p
  join scoped_lessons a on a.lesson_type = 'actual' and a.planned_lesson_id = p.id
  where p.lesson_type = 'planned'
    and p.app_type = 'school'
    and p.year_month < (select start_year_month from scope)
), omitted_settlements as (
  select distinct s.id, s.year_month
  from scoped_settlements s
  where exists (select 1 from public.school_student_settlement_adjustments a where a.settlement_id = s.id)
     or exists (
       select 1 from public.school_student_settlement_carryovers c
       where c.source_settlement_id = s.id or c.to_year_month = s.year_month
     )
), omitted_bills as (
  select b.*
  from scoped_bills b
  where exists (select 1 from omitted_settlements s where s.id = b.previous_settlement_id)
), omitted_wage_locks as (
  select w.id
  from scoped_wage_locks w
  where exists (select 1 from public.school_teacher_wage_lock_details d where d.lock_id = w.id)
     or exists (select 1 from public.school_teacher_wage_detail_adjustments a where a.wage_lock_id = w.id)
), omitted_expenses as (
  select e.id
  from scoped_expense e
  where exists (select 1 from public.school_expense_attachments a where a.expense_id = e.id)
     or exists (
       select 1 from omitted_wage_locks w
       where e.source_type = 'teacher_wage' and e.source_id = w.id
     )
), eligible_settlements as (
  select s.* from scoped_settlements s where not exists (select 1 from omitted_settlements o where o.id = s.id)
), eligible_bills as (
  select b.* from scoped_bills b where not exists (select 1 from omitted_bills o where o.id = b.id)
), eligible_income as (
  select i.* from scoped_income i
  where not exists (select 1 from omitted_bills b where b.income_record_id = i.id)
), eligible_expenses as (
  select e.* from scoped_expense e where not exists (select 1 from omitted_expenses o where o.id = e.id)
), reference_ids as (
  select business_entity_id as id, 'business_entities'::text as kind from selected_planned_lessons
  union select student_id, 'students' from selected_planned_lessons
  union select teacher_id, 'teachers' from selected_planned_lessons
  union select subject_id, 'subjects' from selected_planned_lessons
  union select business_entity_id, 'business_entities' from scoped_lessons where lesson_type = 'actual'
  union select student_id, 'students' from scoped_lessons where lesson_type = 'actual'
  union select teacher_id, 'teachers' from scoped_lessons where lesson_type = 'actual'
  union select subject_id, 'subjects' from scoped_lessons where lesson_type = 'actual'
  union select student_id, 'students' from eligible_settlements
  union select student_id, 'students' from eligible_bills
  union select business_entity_id, 'business_entities' from eligible_bills
  union select student_id, 'students' from eligible_income where student_id is not null
  union select business_entity_id, 'business_entities' from eligible_income where business_entity_id is not null
  union select teacher_id, 'teachers' from eligible_expenses where teacher_id is not null
  union select business_entity_id, 'business_entities' from eligible_expenses where business_entity_id is not null
), business_entities as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'legacyTable', 'school_business_entities', 'legacyId', b.id, 'sourceRow', to_jsonb(b)
  ) order by b.id), '[]'::jsonb) as rows
  from public.school_business_entities b join reference_ids r on r.kind = 'business_entities' and r.id = b.id
), students as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'legacyTable', 'school_students', 'legacyId', s.id, 'sourceRow', to_jsonb(s)
  ) order by s.id), '[]'::jsonb) as rows
  from public.school_students s join reference_ids r on r.kind = 'students' and r.id = s.id
), teachers as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'legacyTable', 'school_teachers', 'legacyId', t.id, 'sourceRow', to_jsonb(t)
  ) order by t.id), '[]'::jsonb) as rows
  from public.school_teachers t join reference_ids r on r.kind = 'teachers' and r.id = t.id
), subjects as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'legacyTable', 'school_subjects', 'legacyId', s.id, 'sourceRow', to_jsonb(s)
  ) order by s.id), '[]'::jsonb) as rows
  from public.school_subjects s join reference_ids r on r.kind = 'subjects' and r.id = s.id
), omission_candidates as (
  select coalesce(jsonb_agg(candidate order by candidate->>'sourceTable', candidate->>'sourceId', candidate->>'dependentFact'), '[]'::jsonb) as rows
  from (
    select jsonb_build_object(
      'sourceTable', 'school_student_monthly_settlements', 'sourceId', s.id,
      'dependentFact', 'studentSettlementAdjustments',
      'affectedFactKeys', coalesce((
        select jsonb_agg(key order by key) from (
          select 'school_student_monthly_settlements:' || s.id::text as key
          union select 'school_student_tuition_bills:' || b.id::text from omitted_bills b where b.previous_settlement_id = s.id
          union select 'school_income_records:' || i.id::text from scoped_income i join omitted_bills b on b.income_record_id = i.id where b.previous_settlement_id = s.id
        ) affected
      ), '[]'::jsonb)
    ) as candidate
    from omitted_settlements s
    where exists (select 1 from public.school_student_settlement_adjustments a where a.settlement_id = s.id)

    union all

    select jsonb_build_object(
      'sourceTable', 'school_student_monthly_settlements', 'sourceId', s.id,
      'dependentFact', 'studentSettlementCarryovers',
      'affectedFactKeys', coalesce((
        select jsonb_agg(key order by key) from (
          select 'school_student_monthly_settlements:' || s.id::text as key
          union select 'school_student_tuition_bills:' || b.id::text from omitted_bills b where b.previous_settlement_id = s.id
          union select 'school_income_records:' || i.id::text from scoped_income i join omitted_bills b on b.income_record_id = i.id where b.previous_settlement_id = s.id
        ) affected
      ), '[]'::jsonb)
    ) as candidate
    from omitted_settlements s
    where exists (
      select 1 from public.school_student_settlement_carryovers c
      where c.source_settlement_id = s.id or c.to_year_month = s.year_month
    )

    union all

    select jsonb_build_object(
      'sourceTable', 'school_teacher_wage_locks', 'sourceId', w.id,
      'dependentFact', 'teacherWageLockDetails',
      'affectedFactKeys', coalesce((
        select jsonb_agg(key order by key) from (
          select 'school_teacher_wage_locks:' || w.id::text as key
          union select 'school_expense_records:' || e.id::text from scoped_expense e where e.source_type = 'teacher_wage' and e.source_id = w.id
        ) affected
      ), '[]'::jsonb)
    ) as candidate
    from omitted_wage_locks w
    where exists (select 1 from public.school_teacher_wage_lock_details d where d.lock_id = w.id)

    union all

    select jsonb_build_object(
      'sourceTable', 'school_teacher_wage_locks', 'sourceId', w.id,
      'dependentFact', 'teacherWageDetailAdjustments',
      'affectedFactKeys', coalesce((
        select jsonb_agg(key order by key) from (
          select 'school_teacher_wage_locks:' || w.id::text as key
          union select 'school_expense_records:' || e.id::text from scoped_expense e where e.source_type = 'teacher_wage' and e.source_id = w.id
        ) affected
      ), '[]'::jsonb)
    ) as candidate
    from omitted_wage_locks w
    where exists (select 1 from public.school_teacher_wage_detail_adjustments a where a.wage_lock_id = w.id)

    union all

    select jsonb_build_object(
      'sourceTable', 'school_expense_records', 'sourceId', e.id,
      'dependentFact', 'expenseAttachments',
      'affectedFactKeys', jsonb_build_array('school_expense_records:' || e.id::text)
    ) as candidate
    from scoped_expense e
    where exists (select 1 from public.school_expense_attachments a where a.expense_id = e.id)

    union all

    select jsonb_build_object(
      'sourceTable', 'school_payment_requests', 'sourceId', p.id,
      'dependentFact', 'paymentRequestsAtOrAfterScope',
      'affectedFactKeys', jsonb_build_array('school_payment_requests:' || p.id::text)
    ) as candidate
    from public.school_payment_requests p cross join scope s
    where p.request_month between s.start_year_month and s.end_year_month
  ) candidates
), planned_lessons as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'yearMonth', l.year_month, 'businessEntityId', l.business_entity_id,
    'studentId', l.student_id, 'teacherId', l.teacher_id, 'subjectId', l.subject_id,
    'isReferenceClosure', l.is_reference_closure,
    'sourceRow', to_jsonb(l)
  ) order by l.id), '[]'::jsonb) as rows from selected_planned_lessons l
), actual_lessons as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'yearMonth', l.year_month, 'plannedLessonId', l.planned_lesson_id,
    'businessEntityId', l.business_entity_id, 'studentId', l.student_id,
    'teacherId', l.teacher_id, 'subjectId', l.subject_id, 'sourceRow', to_jsonb(l)
  ) order by l.id), '[]'::jsonb) as rows from scoped_lessons l where l.lesson_type = 'actual'
), student_settlements as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'yearMonth', s.year_month, 'studentId', s.student_id, 'sourceRow', to_jsonb(s)
  ) order by s.id), '[]'::jsonb) as rows from eligible_settlements s
), tuition_bills as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'billingMonth', b.billing_month, 'studentId', b.student_id,
    'incomeRecordId', b.income_record_id, 'sourceRow', to_jsonb(b)
  ) order by b.id), '[]'::jsonb) as rows from eligible_bills b
), incomes as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'yearMonth', i.year_month, 'studentId', i.student_id,
    'businessEntityId', i.business_entity_id, 'sourceRow', to_jsonb(i)
  ) order by i.id), '[]'::jsonb) as rows from eligible_income i
), expenses as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'yearMonth', e.year_month, 'teacherId', e.teacher_id,
    'businessEntityId', e.business_entity_id, 'sourceRow', to_jsonb(e)
  ) order by e.id), '[]'::jsonb) as rows from eligible_expenses e
)
select jsonb_build_object(
  'contractVersion', 'aozora-v2-core-teaching-snapshot-v1',
  'sourceKey', :'source_key',
  'sourceFilename', :'source_filename',
  'sourceSnapshot', jsonb_build_object(
    'sourceSystem', 'school_v2', 'capturedAt', (select captured_at from snapshot_context),
    'isolation', 'repeatable_read_read_only', 'containsBusinessRows', true,
    'scopeStartYearMonth', (select start_year_month from scope),
    'scopeEndYearMonth', (select end_year_month from scope),
    'sourceQuerySha256', :'source_query_sha256',
    'aggregateInventorySha256', :'aggregate_inventory_sha256'
  ),
  'referenceData', jsonb_build_object(
    'businessEntities', (select rows from business_entities), 'students', (select rows from students),
    'teachers', (select rows from teachers), 'subjects', (select rows from subjects)
  ),
  'facts', jsonb_build_object(
    'plannedLessons', (select rows from planned_lessons), 'actualLessons', (select rows from actual_lessons),
    'studentSettlements', (select rows from student_settlements), 'tuitionBills', (select rows from tuition_bills),
    'incomes', (select rows from incomes), 'expenses', (select rows from expenses)
  ),
  'omissionCandidates', (select rows from omission_candidates)
) as core_teaching_snapshot;

rollback;
