-- Staging-only cleanup for school-core-smoke.mjs. It refuses to delete active
-- settlements/snapshots or any batch that generated income/expense records.
begin;

create temporary table staging_core_target_ids (
  id text primary key
) on commit drop;

insert into staging_core_target_ids (id)
select id::text from public.students where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.teachers where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.subjects where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.teacher_wage_rules where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.student_planned_lessons where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.student_actual_lessons where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.student_monthly_settlements where memo like 'STAGING-E2E-CORE-%'
union
select id::text from public.teacher_wage_snapshots where memo like 'STAGING-E2E-CORE-%';

do $$
begin
  if exists (
    select 1
    from public.student_monthly_settlements
    where memo like 'STAGING-E2E-CORE-%'
      and status <> 'revoked'
  ) then
    raise exception 'Synthetic student settlement is not revoked.';
  end if;

  if exists (
    select 1
    from public.teacher_wage_snapshots
    where memo like 'STAGING-E2E-CORE-%'
      and (status <> 'revoked' or expense_record_id is not null)
  ) then
    raise exception 'Synthetic teacher wage snapshot is not safely revoked.';
  end if;

  if exists (
    select 1
    from public.income_records i
    join public.students s on s.id = i.student_id
    where s.memo like 'STAGING-E2E-CORE-%'
  ) or exists (
    select 1
    from public.expense_records e
    join public.teachers t on t.id = e.teacher_id
    where t.memo like 'STAGING-E2E-CORE-%'
  ) then
    raise exception 'Synthetic core batch generated income or expense records.';
  end if;
end
$$;

delete from public.audit_events
where target_id in (select id from staging_core_target_ids);

delete from public.teacher_wage_snapshot_details
where snapshot_id::text in (select id from staging_core_target_ids);

delete from public.teacher_wage_snapshots
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%'
  and status = 'revoked'
  and expense_record_id is null;

delete from public.student_monthly_settlements
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%'
  and status = 'revoked';

delete from public.student_actual_lessons
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%';

delete from public.student_planned_lessons
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%';

delete from public.teacher_wage_rules
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%';

delete from public.subjects
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%';

delete from public.students
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%';

delete from public.teachers
where id::text in (select id from staging_core_target_ids)
  and memo like 'STAGING-E2E-CORE-%';

do $$
begin
  if exists (
    select 1 from public.students where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.teachers where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.subjects where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.teacher_wage_rules where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.student_planned_lessons where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.student_actual_lessons where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.student_monthly_settlements where memo like 'STAGING-E2E-CORE-%'
    union all
    select 1 from public.teacher_wage_snapshots where memo like 'STAGING-E2E-CORE-%'
  ) then
    raise exception 'School core cleanup left residual rows.';
  end if;
end
$$;

commit;

select 0 as residual_rows;
