\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_user_id uuid;
  v_account_id uuid;
  v_teacher_id uuid := gen_random_uuid();
  v_request_ids uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_mismatch_ids uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_result jsonb;
  v_count integer;
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
    'JPY', amount, v_account_id, date '2099-08-31', 'pending',
    'staging-e2e:teacher-wage-reject:' || request_id::text,
    jsonb_build_object('expense_category', 'teacher_wage',
      'teacher_id', v_teacher_id, 'teacher_name', 'STAGING-E2E-原子拒绝老师',
      'year_month', '2099-08'),
    'STAGING-E2E teacher wage group rejection', ''
  from unnest(v_request_ids, array[3000::numeric, 4000::numeric])
    as fixture(request_id, amount);

  v_result := public.home_reject_teacher_wage_request_group(
    v_request_ids, 'STAGING-E2E atomic rejection');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'idempotent')::boolean, true) is not false
    or (v_result ->> 'rejected_count')::integer <> 2 then
    raise exception 'Atomic group rejection failed: %', v_result;
  end if;

  select count(*) into v_count
  from public.home_external_transaction_requests
  where id = any(v_request_ids) and status = 'rejected'
    and rejected_reason = 'STAGING-E2E atomic rejection'
    and created_transaction_id is null;
  if v_count <> 2 then
    raise exception 'Atomic group rejection did not reject both requests.';
  end if;

  v_result := public.home_reject_teacher_wage_request_group(
    v_request_ids, 'STAGING-E2E atomic rejection');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'idempotent')::boolean, false) is not true then
    raise exception 'Atomic rejection retry was not idempotent: %', v_result;
  end if;

  insert into public.home_external_transaction_requests (
    id, user_id, external_source, external_event_id, external_reference_type,
    external_reference_id, request_type, transaction_type, currency, amount,
    account_id, transacted_at, status, idempotency_key, payload_snapshot,
    description, note
  )
  select request_id, v_user_id, 'aozora_school', gen_random_uuid(),
    'school_expense_records', gen_random_uuid(), 'expense_paid', 'expense',
    'JPY', 1000, v_account_id, transacted_at, 'pending',
    'staging-e2e:teacher-wage-reject-mismatch:' || request_id::text,
    jsonb_build_object('expense_category', 'teacher_wage',
      'teacher_id', v_teacher_id, 'teacher_name', 'STAGING-E2E-原子拒绝老师',
      'year_month', '2099-08'),
    'STAGING-E2E rejection mismatch', ''
  from unnest(v_mismatch_ids, array[date '2099-08-30', date '2099-08-31'])
    as fixture(request_id, transacted_at);

  v_result := public.home_reject_teacher_wage_request_group(
    v_mismatch_ids, 'must not write');
  if coalesce((v_result ->> 'ok')::boolean, true) is not false then
    raise exception 'Mismatched rejection group was not rejected: %', v_result;
  end if;

  select count(*) into v_count
  from public.home_external_transaction_requests
  where id = any(v_mismatch_ids) and status = 'pending';
  if v_count <> 2 then
    raise exception 'Mismatched rejection group caused a partial write.';
  end if;

  raise notice 'STAGING-E2E teacher wage atomic rejection: passed';
end;
$$;

rollback;
