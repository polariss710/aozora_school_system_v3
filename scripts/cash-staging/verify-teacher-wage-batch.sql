\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_user_id uuid;
  v_account_id uuid;
  v_teacher_id uuid := gen_random_uuid();
  v_request_ids uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_school_batch_id uuid := gen_random_uuid();
  v_result jsonb;
  v_batch_id uuid;
  v_transaction_id uuid;
  v_count integer;
  v_total numeric(14,2);
begin
  select user_id, id into v_user_id, v_account_id
  from public.home_accounts
  where name like 'STAGING Cash %'
    and currency = 'JPY' and is_active and allow_school_requests
  order by name limit 1;

  if v_user_id is null or v_account_id is null then
    raise exception 'No staging-eligible JPY Cash account exists.';
  end if;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.home_external_transaction_requests (
    id, user_id, external_source, external_event_id, external_reference_type,
    external_reference_id, request_type, transaction_type, currency, amount,
    account_id, transacted_at, status, idempotency_key, payload_snapshot,
    description, note
  )
  select request_id, v_user_id, 'aozora_school', gen_random_uuid(),
    'school_expense_records', gen_random_uuid(), 'expense_paid', 'expense',
    'JPY', amount, v_account_id, date '2099-09-30', 'pending',
    'staging-e2e:teacher-wage-batch:' || request_id::text,
    jsonb_build_object('expense_category', 'teacher_wage',
      'teacher_id', v_teacher_id, 'teacher_name', 'STAGING-E2E-聚合付款老师',
      'year_month', '2099-09'),
    'STAGING-E2E teacher wage aggregate payment', ''
  from unnest(v_request_ids, array[24600::numeric, 34500::numeric])
    as fixture(request_id, amount);

  v_result := public.home_approve_teacher_wage_request_batch(v_request_ids);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, false) is not true
    or (v_result ->> 'request_count')::integer <> 2
    or (v_result ->> 'total_amount')::numeric <> 59100 then
    raise exception 'Aggregate approval failed: %', v_result;
  end if;
  v_batch_id := (v_result ->> 'batch_id')::uuid;
  v_transaction_id := (v_result ->> 'created_transaction_id')::uuid;

  select count(*), sum(amount) into v_count, v_total
  from public.home_external_transaction_batch_items where batch_id = v_batch_id;
  if v_count <> 2 or v_total <> 59100 then
    raise exception 'Aggregate batch items do not match the expected total.';
  end if;

  select count(*) into v_count
  from public.home_jpy_transactions
  where id = v_transaction_id and transaction_type = 'expense'
    and amount = 59100 and external_reference_type = 'school_expense_batches'
    and external_reference_id = v_batch_id;
  if v_count <> 1 then
    raise exception 'Aggregate payment did not create exactly one JPY transaction.';
  end if;

  v_result := public.home_approve_teacher_wage_request_batch(v_request_ids);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, true) is not false
    or (v_result ->> 'batch_id')::uuid <> v_batch_id
    or (v_result ->> 'created_transaction_id')::uuid <> v_transaction_id then
    raise exception 'Aggregate approval retry was not idempotent: %', v_result;
  end if;

  v_result := public.home_mark_teacher_wage_batch_school_synced(
    v_batch_id, v_school_batch_id);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, false) is not true then
    raise exception 'School sync marker failed: %', v_result;
  end if;

  v_result := public.home_mark_teacher_wage_batch_school_synced(
    v_batch_id, v_school_batch_id);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, true) is not false then
    raise exception 'School sync marker retry was not idempotent: %', v_result;
  end if;

  v_result := public.home_mark_teacher_wage_batch_school_synced(
    v_batch_id, gen_random_uuid());
  if coalesce((v_result ->> 'ok')::boolean, true) is not false then
    raise exception 'Conflicting School batch identity was not rejected: %', v_result;
  end if;

  begin
    update public.home_jpy_transactions set note = note where id = v_transaction_id;
    raise exception 'Aggregate transaction update guard did not reject mutation.';
  exception when others then
    if sqlerrm <> '老师工资聚合 Cash 流水不可编辑或删除。' then raise; end if;
  end;
  begin
    delete from public.home_jpy_transactions where id = v_transaction_id;
    raise exception 'Aggregate transaction delete guard did not reject mutation.';
  exception when others then
    if sqlerrm <> '老师工资聚合 Cash 流水不可编辑或删除。' then raise; end if;
  end;

  raise notice 'STAGING-E2E teacher wage aggregate approval: passed';
end;
$$;

rollback;
