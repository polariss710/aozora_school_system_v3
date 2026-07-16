--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: home_approve_external_transaction_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_approve_external_transaction_request(p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_request public.home_external_transaction_requests%rowtype;
  v_transaction_result jsonb;
  v_transaction_id uuid;
begin
  if p_request_id is null then
    return jsonb_build_object('ok', false, 'message', 'request_id is required');
  end if;

  select *
  into v_request
  from public.home_external_transaction_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'external transaction request not found');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from v_request.user_id then
    return jsonb_build_object('ok', false, 'message', 'authenticated user does not match request owner');
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'only pending requests can be approved', 'status', v_request.status);
  end if;

  if v_request.currency = 'JPY' then
    select public.home_create_external_jpy_transaction(
      v_request.user_id,
      v_request.account_id,
      v_request.transaction_type,
      v_request.transacted_at,
      v_request.amount,
      v_request.description,
      v_request.note,
      v_request.external_source,
      v_request.external_event_id,
      v_request.request_type,
      v_request.idempotency_key,
      v_request.external_reference_type,
      v_request.external_reference_id,
      v_request.note,
      md5(v_request.payload_snapshot::text)
    )
    into v_transaction_result;
  elsif v_request.currency = 'CNY' then
    select public.home_create_external_cny_transaction(
      v_request.user_id,
      v_request.account_id,
      v_request.transaction_type,
      v_request.transacted_at,
      v_request.amount,
      v_request.description,
      v_request.note,
      v_request.external_source,
      v_request.external_event_id,
      v_request.request_type,
      v_request.idempotency_key,
      v_request.external_reference_type,
      v_request.external_reference_id,
      v_request.note,
      md5(v_request.payload_snapshot::text)
    )
    into v_transaction_result;
  else
    return jsonb_build_object('ok', false, 'message', 'unsupported request currency', 'currency', v_request.currency);
  end if;

  if coalesce((v_transaction_result->>'ok')::boolean, false) is not true then
    return v_transaction_result;
  end if;

  v_transaction_id := (v_transaction_result->>'transaction_id')::uuid;

  update public.home_external_transaction_requests
  set
    status = 'approved',
    approved_at = now(),
    created_transaction_id = v_transaction_id,
    updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'status', 'approved',
    'currency', v_request.currency,
    'transaction_id', v_transaction_id,
    'transaction_inserted', coalesce((v_transaction_result->>'inserted')::boolean, false),
    'message', 'external transaction request approved'
  );
end;
$$;


--
-- Name: home_assert_fixed_income_covers_paid_expense(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_assert_fixed_income_covers_paid_expense(p_month_key text, p_currency text DEFAULT 'JPY'::text) RETURNS void
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_actual_income numeric;
  v_actual_expense numeric;
begin
  with month_items as (
    select *
    from home_fixed_month_items
    where user_id = auth.uid()
      and month_key = p_month_key
      and currency = p_currency
  ),
  expense_rollup as (
    select home_round_up_1000(coalesce(sum(amount) filter (where status in ('paid', 'settled')), 0)) as paid
    from month_items
    where direction = 'expense'
    group by coalesce(payment_group, '未分组')
  )
  select
    coalesce(sum(amount) filter (where direction = 'income' and status in ('paid', 'settled')), 0),
    coalesce((select sum(paid) from expense_rollup), 0)
  into v_actual_income, v_actual_expense
  from month_items;

  if v_actual_income < v_actual_expense then
    raise exception '当前收入不足，请补充赤字后结算。当前已收 %，取整后已付支出 %。', v_actual_income, v_actual_expense;
  end if;
end;
$$;


--
-- Name: home_check_fixed_paid_balance(text, text, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_check_fixed_paid_balance(p_month_key text, p_currency text DEFAULT 'JPY'::text, p_target_item_id uuid DEFAULT NULL::uuid, p_target_status text DEFAULT NULL::text, p_bulk_direction text DEFAULT NULL::text, p_bulk_status text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_actual_income numeric := 0;
  v_actual_expense numeric := 0;
begin
  if p_target_status is not null and p_target_status not in ('unpaid', 'paid', 'settled') then
    return jsonb_build_object('ok', false, 'message', '固定项状态无效。');
  end if;

  if p_bulk_status is not null and p_bulk_status not in ('unpaid', 'paid', 'settled') then
    return jsonb_build_object('ok', false, 'message', '固定项状态无效。');
  end if;

  if p_bulk_direction is not null and p_bulk_direction not in ('income', 'expense') then
    return jsonb_build_object('ok', false, 'message', '固定项收支方向无效。');
  end if;

  with month_items as (
    select
      i.*,
      case
        when i.linked_jpy_transaction_id is not null then 'paid'
        when p_target_item_id is not null and i.id = p_target_item_id then p_target_status
        when p_bulk_direction is not null and i.direction = p_bulk_direction then p_bulk_status
        else i.status
      end as next_status
    from home_fixed_month_items i
    where i.user_id = auth.uid()
      and i.month_key = p_month_key
      and i.currency = p_currency
  ),
  paid_expense_groups as (
    select
      coalesce(payment_group, '未分组') as payment_group,
      home_round_up_1000(coalesce(sum(amount), 0)) as paid_amount
    from month_items
    where direction = 'expense'
      and next_status in ('paid', 'settled')
    group by coalesce(payment_group, '未分组')
  )
  select
    coalesce(sum(amount) filter (where direction = 'income' and next_status in ('paid', 'settled')), 0),
    coalesce((select sum(paid_amount) from paid_expense_groups), 0)
  into v_actual_income, v_actual_expense
  from month_items;

  if v_actual_income < v_actual_expense then
    return jsonb_build_object(
      'ok', false,
      'message', format('当前收入不足，请补充赤字后结算。当前已收 %s，取整后已付支出 %s。', v_actual_income, v_actual_expense),
      'actual_income', v_actual_income,
      'actual_expense', v_actual_expense
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', '收入足以覆盖已付固定支出。',
    'actual_income', v_actual_income,
    'actual_expense', v_actual_expense
  );
end;
$$;


--
-- Name: home_create_cny_to_jpy_fx(uuid, uuid, date, numeric, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_create_cny_to_jpy_fx(p_cny_account_id uuid, p_jpy_account_id uuid, p_transacted_at date, p_cny_amount numeric, p_jpy_amount numeric, p_description text, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_check jsonb;
  v_cny_transaction_id uuid;
  v_jpy_transaction_id uuid;
  v_description text := coalesce(nullif(trim(p_description), ''), '人民币购汇转日元');
begin
  if coalesce(p_cny_amount, 0) <= 0 or coalesce(p_jpy_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '购汇人民币金额和日元金额都必须大于 0。');
  end if;

  v_check := home_validate_fx_accounts(p_cny_account_id, p_jpy_account_id);
  if not coalesce((v_check ->> 'ok')::boolean, false) then
    return v_check;
  end if;

  insert into home_cny_transactions (
    user_id,
    transaction_type,
    account_id,
    transfer_account_id,
    currency,
    transacted_at,
    amount,
    description,
    note
  )
  values (
    auth.uid(),
    'fx_out',
    p_cny_account_id,
    null,
    'CNY',
    p_transacted_at,
    p_cny_amount,
    v_description,
    coalesce(p_note, '')
  )
  returning id into v_cny_transaction_id;

  insert into home_jpy_transactions (
    user_id,
    transaction_type,
    account_id,
    transfer_account_id,
    currency,
    transacted_at,
    amount,
    description,
    note,
    linked_cny_transaction_id
  )
  values (
    auth.uid(),
    'fx_in',
    p_jpy_account_id,
    null,
    'JPY',
    p_transacted_at,
    p_jpy_amount,
    v_description,
    coalesce(p_note, ''),
    v_cny_transaction_id
  )
  returning id into v_jpy_transaction_id;

  update home_cny_transactions
  set linked_jpy_transaction_id = v_jpy_transaction_id
  where id = v_cny_transaction_id
    and user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'message', '人民币购汇转日元已保存。',
    'cny_transaction_id', v_cny_transaction_id,
    'jpy_transaction_id', v_jpy_transaction_id
  );
end;
$$;


--
-- Name: home_create_external_cny_transaction(uuid, uuid, text, date, numeric, text, text, text, uuid, text, text, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_create_external_cny_transaction(p_user_id uuid, p_account_id uuid, p_transaction_type text, p_transacted_at date, p_amount numeric, p_description text, p_note text, p_external_source text, p_external_source_id uuid, p_external_event_type text, p_external_idempotency_key text, p_external_reference_type text, p_external_reference_id uuid, p_external_note text DEFAULT NULL::text, p_external_payload_hash text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_account public.home_accounts%rowtype;
  v_existing public.home_cny_transactions%rowtype;
  v_transaction_id uuid;
  v_transaction_type text := lower(trim(coalesce(p_transaction_type, '')));
  v_external_source text := lower(trim(coalesce(p_external_source, '')));
  v_external_event_type text := lower(trim(coalesce(p_external_event_type, '')));
  v_external_reference_type text := lower(trim(coalesce(p_external_reference_type, '')));
  v_external_idempotency_key text := nullif(trim(coalesce(p_external_idempotency_key, '')), '');
  v_description text := coalesce(nullif(trim(coalesce(p_description, '')), ''), '外部来源人民币流水');
  v_note text := coalesce(p_note, '');
  v_external_note text := nullif(trim(coalesce(p_external_note, '')), '');
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'user_id is required');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'message', 'authenticated user does not match target user');
  end if;

  if p_account_id is null then
    return jsonb_build_object('ok', false, 'message', 'account_id is required');
  end if;

  if p_transacted_at is null then
    return jsonb_build_object('ok', false, 'message', 'transacted_at is required');
  end if;

  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'amount must be greater than 0');
  end if;

  if v_external_source <> 'aozora_school' then
    return jsonb_build_object('ok', false, 'message', 'external_source must be aozora_school');
  end if;

  if p_external_source_id is null then
    return jsonb_build_object('ok', false, 'message', 'external_source_id is required');
  end if;

  if v_external_reference_type in (
    'school_payment_requests',
    'school_part_time_work_income_requests'
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'legacy business module direct Cash requests are deprecated; use school_income_records or school_expense_records'
    );
  end if;

  if v_external_reference_type not in ('school_income_records', 'school_expense_records') then
    return jsonb_build_object('ok', false, 'message', 'unsupported external_reference_type');
  end if;

  if p_external_reference_id is null then
    return jsonb_build_object('ok', false, 'message', 'external_reference_id is required');
  end if;

  if v_external_idempotency_key is null then
    return jsonb_build_object('ok', false, 'message', 'external_idempotency_key is required');
  end if;

  if v_external_event_type in (
    'teacher_wage_payment_confirm',
    'teacher_wage_payment_reverse',
    'part_time_work_income_received'
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'legacy business module direct Cash requests are deprecated; use school_income_records or school_expense_records'
    );
  end if;

  if v_external_event_type in ('tuition_income_received', 'income_received') then
    if v_external_reference_type <> 'school_income_records' or v_transaction_type <> 'income' then
      return jsonb_build_object('ok', false, 'message', 'income received requests must reference school_income_records and create income');
    end if;
  elsif v_external_event_type = 'expense_paid' then
    if v_external_reference_type <> 'school_expense_records' or v_transaction_type <> 'expense' then
      return jsonb_build_object('ok', false, 'message', 'expense_paid must reference school_expense_records and create expense');
    end if;
  else
    return jsonb_build_object('ok', false, 'message', 'unsupported external_event_type');
  end if;

  select *
  into v_account
  from public.home_accounts
  where id = p_account_id
    and user_id = p_user_id
    and currency = 'CNY'
    and is_active is true
    and allow_school_requests is true;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'school-eligible CNY account not found or inactive');
  end if;

  select *
  into v_existing
  from public.home_cny_transactions
  where created_by_external is true
    and external_idempotency_key = v_external_idempotency_key
  limit 1;

  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.account_id is distinct from p_account_id
      or v_existing.transaction_type is distinct from v_transaction_type
      or v_existing.transacted_at is distinct from p_transacted_at
      or v_existing.amount is distinct from p_amount
      or v_existing.external_source is distinct from v_external_source
      or v_existing.external_source_id is distinct from p_external_source_id
      or v_existing.external_event_type is distinct from v_external_event_type
      or v_existing.external_reference_type is distinct from v_external_reference_type
      or v_existing.external_reference_id is distinct from p_external_reference_id then
      return jsonb_build_object(
        'ok', false,
        'message', 'external idempotency key already exists with different payload',
        'transaction_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'inserted', false,
      'transaction_id', v_existing.id,
      'message', 'external CNY transaction already exists'
    );
  end if;

  select *
  into v_existing
  from public.home_cny_transactions
  where created_by_external is true
    and external_source = v_external_source
    and external_reference_type = v_external_reference_type
    and external_reference_id = p_external_reference_id
    and external_event_type = v_external_event_type
  limit 1;

  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.account_id is distinct from p_account_id
      or v_existing.transaction_type is distinct from v_transaction_type
      or v_existing.transacted_at is distinct from p_transacted_at
      or v_existing.amount is distinct from p_amount then
      return jsonb_build_object(
        'ok', false,
        'message', 'external source event already exists with different payload',
        'transaction_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'inserted', false,
      'transaction_id', v_existing.id,
      'message', 'external CNY transaction already exists'
    );
  end if;

  insert into public.home_cny_transactions (
    user_id,
    currency,
    transaction_type,
    account_id,
    transfer_account_id,
    transacted_at,
    amount,
    description,
    note,
    external_source,
    external_source_id,
    external_event_type,
    external_idempotency_key,
    external_reference_type,
    external_reference_id,
    external_note,
    external_payload_hash,
    external_created_at,
    created_by_external
  )
  values (
    p_user_id,
    'CNY',
    v_transaction_type,
    p_account_id,
    null,
    p_transacted_at,
    p_amount,
    v_description,
    v_note,
    v_external_source,
    p_external_source_id,
    v_external_event_type,
    v_external_idempotency_key,
    v_external_reference_type,
    p_external_reference_id,
    v_external_note,
    nullif(trim(coalesce(p_external_payload_hash, '')), ''),
    now(),
    true
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'inserted', true,
    'transaction_id', v_transaction_id,
    'message', 'external CNY transaction created'
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.home_cny_transactions
    where created_by_external is true
      and (
        external_idempotency_key = v_external_idempotency_key
        or (
          external_source = v_external_source
          and external_reference_type = v_external_reference_type
          and external_reference_id = p_external_reference_id
          and external_event_type = v_external_event_type
        )
      )
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'inserted', false,
        'transaction_id', v_existing.id,
        'message', 'external CNY transaction already exists'
      );
    end if;

    raise;
end;
$$;


--
-- Name: home_create_external_jpy_transaction(uuid, uuid, text, date, numeric, text, text, text, uuid, text, text, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_create_external_jpy_transaction(p_user_id uuid, p_account_id uuid, p_transaction_type text, p_transacted_at date, p_amount numeric, p_description text, p_note text, p_external_source text, p_external_source_id uuid, p_external_event_type text, p_external_idempotency_key text, p_external_reference_type text, p_external_reference_id uuid, p_external_note text DEFAULT NULL::text, p_external_payload_hash text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_account public.home_accounts%rowtype;
  v_existing public.home_jpy_transactions%rowtype;
  v_transaction_id uuid;
  v_transaction_type text := lower(trim(coalesce(p_transaction_type, '')));
  v_external_source text := lower(trim(coalesce(p_external_source, '')));
  v_external_event_type text := lower(trim(coalesce(p_external_event_type, '')));
  v_external_reference_type text := lower(trim(coalesce(p_external_reference_type, '')));
  v_external_idempotency_key text := nullif(trim(coalesce(p_external_idempotency_key, '')), '');
  v_description text := coalesce(nullif(trim(coalesce(p_description, '')), ''), '外部来源日元流水');
  v_note text := coalesce(p_note, '');
  v_external_note text := nullif(trim(coalesce(p_external_note, '')), '');
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'user_id is required');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'message', 'authenticated user does not match target user');
  end if;

  if p_account_id is null then
    return jsonb_build_object('ok', false, 'message', 'account_id is required');
  end if;

  if p_transacted_at is null then
    return jsonb_build_object('ok', false, 'message', 'transacted_at is required');
  end if;

  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'amount must be greater than 0');
  end if;

  if v_external_source <> 'aozora_school' then
    return jsonb_build_object('ok', false, 'message', 'external_source must be aozora_school');
  end if;

  if p_external_source_id is null then
    return jsonb_build_object('ok', false, 'message', 'external_source_id is required');
  end if;

  if v_external_reference_type in (
    'school_payment_requests',
    'school_part_time_work_income_requests'
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'legacy business module direct Cash requests are deprecated; use school_income_records or school_expense_records'
    );
  end if;

  if v_external_reference_type not in ('school_income_records', 'school_expense_records') then
    return jsonb_build_object('ok', false, 'message', 'unsupported external_reference_type');
  end if;

  if p_external_reference_id is null then
    return jsonb_build_object('ok', false, 'message', 'external_reference_id is required');
  end if;

  if v_external_idempotency_key is null then
    return jsonb_build_object('ok', false, 'message', 'external_idempotency_key is required');
  end if;

  if v_external_event_type in (
    'teacher_wage_payment_confirm',
    'teacher_wage_payment_reverse',
    'part_time_work_income_received'
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'legacy business module direct Cash requests are deprecated; use school_income_records or school_expense_records'
    );
  end if;

  if v_external_event_type in ('tuition_income_received', 'income_received') then
    if v_external_reference_type <> 'school_income_records' or v_transaction_type <> 'income' then
      return jsonb_build_object('ok', false, 'message', 'income received requests must reference school_income_records and create income');
    end if;
  elsif v_external_event_type = 'expense_paid' then
    if v_external_reference_type <> 'school_expense_records' or v_transaction_type <> 'expense' then
      return jsonb_build_object('ok', false, 'message', 'expense_paid must reference school_expense_records and create expense');
    end if;
  else
    return jsonb_build_object('ok', false, 'message', 'unsupported external_event_type');
  end if;

  select *
  into v_account
  from public.home_accounts
  where id = p_account_id
    and user_id = p_user_id
    and currency = 'JPY'
    and is_active is true
    and allow_school_requests is true;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'school-eligible JPY account not found or inactive');
  end if;

  select *
  into v_existing
  from public.home_jpy_transactions
  where created_by_external is true
    and external_idempotency_key = v_external_idempotency_key
  limit 1;

  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.account_id is distinct from p_account_id
      or v_existing.transaction_type is distinct from v_transaction_type
      or v_existing.transacted_at is distinct from p_transacted_at
      or v_existing.amount is distinct from p_amount
      or v_existing.external_source is distinct from v_external_source
      or v_existing.external_source_id is distinct from p_external_source_id
      or v_existing.external_event_type is distinct from v_external_event_type
      or v_existing.external_reference_type is distinct from v_external_reference_type
      or v_existing.external_reference_id is distinct from p_external_reference_id then
      return jsonb_build_object(
        'ok', false,
        'message', 'external idempotency key already exists with different payload',
        'transaction_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'inserted', false,
      'transaction_id', v_existing.id,
      'message', 'external JPY transaction already exists'
    );
  end if;

  select *
  into v_existing
  from public.home_jpy_transactions
  where created_by_external is true
    and external_source = v_external_source
    and external_reference_type = v_external_reference_type
    and external_reference_id = p_external_reference_id
    and external_event_type = v_external_event_type
  limit 1;

  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.account_id is distinct from p_account_id
      or v_existing.transaction_type is distinct from v_transaction_type
      or v_existing.transacted_at is distinct from p_transacted_at
      or v_existing.amount is distinct from p_amount then
      return jsonb_build_object(
        'ok', false,
        'message', 'external source event already exists with different payload',
        'transaction_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'inserted', false,
      'transaction_id', v_existing.id,
      'message', 'external JPY transaction already exists'
    );
  end if;

  insert into public.home_jpy_transactions (
    user_id,
    currency,
    transaction_type,
    account_id,
    transfer_account_id,
    transacted_at,
    amount,
    description,
    note,
    external_source,
    external_source_id,
    external_event_type,
    external_idempotency_key,
    external_reference_type,
    external_reference_id,
    external_note,
    external_payload_hash,
    external_created_at,
    created_by_external
  )
  values (
    p_user_id,
    'JPY',
    v_transaction_type,
    p_account_id,
    null,
    p_transacted_at,
    p_amount,
    v_description,
    v_note,
    v_external_source,
    p_external_source_id,
    v_external_event_type,
    v_external_idempotency_key,
    v_external_reference_type,
    p_external_reference_id,
    v_external_note,
    nullif(trim(coalesce(p_external_payload_hash, '')), ''),
    now(),
    true
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'ok', true,
    'inserted', true,
    'transaction_id', v_transaction_id,
    'message', 'external JPY transaction created'
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.home_jpy_transactions
    where created_by_external is true
      and (
        external_idempotency_key = v_external_idempotency_key
        or (
          external_source = v_external_source
          and external_reference_type = v_external_reference_type
          and external_reference_id = p_external_reference_id
          and external_event_type = v_external_event_type
        )
      )
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'inserted', false,
        'transaction_id', v_existing.id,
        'message', 'external JPY transaction already exists'
      );
    end if;

    raise;
end;
$$;


--
-- Name: home_create_external_transaction_request(uuid, uuid, text, uuid, text, uuid, text, text, date, numeric, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_create_external_transaction_request(p_user_id uuid, p_account_id uuid, p_external_source text, p_external_event_id uuid, p_external_reference_type text, p_external_reference_id uuid, p_request_type text, p_transaction_type text, p_transacted_at date, p_amount numeric, p_idempotency_key text, p_description text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_payload_snapshot jsonb DEFAULT '{}'::jsonb, p_currency text DEFAULT 'JPY'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_account public.home_accounts%rowtype;
  v_existing public.home_external_transaction_requests%rowtype;
  v_request_id uuid;
  v_external_source text := lower(trim(coalesce(p_external_source, '')));
  v_external_reference_type text := lower(trim(coalesce(p_external_reference_type, '')));
  v_request_type text := lower(trim(coalesce(p_request_type, '')));
  v_transaction_type text := lower(trim(coalesce(p_transaction_type, '')));
  v_currency text := upper(trim(coalesce(p_currency, 'JPY')));
  v_idempotency_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_description text := coalesce(nullif(trim(coalesce(p_description, '')), ''), '外部待确认请求');
  v_note text := coalesce(p_note, '');
  v_payload_snapshot jsonb;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'user_id is required');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'message', 'authenticated user does not match target user');
  end if;

  if p_account_id is null then
    return jsonb_build_object('ok', false, 'message', 'account_id is required');
  end if;

  if p_external_event_id is null then
    return jsonb_build_object('ok', false, 'message', 'external_event_id is required');
  end if;

  if p_external_reference_id is null then
    return jsonb_build_object('ok', false, 'message', 'external_reference_id is required');
  end if;

  if p_transacted_at is null then
    return jsonb_build_object('ok', false, 'message', 'transacted_at is required');
  end if;

  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', 'amount must be greater than 0');
  end if;

  if v_idempotency_key is null then
    return jsonb_build_object('ok', false, 'message', 'idempotency_key is required');
  end if;

  if v_currency not in ('JPY', 'CNY') then
    return jsonb_build_object('ok', false, 'message', 'currency must be JPY or CNY');
  end if;

  if v_external_source <> 'aozora_school' then
    return jsonb_build_object('ok', false, 'message', 'external_source must be aozora_school');
  end if;

  if v_external_reference_type in (
    'school_payment_requests',
    'school_part_time_work_income_requests'
  )
     or v_request_type in (
       'teacher_wage_payment_confirm',
       'teacher_wage_payment_reverse',
       'part_time_work_income_received'
     ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'legacy business module direct Cash requests are deprecated; use school_income_records or school_expense_records'
    );
  end if;

  if v_external_reference_type not in (
    'school_income_records',
    'school_expense_records'
  ) then
    return jsonb_build_object('ok', false, 'message', 'unsupported external_reference_type');
  end if;

  if v_request_type in ('tuition_income_received', 'income_received') then
    if v_external_reference_type <> 'school_income_records' or v_transaction_type <> 'income' then
      return jsonb_build_object('ok', false, 'message', 'income received requests must reference school_income_records and create income');
    end if;
  elsif v_request_type = 'expense_paid' then
    if v_external_reference_type <> 'school_expense_records' or v_transaction_type <> 'expense' then
      return jsonb_build_object('ok', false, 'message', 'expense_paid must reference school_expense_records and create expense');
    end if;
  else
    return jsonb_build_object('ok', false, 'message', 'unsupported request_type');
  end if;

  select *
  into v_account
  from public.home_accounts
  where id = p_account_id
    and user_id = p_user_id
    and currency = v_currency
    and is_active is true
    and allow_school_requests is true;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'school-eligible account not found, inactive, or currency mismatch');
  end if;

  v_payload_snapshot := case
    when p_payload_snapshot is null or p_payload_snapshot = '{}'::jsonb then
      jsonb_build_object(
        'external_source', v_external_source,
        'external_event_id', p_external_event_id,
        'external_reference_type', v_external_reference_type,
        'external_reference_id', p_external_reference_id,
        'request_type', v_request_type,
        'transaction_type', v_transaction_type,
        'currency', v_currency,
        'amount', p_amount,
        'account_id', p_account_id,
        'transacted_at', p_transacted_at,
        'description', v_description,
        'note', v_note
      )
    else p_payload_snapshot
  end;

  select *
  into v_existing
  from public.home_external_transaction_requests
  where idempotency_key = v_idempotency_key
  limit 1;

  if found then
    if v_existing.user_id is distinct from p_user_id
      or v_existing.account_id is distinct from p_account_id
      or v_existing.external_source is distinct from v_external_source
      or v_existing.external_event_id is distinct from p_external_event_id
      or v_existing.external_reference_type is distinct from v_external_reference_type
      or v_existing.external_reference_id is distinct from p_external_reference_id
      or v_existing.request_type is distinct from v_request_type
      or v_existing.transaction_type is distinct from v_transaction_type
      or v_existing.currency is distinct from v_currency
      or v_existing.amount is distinct from p_amount
      or v_existing.transacted_at is distinct from p_transacted_at then
      return jsonb_build_object(
        'ok', false,
        'message', 'external request idempotency key already exists with different payload',
        'request_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'inserted', false,
      'request_id', v_existing.id,
      'status', v_existing.status,
      'created_transaction_id', v_existing.created_transaction_id,
      'message', 'external transaction request already exists'
    );
  end if;

  select *
  into v_existing
  from public.home_external_transaction_requests
  where external_source = v_external_source
    and external_reference_type = v_external_reference_type
    and external_reference_id = p_external_reference_id
    and request_type = v_request_type
    and status in ('pending', 'approved')
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', false,
      'message', 'active or approved external transaction request already exists for this reference',
      'request_id', v_existing.id,
      'status', v_existing.status,
      'created_transaction_id', v_existing.created_transaction_id
    );
  end if;

  insert into public.home_external_transaction_requests (
    user_id,
    external_source,
    external_event_id,
    external_reference_type,
    external_reference_id,
    request_type,
    transaction_type,
    currency,
    amount,
    account_id,
    transacted_at,
    status,
    idempotency_key,
    payload_snapshot,
    description,
    note
  )
  values (
    p_user_id,
    v_external_source,
    p_external_event_id,
    v_external_reference_type,
    p_external_reference_id,
    v_request_type,
    v_transaction_type,
    v_currency,
    p_amount,
    p_account_id,
    p_transacted_at,
    'pending',
    v_idempotency_key,
    v_payload_snapshot,
    v_description,
    v_note
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'ok', true,
    'inserted', true,
    'request_id', v_request_id,
    'status', 'pending',
    'message', 'external transaction request created'
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.home_external_transaction_requests
    where idempotency_key = v_idempotency_key
       or (
         external_source = v_external_source
         and external_event_id = p_external_event_id
         and request_type = v_request_type
       )
       or (
         external_source = v_external_source
         and external_reference_type = v_external_reference_type
         and external_reference_id = p_external_reference_id
         and request_type = v_request_type
         and status in ('pending', 'approved')
       )
    limit 1;

    if found then
      if v_existing.user_id is distinct from p_user_id
        or v_existing.account_id is distinct from p_account_id
        or v_existing.external_source is distinct from v_external_source
        or v_existing.external_event_id is distinct from p_external_event_id
        or v_existing.external_reference_type is distinct from v_external_reference_type
        or v_existing.external_reference_id is distinct from p_external_reference_id
        or v_existing.request_type is distinct from v_request_type
        or v_existing.transaction_type is distinct from v_transaction_type
        or v_existing.currency is distinct from v_currency
        or v_existing.amount is distinct from p_amount
        or v_existing.transacted_at is distinct from p_transacted_at then
        return jsonb_build_object(
          'ok', false,
          'message', 'external transaction request already exists with different payload',
          'request_id', v_existing.id
        );
      end if;

      return jsonb_build_object(
        'ok', true,
        'inserted', false,
        'request_id', v_existing.id,
        'status', v_existing.status,
        'created_transaction_id', v_existing.created_transaction_id,
        'message', 'external transaction request already exists'
      );
    end if;

    raise;
end;
$$;


--
-- Name: home_create_fixed_transfer(text, text, text, uuid, date, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_create_fixed_transfer(p_month_key text, p_currency text, p_transaction_type text, p_account_id uuid, p_transacted_at date, p_amount numeric DEFAULT NULL::numeric, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_description text;
  v_direction text;
  v_payment_group text;
  v_jpy_transaction_id uuid := gen_random_uuid();
  v_fixed_item_id uuid := gen_random_uuid();
  v_status jsonb;
  v_amount numeric := 0;
begin
  if p_transaction_type not in ('fixed_in', 'fixed_out') then
    return jsonb_build_object('ok', false, 'message', '固定资金调拨类型无效。');
  end if;

  if not exists (
    select 1
    from home_accounts
    where id = p_account_id
      and user_id = auth.uid()
      and currency = p_currency
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '没有找到可使用的日元账户。');
  end if;

  if to_char(p_transacted_at, 'YYYY-MM') <> p_month_key then
    return jsonb_build_object('ok', false, 'message', '固定资金调拨日期必须在当前账期内。');
  end if;

  v_status := home_fixed_settlement_status(p_month_key, p_currency);
  v_amount := coalesce((v_status ->> 'transfer_amount')::numeric, 0);

  if p_transaction_type = 'fixed_out' and coalesce(v_status ->> 'state', '') <> 'deficit' then
    return jsonb_build_object('ok', false, 'message', '本月结算没有赤字，不需要补充。');
  end if;

  if p_transaction_type = 'fixed_in' and coalesce(v_status ->> 'state', '') <> 'surplus' then
    return jsonb_build_object('ok', false, 'message', '本月结算没有盈余，不能转入。');
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'message', '本月固定收支结算已平衡，不需要调拨。');
  end if;

  v_description := home_fixed_transfer_name(p_transaction_type);
  v_direction := home_fixed_transfer_direction(p_transaction_type);
  v_payment_group := case when p_transaction_type = 'fixed_in' then v_description else null end;

  if exists (
    select 1
    from home_fixed_month_items
    where user_id = auth.uid()
      and month_key = p_month_key
      and currency = p_currency
      and direction = v_direction
      and name = v_description
  ) then
    return jsonb_build_object('ok', false, 'message', format('本月已存在%s，请先删除后重新生成。', v_description));
  end if;

  insert into home_jpy_transactions (
    id,
    user_id,
    transaction_type,
    account_id,
    transfer_account_id,
    currency,
    transacted_at,
    amount,
    description,
    note,
    created_at
  )
  values (
    v_jpy_transaction_id,
    auth.uid(),
    p_transaction_type,
    p_account_id,
    null,
    p_currency,
    p_transacted_at,
    v_amount,
    v_description,
    coalesce(p_note, ''),
    now()
  );

  insert into home_fixed_month_items (
    id,
    user_id,
    template_id,
    month_key,
    currency,
    direction,
    name,
    amount,
    status,
    account_id,
    payment_group,
    due_date,
    term_no,
    total_terms,
    note,
    linked_jpy_transaction_id,
    created_at
  )
  values (
    v_fixed_item_id,
    auth.uid(),
    null,
    p_month_key,
    p_currency,
    v_direction,
    v_description,
    v_amount,
    'paid',
    p_account_id,
    v_payment_group,
    p_transacted_at,
    null,
    null,
    coalesce(p_note, ''),
    v_jpy_transaction_id,
    now()
  );

  update home_jpy_transactions
  set linked_fixed_month_item_id = v_fixed_item_id
  where id = v_jpy_transaction_id
    and user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'message', format('%s已生成，金额 %s。', v_description, v_amount),
    'amount', v_amount,
    'fixed_item_id', v_fixed_item_id,
    'jpy_transaction_id', v_jpy_transaction_id
  );
end;
$$;


--
-- Name: home_create_jpy_to_cny_fx(uuid, uuid, date, numeric, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_create_jpy_to_cny_fx(p_jpy_account_id uuid, p_cny_account_id uuid, p_transacted_at date, p_jpy_amount numeric, p_cny_amount numeric, p_description text, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_check jsonb;
  v_jpy_transaction_id uuid;
  v_cny_transaction_id uuid;
  v_description text := coalesce(nullif(trim(p_description), ''), '日元换人民币');
begin
  if coalesce(p_jpy_amount, 0) <= 0 or coalesce(p_cny_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '换汇日元金额和人民币到账金额都必须大于 0。');
  end if;

  v_check := home_validate_fx_accounts(p_cny_account_id, p_jpy_account_id);
  if not coalesce((v_check ->> 'ok')::boolean, false) then
    return v_check;
  end if;

  insert into home_jpy_transactions (
    user_id,
    transaction_type,
    account_id,
    transfer_account_id,
    currency,
    transacted_at,
    amount,
    description,
    note
  )
  values (
    auth.uid(),
    'fx_out',
    p_jpy_account_id,
    null,
    'JPY',
    p_transacted_at,
    p_jpy_amount,
    v_description,
    coalesce(p_note, '')
  )
  returning id into v_jpy_transaction_id;

  insert into home_cny_transactions (
    user_id,
    transaction_type,
    account_id,
    transfer_account_id,
    currency,
    transacted_at,
    amount,
    description,
    note,
    linked_jpy_transaction_id
  )
  values (
    auth.uid(),
    'fx_in',
    p_cny_account_id,
    null,
    'CNY',
    p_transacted_at,
    p_cny_amount,
    v_description,
    coalesce(p_note, ''),
    v_jpy_transaction_id
  )
  returning id into v_cny_transaction_id;

  update home_jpy_transactions
  set linked_cny_transaction_id = v_cny_transaction_id
  where id = v_jpy_transaction_id
    and user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'message', '日元换人民币已保存。',
    'jpy_transaction_id', v_jpy_transaction_id,
    'cny_transaction_id', v_cny_transaction_id
  );
end;
$$;


--
-- Name: home_delete_cny_fixed_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_delete_cny_fixed_item(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item home_fixed_month_items%rowtype;
begin
  select *
  into v_item
  from home_fixed_month_items
  where id = p_item_id
    and user_id = auth.uid()
    and currency = 'CNY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可删除的人民币固定项。');
  end if;

  if v_item.linked_cny_transaction_id is not null then
    delete from home_cny_transactions
    where id = v_item.linked_cny_transaction_id
      and user_id = auth.uid();
  end if;

  delete from home_fixed_month_items
  where id = v_item.id
    and user_id = auth.uid();

  return jsonb_build_object('ok', true, 'message', '人民币固定项及对应统一流水已删除。');
end;
$$;


--
-- Name: home_delete_cny_to_jpy_fx(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_delete_cny_to_jpy_fx(p_cny_transaction_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_cny_transaction home_cny_transactions%rowtype;
begin
  select *
  into v_cny_transaction
  from home_cny_transactions
  where id = p_cny_transaction_id
    and user_id = auth.uid()
    and currency = 'CNY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可删除的购汇记录。');
  end if;

  if v_cny_transaction.transaction_type <> 'fx_out' then
    return jsonb_build_object('ok', false, 'message', '这条人民币流水不是购汇记录。');
  end if;

  if v_cny_transaction.linked_jpy_transaction_id is not null then
    delete from home_jpy_transactions
    where id = v_cny_transaction.linked_jpy_transaction_id
      and user_id = auth.uid();
  end if;

  delete from home_cny_transactions
  where id = v_cny_transaction.id
    and user_id = auth.uid();

  return jsonb_build_object('ok', true, 'message', '人民币购汇转日元已删除。');
end;
$$;


--
-- Name: home_delete_cny_transaction(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_delete_cny_transaction(p_transaction_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_transaction home_cny_transactions%rowtype;
begin
  select *
  into v_transaction
  from home_cny_transactions
  where id = p_transaction_id
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可删除的人民币流水。');
  end if;

  if v_transaction.linked_fixed_month_item_id is not null then
    return jsonb_build_object('ok', false, 'message', '固定项生成的人民币流水请在固定收支中删除。');
  end if;

  if v_transaction.linked_jpy_transaction_id is not null then
    return home_delete_cny_to_jpy_fx(v_transaction.id);
  end if;

  delete from home_cny_transactions
  where id = v_transaction.id
    and user_id = auth.uid();

  return jsonb_build_object('ok', true, 'deleted_count', 1, 'message', '人民币流水已删除。');
end;
$$;


--
-- Name: home_delete_fixed_month_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_delete_fixed_month_item(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item home_fixed_month_items%rowtype;
  v_linked_jpy_transaction_id uuid;
  v_reset jsonb;
  v_linked_deleted boolean := false;
  v_message text := '已删除。';
  v_deleted_count integer := 0;
begin
  select *
  into v_item
  from home_fixed_month_items
  where id = p_item_id
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可删除的固定项。');
  end if;

  v_linked_jpy_transaction_id := home_resolve_fixed_transfer_jpy_id(v_item);

  if v_linked_jpy_transaction_id is not null then
    delete from home_jpy_transactions
    where id = v_linked_jpy_transaction_id
      and user_id = auth.uid();
    get diagnostics v_deleted_count = row_count;
    v_linked_deleted := v_deleted_count > 0;
    if not v_linked_deleted then
      v_message := '已删除固定项，但链接的日元流水不存在。';
    end if;
  elsif v_item.name in ('固定赤字补充', '固定盈余转入') and v_item.template_id is null then
    v_message := '已删除固定项，但旧数据链接不完整，未能唯一匹配日元流水。';
  end if;

  delete from home_fixed_month_items
  where id = v_item.id
    and user_id = auth.uid();

  v_reset := home_reset_plain_fixed_expenses_if_deficit(v_item.month_key, v_item.currency);

  return jsonb_build_object(
    'ok', true,
    'deleted_count', 1,
    'linked_deleted', v_linked_deleted,
    'reset_expense_status', coalesce((v_reset ->> 'reset_expense_status')::boolean, false),
    'message', case
      when v_linked_deleted and coalesce((v_reset ->> 'reset_expense_status')::boolean, false)
        then '已同步删除日元流水；删除后重新出现赤字，普通固定支出已改回未付。'
      when v_linked_deleted
        then '已同步删除日元流水。'
      when coalesce((v_reset ->> 'reset_expense_status')::boolean, false)
        then v_message || ' 删除后重新出现赤字，普通固定支出已改回未付。'
      else v_message
    end
  );
end;
$$;


--
-- Name: home_delete_jpy_to_cny_fx(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_delete_jpy_to_cny_fx(p_jpy_transaction_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_jpy_transaction home_jpy_transactions%rowtype;
begin
  select *
  into v_jpy_transaction
  from home_jpy_transactions
  where id = p_jpy_transaction_id
    and user_id = auth.uid()
    and currency = 'JPY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可删除的换汇记录。');
  end if;

  if v_jpy_transaction.transaction_type <> 'fx_out' then
    return jsonb_build_object('ok', false, 'message', '这条日元流水不是换汇转出记录。');
  end if;

  if v_jpy_transaction.linked_cny_transaction_id is not null then
    delete from home_cny_transactions
    where id = v_jpy_transaction.linked_cny_transaction_id
      and user_id = auth.uid();
  end if;

  delete from home_jpy_transactions
  where id = v_jpy_transaction.id
    and user_id = auth.uid();

  return jsonb_build_object('ok', true, 'message', '日元换人民币已删除。');
end;
$$;


--
-- Name: home_delete_jpy_transaction(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_delete_jpy_transaction(p_transaction_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_transaction home_jpy_transactions%rowtype;
  v_linked_fixed_month_item_id uuid;
  v_item home_fixed_month_items%rowtype;
  v_reset jsonb := jsonb_build_object('reset_expense_status', false);
  v_linked_deleted boolean := false;
  v_message text := '已删除。';
begin
  select *
  into v_transaction
  from home_jpy_transactions
  where id = p_transaction_id
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可删除的日元流水。');
  end if;

  v_linked_fixed_month_item_id := home_resolve_fixed_transfer_item_id(v_transaction);

  if v_linked_fixed_month_item_id is not null then
    select *
    into v_item
    from home_fixed_month_items
    where id = v_linked_fixed_month_item_id
      and user_id = auth.uid();

    if not found then
      return jsonb_build_object('ok', false, 'message', '调拨流水链接的固定项不存在，请检查旧数据后再删除。');
    end if;

    delete from home_fixed_month_items
    where id = v_linked_fixed_month_item_id
      and user_id = auth.uid();

    v_linked_deleted := true;
  elsif v_transaction.transaction_type in ('fixed_in', 'fixed_out') then
    v_message := '已删除日元流水，但旧数据链接不完整，未能唯一匹配固定项。';
  end if;

  delete from home_jpy_transactions
  where id = v_transaction.id
    and user_id = auth.uid();

  if v_linked_deleted then
    v_reset := home_reset_plain_fixed_expenses_if_deficit(v_item.month_key, v_item.currency);
  end if;

  return jsonb_build_object(
    'ok', true,
    'deleted_count', 1,
    'linked_deleted', v_linked_deleted,
    'reset_expense_status', coalesce((v_reset ->> 'reset_expense_status')::boolean, false),
    'message', case
      when v_linked_deleted and coalesce((v_reset ->> 'reset_expense_status')::boolean, false)
        then '已同步删除固定收支记录；删除后重新出现赤字，普通固定支出已改回未付。'
      when v_linked_deleted
        then '已同步删除固定收支记录。'
      else v_message
    end
  );
end;
$$;


--
-- Name: home_fixed_settlement_status(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_fixed_settlement_status(p_month_key text, p_currency text DEFAULT 'JPY'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_planned_income numeric := 0;
  v_planned_expense numeric := 0;
  v_actual_income numeric := 0;
  v_actual_expense numeric := 0;
  v_balance numeric := 0;
begin
  with month_items as (
    select
      i.*,
      case
        when i.linked_jpy_transaction_id is not null then 'paid'
        else i.status
      end as effective_status
    from home_fixed_month_items i
    where i.user_id = auth.uid()
      and i.month_key = p_month_key
      and i.currency = p_currency
  ),
  planned_expense_groups as (
    select
      coalesce(payment_group, '未分组') as payment_group,
      home_round_up_1000(coalesce(sum(amount), 0)) as planned_amount
    from month_items
    where direction = 'expense'
    group by coalesce(payment_group, '未分组')
  ),
  paid_expense_groups as (
    select
      coalesce(payment_group, '未分组') as payment_group,
      home_round_up_1000(coalesce(sum(amount), 0)) as paid_amount
    from month_items
    where direction = 'expense'
      and effective_status in ('paid', 'settled')
    group by coalesce(payment_group, '未分组')
  )
  select
    coalesce(sum(amount) filter (where direction = 'income'), 0),
    coalesce((select sum(planned_amount) from planned_expense_groups), 0),
    coalesce(sum(amount) filter (where direction = 'income' and effective_status in ('paid', 'settled')), 0),
    coalesce((select sum(paid_amount) from paid_expense_groups), 0)
  into v_planned_income, v_planned_expense, v_actual_income, v_actual_expense
  from month_items;

  v_balance := v_planned_income - v_planned_expense;

  return jsonb_build_object(
    'planned_income', v_planned_income,
    'planned_expense', v_planned_expense,
    'actual_income', v_actual_income,
    'actual_expense', v_actual_expense,
    'balance', v_balance,
    'state', case
      when v_balance < 0 then 'deficit'
      when v_balance > 0 then 'surplus'
      else 'balanced'
    end,
    'transaction_type', case
      when v_balance < 0 then 'fixed_out'
      when v_balance > 0 then 'fixed_in'
      else null
    end,
    'transfer_amount', abs(v_balance),
    'message', case
      when v_balance < 0 then format('结算赤字 %s。', abs(v_balance))
      when v_balance > 0 then format('结算盈余 %s。', v_balance)
      else '本月固定收支结算已平衡。'
    end
  );
end;
$$;


--
-- Name: home_fixed_transfer_direction(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_fixed_transfer_direction(p_transaction_type text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when p_transaction_type = 'fixed_out' then 'income'
    when p_transaction_type = 'fixed_in' then 'expense'
    else null
  end;
$$;


--
-- Name: home_fixed_transfer_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_fixed_transfer_name(p_transaction_type text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when p_transaction_type = 'fixed_out' then '固定赤字补充'
    when p_transaction_type = 'fixed_in' then '固定盈余转入'
    else null
  end;
$$;


--
-- Name: home_generate_fixed_month(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_generate_fixed_month(p_month_key text, p_currency text DEFAULT 'JPY'::text) RETURNS jsonb
    LANGUAGE sql
    AS $$
with eligible_templates as (
  select
    t.*,
    case
      when t.due_day is null then null
      else (
        to_date(p_month_key || '-01', 'YYYY-MM-DD')
        + (least(t.due_day, extract(day from (to_date(p_month_key || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day'))::integer) - 1) * interval '1 day'
      )::date
    end as generated_due_date,
    case
      when t.fixed_type = 'short_term' and t.start_month is not null then
        ((extract(year from to_date(p_month_key || '-01', 'YYYY-MM-DD'))::integer * 12 + extract(month from to_date(p_month_key || '-01', 'YYYY-MM-DD'))::integer)
        - (extract(year from to_date(t.start_month || '-01', 'YYYY-MM-DD'))::integer * 12 + extract(month from to_date(t.start_month || '-01', 'YYYY-MM-DD'))::integer)
        + 1)
      else null
    end as generated_term_no
  from home_fixed_templates t
  where t.user_id = auth.uid()
    and t.currency = p_currency
    and t.is_active
    and (t.start_month is null or t.start_month <= p_month_key)
    and (t.end_month is null or t.end_month >= p_month_key)
    and (
      t.fixed_type = 'long_term'
      or t.total_terms is null
      or t.start_month is null
      or (
        ((extract(year from to_date(p_month_key || '-01', 'YYYY-MM-DD'))::integer * 12 + extract(month from to_date(p_month_key || '-01', 'YYYY-MM-DD'))::integer)
        - (extract(year from to_date(t.start_month || '-01', 'YYYY-MM-DD'))::integer * 12 + extract(month from to_date(t.start_month || '-01', 'YYYY-MM-DD'))::integer)
        + 1) between 1 and t.total_terms
      )
    )
),
existing_items as (
  select i.template_id
  from eligible_templates t
  join home_fixed_month_items i
    on i.user_id = auth.uid()
   and i.month_key = p_month_key
   and i.currency = p_currency
   and i.template_id = t.id
),
inserted_items as (
  insert into home_fixed_month_items (
    user_id,
    template_id,
    month_key,
    currency,
    direction,
    name,
    amount,
    status,
    account_id,
    payment_group,
    due_date,
    term_no,
    total_terms,
    note
  )
  select
    t.user_id,
    t.id,
    p_month_key,
    t.currency,
    t.direction,
    t.name,
    t.default_amount,
    'unpaid',
    t.default_account_id,
    t.payment_group,
    t.generated_due_date,
    t.generated_term_no,
    t.total_terms,
    ''
  from eligible_templates t
  where not exists (
    select 1
    from existing_items i
    where i.template_id = t.id
  )
  on conflict do nothing
  returning id, template_id
)
select jsonb_build_object(
  'eligible_count', (select count(*) from eligible_templates),
  'existing_count', (select count(*) from existing_items),
  'inserted_count', (select count(*) from inserted_items),
  'all_generated', (
    (select count(*) from eligible_templates) > 0
    and (select count(*) from eligible_templates) = (select count(*) from existing_items)
  ),
  'eligible_templates', coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order, created_at, name)
    from eligible_templates
  ), '[]'::jsonb),
  'existing_template_ids', coalesce((
    select jsonb_agg(template_id)
    from existing_items
  ), '[]'::jsonb),
  'inserted_template_ids', coalesce((
    select jsonb_agg(template_id)
    from inserted_items
  ), '[]'::jsonb)
);
$$;


--
-- Name: home_get_cny_account_page(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_get_cny_account_page(p_month_key text) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
with month_range as (
  select
    to_date(p_month_key || '-01', 'YYYY-MM-DD') as month_start,
    (to_date(p_month_key || '-01', 'YYYY-MM-DD') + interval '1 month')::date as next_month
),
accounts as (
  select *
  from home_accounts
  where user_id = auth.uid()
    and currency = 'CNY'
    and is_active
),
movements as (
  select
    a.id as account_id,
    a.opening_balance as amount
  from accounts a
  union all
  select
    t.account_id,
    case
      when t.transaction_type in ('income', 'fx_in') then t.amount
      when t.transaction_type in ('expense', 'fx_out', 'transfer') then -t.amount
      else 0
    end as amount
  from home_cny_transactions t, month_range r
  where t.user_id = auth.uid()
    and t.currency = 'CNY'
    and t.transacted_at < r.next_month
  union all
  select
    t.transfer_account_id as account_id,
    t.amount
  from home_cny_transactions t, month_range r
  where t.user_id = auth.uid()
    and t.currency = 'CNY'
    and t.transaction_type = 'transfer'
    and t.transfer_account_id is not null
    and t.transacted_at < r.next_month
),
account_balances as (
  select
    a.id,
    a.user_id,
    a.currency,
    a.name,
    a.account_type,
    a.opening_balance,
    a.is_active,
    a.sort_order,
    a.created_at,
    coalesce(sum(m.amount), 0) as current_balance
  from accounts a
  left join movements m on m.account_id = a.id
  group by
    a.id,
    a.user_id,
    a.currency,
    a.name,
    a.account_type,
    a.opening_balance,
    a.is_active,
    a.sort_order,
    a.created_at
),
month_transactions as (
  select
    t.*,
    a.name as account_name,
    ta.name as transfer_account_name,
    jt.account_id as linked_jpy_account_id,
    ja.name as linked_jpy_account_name,
    jt.amount as linked_jpy_amount
  from home_cny_transactions t
  join home_accounts a on a.id = t.account_id
  left join home_accounts ta on ta.id = t.transfer_account_id
  left join home_jpy_transactions jt on jt.id = t.linked_jpy_transaction_id
    and jt.user_id = auth.uid()
  left join home_accounts ja on ja.id = jt.account_id
    and ja.user_id = auth.uid()
  cross join month_range r
  where t.user_id = auth.uid()
    and t.currency = 'CNY'
    and t.transacted_at >= r.month_start
    and t.transacted_at < r.next_month
)
select jsonb_build_object(
  'accounts', coalesce((
    select jsonb_agg(to_jsonb(account_balances) order by sort_order, created_at, name)
    from account_balances
  ), '[]'::jsonb),
  'transactions', coalesce((
    select jsonb_agg(
      to_jsonb(month_transactions)
      order by
        transacted_at desc,
        (linked_fixed_month_item_id is not null) desc,
        created_at desc
    )
    from month_transactions
  ), '[]'::jsonb)
);
$$;


--
-- Name: home_get_external_transaction_requests(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_get_external_transaction_requests(p_status text DEFAULT NULL::text, p_limit integer DEFAULT 100) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  with normalized as (
    select
      nullif(lower(trim(coalesce(p_status, ''))), '') as status_filter,
      greatest(1, least(coalesce(p_limit, 100), 200)) as row_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'external_source', r.external_source,
        'external_event_id', r.external_event_id,
        'external_reference_type', r.external_reference_type,
        'external_reference_id', r.external_reference_id,
        'request_type', r.request_type,
        'transaction_type', r.transaction_type,
        'currency', r.currency,
        'amount', r.amount,
        'account_id', r.account_id,
        'account_name', a.name,
        'transacted_at', r.transacted_at,
        'status', r.status,
        'requested_at', r.requested_at,
        'approved_at', r.approved_at,
        'rejected_at', r.rejected_at,
        'rejected_reason', r.rejected_reason,
        'created_transaction_id', r.created_transaction_id,
        'idempotency_key', r.idempotency_key,
        'description', r.description,
        'note', r.note,
        'payload_snapshot', r.payload_snapshot
      )
      order by
        case r.status when 'pending' then 0 when 'rejected' then 1 else 2 end,
        r.requested_at desc
    ),
    '[]'::jsonb
  )
  from normalized n
  join lateral (
    select *
    from public.home_external_transaction_requests
    where user_id = auth.uid()
      and (n.status_filter is null or status = n.status_filter)
    order by
      case status when 'pending' then 0 when 'rejected' then 1 else 2 end,
      requested_at desc
    limit n.row_limit
  ) r on true
  left join public.home_accounts a
    on a.id = r.account_id
   and a.user_id = auth.uid();
$$;


--
-- Name: home_get_fixed_month_page(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_get_fixed_month_page(p_month_key text, p_currency text DEFAULT 'JPY'::text) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
with month_items as (
  select *
  from home_fixed_month_items
  where user_id = auth.uid()
    and month_key = p_month_key
    and currency = p_currency
),
paid_expense_groups as (
  select
    coalesce(payment_group, '未分组') as payment_group,
    home_round_up_1000(coalesce(sum(amount), 0)) as paid_amount
  from month_items
  where direction = 'expense'
    and status in ('paid', 'settled')
  group by coalesce(payment_group, '未分组')
),
planned_expense_groups as (
  select
    coalesce(payment_group, '未分组') as payment_group,
    home_round_up_1000(coalesce(sum(amount), 0)) as planned_amount
  from month_items
  where direction = 'expense'
  group by coalesce(payment_group, '未分组')
),
unpaid_expense_groups as (
  select
    coalesce(payment_group, '未分组') as payment_group,
    home_round_up_1000(coalesce(sum(amount), 0)) as unpaid_amount
  from month_items
  where direction = 'expense'
    and status = 'unpaid'
  group by coalesce(payment_group, '未分组')
),
metrics as (
  select
    coalesce(sum(amount) filter (where direction = 'income'), 0) as planned_income,
    coalesce((select sum(planned_amount) from planned_expense_groups), 0) as planned_expense,
    coalesce(sum(amount) filter (where direction = 'income' and status in ('paid', 'settled')), 0) as actual_income,
    coalesce((select sum(paid_amount) from paid_expense_groups), 0) as actual_expense,
    coalesce(sum(amount) filter (where direction = 'income' and status = 'unpaid'), 0) as unreceived_income,
    coalesce((select sum(unpaid_amount) from unpaid_expense_groups), 0) as unpaid_expense
  from month_items
),
expense_groups as (
  select
    coalesce(payment_group, '未分组') as payment_group,
    home_round_up_1000(coalesce(sum(amount), 0)) as total,
    home_round_up_1000(coalesce(sum(amount) filter (where status in ('paid', 'settled')), 0)) as paid,
    home_round_up_1000(coalesce(sum(amount) filter (where status = 'unpaid'), 0)) as unpaid
  from month_items
  where direction = 'expense'
  group by coalesce(payment_group, '未分组')
),
expense_sections as (
  select
    coalesce(payment_group, '未分组') as payment_group,
    min(due_date) as first_due_date,
    home_round_up_1000(coalesce(sum(amount), 0)) as total,
    home_round_up_1000(coalesce(sum(amount) filter (where status in ('paid', 'settled')), 0)) as paid,
    home_round_up_1000(coalesce(sum(amount) filter (where status = 'unpaid'), 0)) as unpaid,
    jsonb_agg(to_jsonb(month_items) order by due_date, created_at, name) as items
  from month_items
  where direction = 'expense'
  group by coalesce(payment_group, '未分组')
)
select jsonb_build_object(
  'metrics', jsonb_build_object(
    'income', (select planned_income from metrics),
    'expense', (select planned_expense from metrics),
    'balance', (select planned_income - planned_expense from metrics),
    'planned_income', (select planned_income from metrics),
    'planned_expense', (select planned_expense from metrics),
    'planned_balance', (select planned_income - planned_expense from metrics),
    'actual_income', (select actual_income from metrics),
    'actual_expense', (select actual_expense from metrics),
    'actual_balance', (select actual_income - actual_expense from metrics),
    'unreceived_income', (select unreceived_income from metrics),
    'unpaid_expense', (select unpaid_expense from metrics)
  ),
  'fixed_settlement_status', home_fixed_settlement_status(p_month_key, p_currency),
  'expense_groups', coalesce((
    select jsonb_agg(to_jsonb(expense_groups) order by payment_group)
    from expense_groups
  ), '[]'::jsonb),
  'income_items', coalesce((
    select jsonb_agg(to_jsonb(month_items) order by created_at, name)
    from month_items
    where direction = 'income'
  ), '[]'::jsonb),
  'expense_items', coalesce((
    select jsonb_agg(to_jsonb(month_items) order by payment_group, due_date, created_at, name)
    from month_items
    where direction = 'expense'
  ), '[]'::jsonb),
  'expense_sections', coalesce((
    select jsonb_agg(to_jsonb(expense_sections) order by first_due_date nulls last, payment_group)
    from expense_sections
  ), '[]'::jsonb),
  'templates', coalesce((
    select jsonb_agg(to_jsonb(t) order by sort_order, created_at, name)
    from home_fixed_templates t
    where t.user_id = auth.uid()
      and t.currency = p_currency
      and t.is_active
  ), '[]'::jsonb),
  'stopped_templates', coalesce((
    select jsonb_agg(to_jsonb(t) order by sort_order, created_at, name)
    from home_fixed_templates t
    where t.user_id = auth.uid()
      and t.currency = p_currency
      and not t.is_active
  ), '[]'::jsonb),
  'accounts', coalesce((
    select jsonb_agg(to_jsonb(a) order by sort_order, created_at, name)
    from home_accounts a
    where a.user_id = auth.uid()
      and a.currency = p_currency
      and a.is_active
  ), '[]'::jsonb),
  'payment_channels', coalesce((
    select jsonb_agg(to_jsonb(c) order by sort_order, created_at, name)
    from home_payment_channels c
    where c.user_id = auth.uid()
      and c.currency = p_currency
      and c.is_active
  ), '[]'::jsonb)
);
$$;


--
-- Name: home_get_jpy_account_page(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_get_jpy_account_page(p_month_key text) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
with month_range as (
  select
    to_date(p_month_key || '-01', 'YYYY-MM-DD') as month_start,
    (to_date(p_month_key || '-01', 'YYYY-MM-DD') + interval '1 month')::date as next_month
),
accounts as (
  select *
  from home_accounts
  where user_id = auth.uid()
    and currency = 'JPY'
    and account_type in ('cash', 'bank')
    and is_active
),
movements as (
  select
    a.id as account_id,
    a.opening_balance as amount
  from accounts a
  union all
  select
    t.account_id,
    case
      when t.transaction_type in ('income', 'fx_in', 'fixed_in') then t.amount
      when t.transaction_type in ('expense', 'fx_out', 'fixed_out', 'transfer') then -t.amount
      else 0
    end as amount
  from home_jpy_transactions t, month_range r
  where t.user_id = auth.uid()
    and t.currency = 'JPY'
    and t.transacted_at < r.next_month
  union all
  select
    t.transfer_account_id as account_id,
    t.amount
  from home_jpy_transactions t, month_range r
  where t.user_id = auth.uid()
    and t.currency = 'JPY'
    and t.transaction_type = 'transfer'
    and t.transfer_account_id is not null
    and t.transacted_at < r.next_month
),
account_balances as (
  select
    a.id,
    a.user_id,
    a.currency,
    a.name,
    a.account_type,
    a.opening_balance,
    a.is_active,
    a.sort_order,
    a.created_at,
    coalesce(sum(m.amount), 0) as current_balance
  from accounts a
  left join movements m on m.account_id = a.id
  group by
    a.id,
    a.user_id,
    a.currency,
    a.name,
    a.account_type,
    a.opening_balance,
    a.is_active,
    a.sort_order,
    a.created_at
),
month_transactions as (
  select
    t.*,
    a.name as account_name,
    ta.name as transfer_account_name,
    ct.account_id as linked_cny_account_id,
    ca.name as linked_cny_account_name,
    ct.amount as linked_cny_amount
  from home_jpy_transactions t
  join home_accounts a on a.id = t.account_id
  left join home_accounts ta on ta.id = t.transfer_account_id
  left join home_cny_transactions ct on ct.id = t.linked_cny_transaction_id
    and ct.user_id = auth.uid()
  left join home_accounts ca on ca.id = ct.account_id
    and ca.user_id = auth.uid()
  cross join month_range r
  where t.user_id = auth.uid()
    and t.currency = 'JPY'
    and t.transacted_at >= r.month_start
    and t.transacted_at < r.next_month
)
select jsonb_build_object(
  'accounts', coalesce((
    select jsonb_agg(to_jsonb(account_balances) order by sort_order, created_at, name)
    from account_balances
  ), '[]'::jsonb),
  'transactions', coalesce((
    select jsonb_agg(to_jsonb(month_transactions) order by transacted_at desc, created_at desc)
    from month_transactions
  ), '[]'::jsonb)
);
$$;


--
-- Name: home_get_year_summary(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_get_year_summary(p_year integer) RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
with month_list as (
  select
    to_char(make_date(p_year, month_number, 1), 'YYYY-MM') as month_key,
    make_date(p_year, month_number, 1) as month_start,
    (make_date(p_year, month_number, 1) + interval '1 month')::date as next_month
  from generate_series(1, 12) as month_number
),
jpy_fixed_stats as (
  with ordinary_items as (
    select *
    from public.home_fixed_month_items
    where user_id = auth.uid()
      and currency = 'JPY'
      and linked_jpy_transaction_id is null
      and month_key >= p_year::text || '-01'
      and month_key <= p_year::text || '-12'
  ),
  expense_groups as (
    select
      month_key,
      coalesce(payment_group, '未分组') as payment_group,
      public.home_round_up_1000(coalesce(sum(amount), 0)) as payment_amount
    from ordinary_items
    where direction = 'expense'
    group by month_key, coalesce(payment_group, '未分组')
  ),
  expense_stats as (
    select
      month_key,
      coalesce(sum(payment_amount), 0) as expense
    from expense_groups
    group by month_key
  ),
  income_stats as (
    select
      month_key,
      coalesce(sum(amount), 0) as income
    from ordinary_items
    where direction = 'income'
    group by month_key
  )
  select
    coalesce(i.month_key, e.month_key) as month_key,
    coalesce(i.income, 0) as income,
    coalesce(e.expense, 0) as expense,
    coalesce(i.income, 0) - coalesce(e.expense, 0) as balance
  from income_stats i
  full join expense_stats e on e.month_key = i.month_key
),
jpy_casual_stats as (
  select
    to_char(t.transacted_at, 'YYYY-MM') as month_key,
    coalesce(sum(t.amount) filter (where t.transaction_type = 'income'), 0) as income,
    coalesce(sum(t.amount) filter (where t.transaction_type = 'expense'), 0) as expense,
    coalesce(sum(t.amount) filter (where t.transaction_type = 'income'), 0)
      - coalesce(sum(t.amount) filter (where t.transaction_type = 'expense'), 0) as balance
  from public.home_jpy_transactions t
  where t.user_id = auth.uid()
    and t.currency = 'JPY'
    and t.transaction_type in ('income', 'expense')
    and t.transacted_at >= make_date(p_year, 1, 1)
    and t.transacted_at < make_date(p_year + 1, 1, 1)
  group by to_char(t.transacted_at, 'YYYY-MM')
),
cny_fixed_stats as (
  select
    i.month_key,
    coalesce(sum(i.amount) filter (where i.direction = 'income'), 0) as income,
    coalesce(sum(i.amount) filter (where i.direction = 'expense'), 0) as expense,
    coalesce(sum(i.amount) filter (where i.direction = 'income'), 0)
      - coalesce(sum(i.amount) filter (where i.direction = 'expense'), 0) as balance
  from public.home_fixed_month_items i
  where i.user_id = auth.uid()
    and i.currency = 'CNY'
    and i.status in ('paid', 'settled')
    and i.month_key >= p_year::text || '-01'
    and i.month_key <= p_year::text || '-12'
  group by i.month_key
),
cny_transaction_stats as (
  select
    to_char(t.transacted_at, 'YYYY-MM') as month_key,
    coalesce(sum(t.amount) filter (where t.transaction_type = 'income'), 0) as income,
    coalesce(sum(t.amount) filter (where t.transaction_type = 'expense'), 0) as expense,
    coalesce(sum(t.amount) filter (where t.transaction_type = 'income'), 0)
      - coalesce(sum(t.amount) filter (where t.transaction_type = 'expense'), 0) as balance
  from public.home_cny_transactions t
  where t.user_id = auth.uid()
    and t.currency = 'CNY'
    and t.transaction_type in ('income', 'expense')
    and t.linked_fixed_month_item_id is null
    and t.transacted_at >= make_date(p_year, 1, 1)
    and t.transacted_at < make_date(p_year + 1, 1, 1)
  group by to_char(t.transacted_at, 'YYYY-MM')
),
cny_stats as (
  select
    m.month_key,
    coalesce(cf.income, 0) + coalesce(ct.income, 0) as income,
    coalesce(cf.expense, 0) + coalesce(ct.expense, 0) as expense,
    coalesce(cf.balance, 0) + coalesce(ct.balance, 0) as balance
  from month_list m
  left join cny_fixed_stats cf on cf.month_key = m.month_key
  left join cny_transaction_stats ct on ct.month_key = m.month_key
),
jpy_accounts as (
  select id, opening_balance
  from public.home_accounts
  where user_id = auth.uid()
    and currency = 'JPY'
    and is_active
),
cny_accounts as (
  select id, opening_balance
  from public.home_accounts
  where user_id = auth.uid()
    and currency = 'CNY'
    and is_active
),
jpy_account_month_balances as (
  select
    m.month_key,
    coalesce(sum(j.opening_balance), 0)
      + coalesce((
        select sum(
          case
            when t.transaction_type in ('income', 'fx_in', 'fixed_in') then t.amount
            when t.transaction_type in ('expense', 'fx_out', 'fixed_out', 'transfer') then -t.amount
            else 0
          end
        )
        from public.home_jpy_transactions t
        where t.user_id = auth.uid()
          and t.currency = 'JPY'
          and t.account_id in (select id from jpy_accounts)
          and t.transacted_at < m.next_month
      ), 0)
      + coalesce((
        select sum(t.amount)
        from public.home_jpy_transactions t
        where t.user_id = auth.uid()
          and t.currency = 'JPY'
          and t.transaction_type = 'transfer'
          and t.transfer_account_id in (select id from jpy_accounts)
          and t.transacted_at < m.next_month
      ), 0) as account_balance
  from month_list m
  cross join jpy_accounts j
  group by m.month_key, m.next_month
),
cny_account_month_balances as (
  select
    m.month_key,
    coalesce(sum(c.opening_balance), 0)
      + coalesce((
        select sum(
          case
            when t.transaction_type in ('income', 'fx_in') then t.amount
            when t.transaction_type in ('expense', 'fx_out', 'transfer') then -t.amount
            else 0
          end
        )
        from public.home_cny_transactions t
        where t.user_id = auth.uid()
          and t.currency = 'CNY'
          and t.account_id in (select id from cny_accounts)
          and t.transacted_at < m.next_month
      ), 0)
      + coalesce((
        select sum(t.amount)
        from public.home_cny_transactions t
        where t.user_id = auth.uid()
          and t.currency = 'CNY'
          and t.transaction_type = 'transfer'
          and t.transfer_account_id in (select id from cny_accounts)
          and t.transacted_at < m.next_month
      ), 0) as account_balance
  from month_list m
  cross join cny_accounts c
  group by m.month_key, m.next_month
),
month_stats as (
  select
    m.month_key,
    coalesce(jf.expense, 0) as jpy_fixed_amount,
    coalesce(jf.balance, 0) as jpy_fixed_balance,
    coalesce(jc.income, 0) as jpy_casual_income,
    coalesce(jc.expense, 0) as jpy_casual_expense,
    coalesce(jc.balance, 0) as jpy_casual_balance,
    coalesce(jab.account_balance, 0) as jpy_account_balance,
    coalesce(cs.income, 0) as cny_income,
    coalesce(cs.expense, 0) as cny_expense,
    coalesce(cs.balance, 0) as cny_balance,
    coalesce(cab.account_balance, 0) as cny_account_balance,
    coalesce(jf.income, 0) + coalesce(jc.income, 0) as jpy_income,
    coalesce(jf.expense, 0) + coalesce(jc.expense, 0) as jpy_expense,
    coalesce(jf.balance, 0) + coalesce(jc.balance, 0) as jpy_balance
  from month_list m
  left join jpy_fixed_stats jf on jf.month_key = m.month_key
  left join jpy_casual_stats jc on jc.month_key = m.month_key
  left join cny_stats cs on cs.month_key = m.month_key
  left join jpy_account_month_balances jab on jab.month_key = m.month_key
  left join cny_account_month_balances cab on cab.month_key = m.month_key
),
totals as (
  select
    coalesce(sum(jpy_income), 0) as jpy_income,
    coalesce(sum(jpy_expense), 0) as jpy_expense,
    coalesce(sum(jpy_balance), 0) as jpy_balance,
    coalesce(sum(cny_income), 0) as cny_income,
    coalesce(sum(cny_expense), 0) as cny_expense,
    coalesce(sum(cny_balance), 0) as cny_balance
  from month_stats
)
select jsonb_build_object(
  'year', p_year,
  'totals', jsonb_build_object(
    'jpy', jsonb_build_object(
      'income', totals.jpy_income,
      'expense', totals.jpy_expense,
      'balance', totals.jpy_balance
    ),
    'cny', jsonb_build_object(
      'income', totals.cny_income,
      'expense', totals.cny_expense,
      'balance', totals.cny_balance
    )
  ),
  'months', (
    select jsonb_agg(to_jsonb(month_stats) order by month_key)
    from month_stats
  )
)
from totals;
$$;


--
-- Name: home_list_school_eligible_cash_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_list_school_eligible_cash_accounts() RETURNS jsonb
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'currency', currency,
        'account_type', account_type,
        'is_active', is_active,
        'allow_school_requests', allow_school_requests
      )
      order by currency, sort_order, name
    ),
    '[]'::jsonb
  )
  from public.home_accounts
  where user_id = auth.uid()
    and is_active is true
    and allow_school_requests is true;
$$;


--
-- Name: home_reject_external_transaction_request(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_reject_external_transaction_request(p_request_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_request public.home_external_transaction_requests%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_request_id is null then
    return jsonb_build_object('ok', false, 'message', 'request_id is required');
  end if;

  select *
  into v_request
  from public.home_external_transaction_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'external transaction request not found');
  end if;

  if auth.uid() is not null and auth.uid() is distinct from v_request.user_id then
    return jsonb_build_object('ok', false, 'message', 'authenticated user does not match request owner');
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object('ok', false, 'message', 'only pending requests can be rejected', 'status', v_request.status);
  end if;

  update public.home_external_transaction_requests
  set
    status = 'rejected',
    rejected_at = now(),
    rejected_reason = v_reason,
    updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'status', 'rejected',
    'message', 'external transaction request rejected'
  );
end;
$$;


--
-- Name: home_reset_plain_fixed_expenses_if_deficit(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_reset_plain_fixed_expenses_if_deficit(p_month_key text, p_currency text DEFAULT 'JPY'::text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_check jsonb;
  v_updated_count integer := 0;
begin
  v_check := home_check_fixed_paid_balance(p_month_key, p_currency);

  if coalesce((v_check ->> 'ok')::boolean, false) then
    return jsonb_build_object(
      'reset_expense_status', false,
      'reset_count', 0,
      'message', '删除后固定收支仍满足已付结算条件。'
    );
  end if;

  update home_fixed_month_items
  set status = 'unpaid'
  where user_id = auth.uid()
    and month_key = p_month_key
    and currency = p_currency
    and direction = 'expense'
    and linked_jpy_transaction_id is null
    and status <> 'unpaid';

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object(
    'reset_expense_status', true,
    'reset_count', v_updated_count,
    'message', '删除后固定收支重新出现赤字，普通固定支出已改回未付。'
  );
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: home_jpy_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_jpy_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    currency text DEFAULT 'JPY'::text NOT NULL,
    transaction_type text NOT NULL,
    account_id uuid NOT NULL,
    transfer_account_id uuid,
    transacted_at date NOT NULL,
    amount numeric(14,2) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_fixed_month_item_id uuid,
    linked_cny_transaction_id uuid,
    external_source text,
    external_source_id uuid,
    external_event_type text,
    external_idempotency_key text,
    external_reference_type text,
    external_reference_id uuid,
    external_note text,
    external_payload_hash text,
    external_created_at timestamp with time zone,
    created_by_external boolean DEFAULT false NOT NULL,
    CONSTRAINT home_jpy_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT home_jpy_transactions_check CHECK ((((transaction_type = 'transfer'::text) AND (transfer_account_id IS NOT NULL) AND (transfer_account_id <> account_id)) OR ((transaction_type <> 'transfer'::text) AND (transfer_account_id IS NULL)))),
    CONSTRAINT home_jpy_transactions_currency_check CHECK ((currency = 'JPY'::text)),
    CONSTRAINT home_jpy_transactions_external_required_check CHECK (((created_by_external IS NOT TRUE) OR ((external_source = 'aozora_school'::text) AND (external_source_id IS NOT NULL) AND (external_idempotency_key IS NOT NULL) AND (external_reference_id IS NOT NULL) AND (currency = 'JPY'::text) AND (amount > (0)::numeric) AND (transfer_account_id IS NULL) AND (linked_fixed_month_item_id IS NULL) AND (linked_cny_transaction_id IS NULL) AND (((external_reference_type = 'school_income_records'::text) AND (external_event_type = ANY (ARRAY['tuition_income_received'::text, 'income_received'::text])) AND (transaction_type = 'income'::text)) OR ((external_reference_type = 'school_expense_records'::text) AND (external_event_type = 'expense_paid'::text) AND (transaction_type = 'expense'::text)))))),
    CONSTRAINT home_jpy_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text, 'fx_in'::text, 'fx_out'::text, 'fixed_in'::text, 'fixed_out'::text])))
);


--
-- Name: home_resolve_fixed_transfer_item_id(public.home_jpy_transactions); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_resolve_fixed_transfer_item_id(p_transaction public.home_jpy_transactions) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  v_direction text;
  v_name text;
  v_month_key text;
  v_candidate_id uuid;
  v_candidate_count integer;
begin
  if p_transaction.linked_fixed_month_item_id is not null then
    return p_transaction.linked_fixed_month_item_id;
  end if;

  v_direction := home_fixed_transfer_direction(p_transaction.transaction_type);
  v_name := home_fixed_transfer_name(p_transaction.transaction_type);
  v_month_key := to_char(p_transaction.transacted_at, 'YYYY-MM');

  if v_direction is null or v_name is null then
    return null;
  end if;

  select count(*), (array_agg(i.id))[1]
  into v_candidate_count, v_candidate_id
  from home_fixed_month_items i
  where i.user_id = auth.uid()
    and i.currency = p_transaction.currency
    and i.month_key = v_month_key
    and i.direction = v_direction
    and i.name = v_name
    and i.amount = p_transaction.amount
    and i.linked_jpy_transaction_id is null
    and (i.account_id is null or i.account_id = p_transaction.account_id);

  if v_candidate_count = 1 then
    update home_fixed_month_items
    set linked_jpy_transaction_id = p_transaction.id
    where id = v_candidate_id
      and user_id = auth.uid();

    update home_jpy_transactions
    set linked_fixed_month_item_id = v_candidate_id
    where id = p_transaction.id
      and user_id = auth.uid();

    return v_candidate_id;
  end if;

  return null;
end;
$$;


--
-- Name: home_fixed_month_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_fixed_month_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    template_id uuid,
    month_key text NOT NULL,
    currency text NOT NULL,
    direction text NOT NULL,
    name text NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'unpaid'::text NOT NULL,
    account_id uuid,
    payment_group text,
    due_date date,
    term_no integer,
    total_terms integer,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_jpy_transaction_id uuid,
    linked_cny_transaction_id uuid,
    CONSTRAINT home_fixed_month_items_currency_check CHECK ((currency = ANY (ARRAY['JPY'::text, 'CNY'::text]))),
    CONSTRAINT home_fixed_month_items_direction_check CHECK ((direction = ANY (ARRAY['income'::text, 'expense'::text]))),
    CONSTRAINT home_fixed_month_items_status_check CHECK ((status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'settled'::text])))
);


--
-- Name: home_resolve_fixed_transfer_jpy_id(public.home_fixed_month_items); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_resolve_fixed_transfer_jpy_id(p_item public.home_fixed_month_items) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  v_transaction_type text;
  v_candidate_id uuid;
  v_candidate_count integer;
begin
  if p_item.linked_jpy_transaction_id is not null then
    return p_item.linked_jpy_transaction_id;
  end if;

  v_transaction_type := case
    when p_item.name = '固定赤字补充' and p_item.direction = 'income' then 'fixed_out'
    when p_item.name = '固定盈余转入' and p_item.direction = 'expense' then 'fixed_in'
    else null
  end;

  if v_transaction_type is null then
    return null;
  end if;

  select count(*), (array_agg(t.id))[1]
  into v_candidate_count, v_candidate_id
  from home_jpy_transactions t
  where t.user_id = auth.uid()
    and t.currency = p_item.currency
    and t.transaction_type = v_transaction_type
    and t.description = p_item.name
    and t.amount = p_item.amount
    and t.linked_fixed_month_item_id is null
    and t.transacted_at >= to_date(p_item.month_key || '-01', 'YYYY-MM-DD')
    and t.transacted_at < (to_date(p_item.month_key || '-01', 'YYYY-MM-DD') + interval '1 month')::date
    and (p_item.account_id is null or t.account_id = p_item.account_id);

  if v_candidate_count = 1 then
    update home_fixed_month_items
    set linked_jpy_transaction_id = v_candidate_id
    where id = p_item.id
      and user_id = auth.uid();

    update home_jpy_transactions
    set linked_fixed_month_item_id = p_item.id
    where id = v_candidate_id
      and user_id = auth.uid();

    return v_candidate_id;
  end if;

  return null;
end;
$$;


--
-- Name: home_round_up_1000(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_round_up_1000(p_amount numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_amount, 0) <= 0 then 0
    else ceil(coalesce(p_amount, 0) / 1000) * 1000
  end;
$$;


--
-- Name: home_sync_fixed_month_items(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_sync_fixed_month_items(p_month_key text, p_currency text DEFAULT 'JPY'::text) RETURNS jsonb
    LANGUAGE sql
    AS $$
with month_context as (
  select
    extract(year from month_start)::int as year_no,
    extract(month from month_start)::int as month_no,
    extract(day from (month_start + interval '1 month - 1 day'))::int as days_in_month
  from (
    select to_date(p_month_key || '-01', 'YYYY-MM-DD') as month_start
  ) d
),
updated_items as (
  update home_fixed_month_items i
  set
    direction = t.direction,
    name = t.name,
    amount = t.default_amount,
    account_id = t.default_account_id,
    payment_group = t.payment_group,
    due_date = case
      when t.due_day is null then null
      else make_date(c.year_no, c.month_no, least(t.due_day, c.days_in_month))
    end,
    term_no = case
      when t.fixed_type = 'short_term' and t.start_month is not null and t.total_terms is not null then
        (
          (substring(p_month_key, 1, 4)::int - substring(t.start_month, 1, 4)::int) * 12
          + (substring(p_month_key, 6, 2)::int - substring(t.start_month, 6, 2)::int)
          + 1
        )
      else null
    end,
    total_terms = case
      when t.fixed_type = 'short_term' then t.total_terms
      else null
    end
  from home_fixed_templates t
  cross join month_context c
  where i.template_id = t.id
    and i.user_id = auth.uid()
    and t.user_id = auth.uid()
    and i.month_key = p_month_key
    and i.currency = p_currency
    and t.currency = p_currency
  returning i.id
)
select jsonb_build_object(
  'updated_count', (select count(*) from updated_items)
);
$$;


--
-- Name: home_update_cny_fixed_item(uuid, numeric, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_cny_fixed_item(p_item_id uuid, p_amount numeric, p_account_id uuid, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item home_fixed_month_items%rowtype;
  v_sync jsonb;
begin
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '人民币固定项金额必须大于 0。');
  end if;

  select *
  into v_item
  from home_fixed_month_items
  where id = p_item_id
    and user_id = auth.uid()
    and currency = 'CNY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的人民币固定项。');
  end if;

  if p_account_id is not null and not exists (
    select 1
    from home_accounts
    where id = p_account_id
      and user_id = auth.uid()
      and currency = 'CNY'
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '人民币固定项账户无效或已停用。');
  end if;

  if v_item.status in ('paid', 'settled') and p_account_id is null then
    return jsonb_build_object('ok', false, 'message', '已结算的人民币固定项需要保留有效账户。');
  end if;

  update home_fixed_month_items
  set
    amount = p_amount,
    account_id = p_account_id,
    note = coalesce(p_note, '')
  where id = v_item.id
    and user_id = auth.uid();

  v_sync := home_upsert_cny_fixed_transaction(v_item.id);
  if not coalesce((v_sync ->> 'ok')::boolean, false) then
    return v_sync;
  end if;

  return jsonb_build_object('ok', true, 'message', '人民币固定项已更新。');
end;
$$;


--
-- Name: home_update_cny_fixed_item_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_cny_fixed_item_status(p_item_id uuid, p_status text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item home_fixed_month_items%rowtype;
  v_sync jsonb;
begin
  if p_status not in ('unpaid', 'paid', 'settled') then
    return jsonb_build_object('ok', false, 'message', '人民币固定项状态无效。');
  end if;

  select *
  into v_item
  from home_fixed_month_items
  where id = p_item_id
    and user_id = auth.uid()
    and currency = 'CNY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的人民币固定项。');
  end if;

  if p_status = 'unpaid' then
    if v_item.linked_cny_transaction_id is not null then
      delete from home_cny_transactions
      where id = v_item.linked_cny_transaction_id
        and user_id = auth.uid();
    end if;

    update home_fixed_month_items
    set
      status = 'unpaid',
      linked_cny_transaction_id = null
    where id = v_item.id
      and user_id = auth.uid();

    return jsonb_build_object('ok', true, 'message', '人民币固定项已改为未付，并已撤销统一流水。');
  end if;

  if v_item.account_id is null then
    return jsonb_build_object('ok', false, 'message', '人民币固定项需要先选择账户，才能改为已付或已结清。');
  end if;

  if not exists (
    select 1
    from home_accounts
    where id = v_item.account_id
      and user_id = auth.uid()
      and currency = 'CNY'
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '人民币固定项账户无效或已停用。');
  end if;

  update home_fixed_month_items
  set status = p_status
  where id = v_item.id
    and user_id = auth.uid();

  v_sync := home_upsert_cny_fixed_transaction(v_item.id);
  if not coalesce((v_sync ->> 'ok')::boolean, false) then
    return v_sync;
  end if;

  return jsonb_build_object('ok', true, 'message', '人民币固定项已结算并同步到统一流水。');
end;
$$;


--
-- Name: home_update_cny_fixed_items_status(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_cny_fixed_items_status(p_month_key text, p_direction text, p_status text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item record;
  v_result jsonb;
  v_updated_count integer := 0;
  v_invalid_count integer := 0;
begin
  if p_direction not in ('income', 'expense') then
    return jsonb_build_object('ok', false, 'message', '人民币固定项收支方向无效。');
  end if;

  if p_status not in ('unpaid', 'paid', 'settled') then
    return jsonb_build_object('ok', false, 'message', '人民币固定项状态无效。');
  end if;

  if p_status in ('paid', 'settled') then
    select count(*)
    into v_invalid_count
    from home_fixed_month_items i
    left join home_accounts a on a.id = i.account_id
      and a.user_id = auth.uid()
      and a.currency = 'CNY'
      and a.is_active
    where i.user_id = auth.uid()
      and i.month_key = p_month_key
      and i.currency = 'CNY'
      and i.direction = p_direction
      and a.id is null;

    if v_invalid_count > 0 then
      return jsonb_build_object(
        'ok', false,
        'message', '存在未选择有效账户的人民币固定项，不能一键结算。',
        'invalid_count', v_invalid_count
      );
    end if;
  end if;

  for v_item in
    select id, name
    from home_fixed_month_items
    where user_id = auth.uid()
      and month_key = p_month_key
      and currency = 'CNY'
      and direction = p_direction
    order by due_date nulls last, created_at, name
  loop
    v_result := home_update_cny_fixed_item_status(v_item.id, p_status);
    if not coalesce((v_result ->> 'ok')::boolean, false) then
      return jsonb_build_object(
        'ok', false,
        'message', coalesce(v_result ->> 'message', '人民币固定项批量状态更新失败。'),
        'failed_item', v_item.name,
        'updated_count', v_updated_count
      );
    end if;

    v_updated_count := v_updated_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'message', '人民币固定项状态已批量更新。',
    'updated_count', v_updated_count
  );
end;
$$;


--
-- Name: home_update_cny_to_jpy_fx(uuid, uuid, uuid, date, numeric, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_cny_to_jpy_fx(p_cny_transaction_id uuid, p_cny_account_id uuid, p_jpy_account_id uuid, p_transacted_at date, p_cny_amount numeric, p_jpy_amount numeric, p_description text, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_cny_transaction home_cny_transactions%rowtype;
  v_check jsonb;
  v_jpy_transaction_id uuid;
  v_description text := coalesce(nullif(trim(p_description), ''), '人民币购汇转日元');
begin
  if coalesce(p_cny_amount, 0) <= 0 or coalesce(p_jpy_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '购汇人民币金额和日元金额都必须大于 0。');
  end if;

  select *
  into v_cny_transaction
  from home_cny_transactions
  where id = p_cny_transaction_id
    and user_id = auth.uid()
    and currency = 'CNY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的购汇记录。');
  end if;

  if v_cny_transaction.transaction_type <> 'fx_out' then
    return jsonb_build_object('ok', false, 'message', '这条人民币流水不是购汇记录。');
  end if;

  if v_cny_transaction.linked_jpy_transaction_id is null then
    return jsonb_build_object('ok', false, 'message', '购汇记录缺少对应日元入金流水。');
  end if;

  v_check := home_validate_fx_accounts(p_cny_account_id, p_jpy_account_id);
  if not coalesce((v_check ->> 'ok')::boolean, false) then
    return v_check;
  end if;

  update home_cny_transactions
  set
    account_id = p_cny_account_id,
    transfer_account_id = null,
    transacted_at = p_transacted_at,
    amount = p_cny_amount,
    description = v_description,
    note = coalesce(p_note, '')
  where id = v_cny_transaction.id
    and user_id = auth.uid();

  update home_jpy_transactions
  set
    account_id = p_jpy_account_id,
    transfer_account_id = null,
    transacted_at = p_transacted_at,
    amount = p_jpy_amount,
    description = v_description,
    note = coalesce(p_note, ''),
    linked_cny_transaction_id = v_cny_transaction.id
  where id = v_cny_transaction.linked_jpy_transaction_id
    and user_id = auth.uid()
    and currency = 'JPY'
  returning id into v_jpy_transaction_id;

  if v_jpy_transaction_id is null then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的日元入金流水。');
  end if;

  return jsonb_build_object('ok', true, 'message', '人民币购汇转日元已更新。');
end;
$$;


--
-- Name: home_update_cny_transaction(uuid, uuid, uuid, date, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_cny_transaction(p_transaction_id uuid, p_account_id uuid, p_transfer_account_id uuid, p_transacted_at date, p_amount numeric, p_description text, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_transaction home_cny_transactions%rowtype;
begin
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '流水金额必须大于 0。');
  end if;

  select *
  into v_transaction
  from home_cny_transactions
  where id = p_transaction_id
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的人民币流水。');
  end if;

  if v_transaction.linked_fixed_month_item_id is not null then
    return jsonb_build_object('ok', false, 'message', '固定项生成的人民币流水请在固定收支中修改。');
  end if;

  if v_transaction.linked_jpy_transaction_id is not null then
    return jsonb_build_object('ok', false, 'message', '购汇联动流水请使用购汇编辑。');
  end if;

  if not exists (
    select 1
    from home_accounts
    where id = p_account_id
      and user_id = auth.uid()
      and currency = 'CNY'
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '人民币账户无效或已停用。');
  end if;

  if v_transaction.transaction_type = 'transfer' and (
    p_transfer_account_id is null
    or p_transfer_account_id = p_account_id
    or not exists (
      select 1
      from home_accounts
      where id = p_transfer_account_id
        and user_id = auth.uid()
        and currency = 'CNY'
        and is_active
    )
  ) then
    return jsonb_build_object('ok', false, 'message', '账户间转账需要选择有效且不同的转入账户。');
  end if;

  update home_cny_transactions
  set
    account_id = p_account_id,
    transfer_account_id = case when v_transaction.transaction_type = 'transfer' then p_transfer_account_id else null end,
    transacted_at = p_transacted_at,
    amount = p_amount,
    description = coalesce(p_description, ''),
    note = coalesce(p_note, '')
  where id = v_transaction.id
    and user_id = auth.uid();

  return jsonb_build_object('ok', true, 'updated_count', 1, 'message', '人民币流水已更新。');
end;
$$;


--
-- Name: home_update_fixed_month_item_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_fixed_month_item_status(p_item_id uuid, p_status text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item home_fixed_month_items%rowtype;
  v_check jsonb;
begin
  if p_status not in ('unpaid', 'paid', 'settled') then
    return jsonb_build_object('ok', false, 'message', '固定项状态无效。');
  end if;

  select *
  into v_item
  from home_fixed_month_items
  where id = p_item_id
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的固定项。');
  end if;

  if v_item.linked_jpy_transaction_id is not null then
    return jsonb_build_object('ok', false, 'message', '调拨记录状态固定为已付。');
  end if;

  if v_item.direction = 'expense' and p_status in ('paid', 'settled') then
    v_check := home_check_fixed_paid_balance(v_item.month_key, v_item.currency, p_item_id, p_status);
    if not coalesce((v_check ->> 'ok')::boolean, false) then
      return v_check;
    end if;
  end if;

  update home_fixed_month_items
  set status = p_status
  where id = p_item_id
    and user_id = auth.uid()
    and linked_jpy_transaction_id is null;

  return jsonb_build_object('ok', true, 'message', '固定项状态已更新。', 'updated_count', 1);
end;
$$;


--
-- Name: home_update_fixed_month_items_status(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_fixed_month_items_status(p_month_key text, p_currency text, p_direction text, p_status text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_updated_count integer := 0;
  v_check jsonb;
begin
  if p_direction not in ('income', 'expense') then
    return jsonb_build_object('ok', false, 'message', '固定项收支方向无效。');
  end if;

  if p_status not in ('unpaid', 'paid', 'settled') then
    return jsonb_build_object('ok', false, 'message', '固定项状态无效。');
  end if;

  if p_direction = 'expense' and p_status in ('paid', 'settled') then
    v_check := home_check_fixed_paid_balance(p_month_key, p_currency, null, null, p_direction, p_status);
    if not coalesce((v_check ->> 'ok')::boolean, false) then
      return v_check;
    end if;
  end if;

  update home_fixed_month_items
  set status = p_status
  where user_id = auth.uid()
    and month_key = p_month_key
    and currency = p_currency
    and direction = p_direction
    and linked_jpy_transaction_id is null;

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object('ok', true, 'message', '固定项状态已批量更新。', 'updated_count', v_updated_count);
end;
$$;


--
-- Name: home_update_jpy_to_cny_fx(uuid, uuid, uuid, date, numeric, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_jpy_to_cny_fx(p_jpy_transaction_id uuid, p_jpy_account_id uuid, p_cny_account_id uuid, p_transacted_at date, p_jpy_amount numeric, p_cny_amount numeric, p_description text, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_jpy_transaction home_jpy_transactions%rowtype;
  v_check jsonb;
  v_cny_transaction_id uuid;
  v_description text := coalesce(nullif(trim(p_description), ''), '日元换人民币');
begin
  if coalesce(p_jpy_amount, 0) <= 0 or coalesce(p_cny_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '换汇日元金额和人民币到账金额都必须大于 0。');
  end if;

  select *
  into v_jpy_transaction
  from home_jpy_transactions
  where id = p_jpy_transaction_id
    and user_id = auth.uid()
    and currency = 'JPY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的换汇记录。');
  end if;

  if v_jpy_transaction.transaction_type <> 'fx_out' then
    return jsonb_build_object('ok', false, 'message', '这条日元流水不是换汇转出记录。');
  end if;

  if v_jpy_transaction.linked_cny_transaction_id is null then
    return jsonb_build_object('ok', false, 'message', '换汇记录缺少对应人民币入金流水。');
  end if;

  v_check := home_validate_fx_accounts(p_cny_account_id, p_jpy_account_id);
  if not coalesce((v_check ->> 'ok')::boolean, false) then
    return v_check;
  end if;

  update home_jpy_transactions
  set
    account_id = p_jpy_account_id,
    transfer_account_id = null,
    transacted_at = p_transacted_at,
    amount = p_jpy_amount,
    description = v_description,
    note = coalesce(p_note, '')
  where id = v_jpy_transaction.id
    and user_id = auth.uid();

  update home_cny_transactions
  set
    account_id = p_cny_account_id,
    transfer_account_id = null,
    transacted_at = p_transacted_at,
    amount = p_cny_amount,
    description = v_description,
    note = coalesce(p_note, ''),
    linked_jpy_transaction_id = v_jpy_transaction.id
  where id = v_jpy_transaction.linked_cny_transaction_id
    and user_id = auth.uid()
    and currency = 'CNY'
  returning id into v_cny_transaction_id;

  if v_cny_transaction_id is null then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的人民币入金流水。');
  end if;

  return jsonb_build_object('ok', true, 'message', '日元换人民币已更新。');
end;
$$;


--
-- Name: home_update_jpy_transaction(uuid, uuid, uuid, date, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_update_jpy_transaction(p_transaction_id uuid, p_account_id uuid, p_transfer_account_id uuid, p_transacted_at date, p_amount numeric, p_description text, p_note text) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_transaction home_jpy_transactions%rowtype;
begin
  if coalesce(p_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'message', '流水金额必须大于 0。');
  end if;

  select *
  into v_transaction
  from home_jpy_transactions
  where id = p_transaction_id
    and user_id = auth.uid();

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可更新的日元流水。');
  end if;

  if v_transaction.transaction_type in ('fixed_in', 'fixed_out')
    or home_resolve_fixed_transfer_item_id(v_transaction) is not null then
    return jsonb_build_object('ok', false, 'message', '固定调拨流水不能在零散收支中编辑，请删除后重新生成。');
  end if;

  update home_jpy_transactions
  set
    account_id = p_account_id,
    transfer_account_id = case when v_transaction.transaction_type = 'transfer' then p_transfer_account_id else null end,
    transacted_at = p_transacted_at,
    amount = p_amount,
    description = coalesce(p_description, ''),
    note = coalesce(p_note, '')
  where id = v_transaction.id
    and user_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'updated_count', 1,
    'linked_updated', false,
    'reset_expense_status', false,
    'message', '日元流水已更新。'
  );
end;
$$;


--
-- Name: home_upsert_cny_fixed_transaction(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_upsert_cny_fixed_transaction(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
declare
  v_item home_fixed_month_items%rowtype;
  v_transaction_id uuid;
  v_transaction_type text;
  v_transacted_at date;
begin
  select *
  into v_item
  from home_fixed_month_items
  where id = p_item_id
    and user_id = auth.uid()
    and currency = 'CNY';

  if not found then
    return jsonb_build_object('ok', false, 'message', '没有找到可同步的人民币固定项。');
  end if;

  if v_item.status not in ('paid', 'settled') then
    return jsonb_build_object('ok', true, 'message', '人民币固定项未结算，不需要生成流水。');
  end if;

  if v_item.account_id is null then
    return jsonb_build_object('ok', false, 'message', '人民币固定项需要先选择账户，才能生成统一流水。');
  end if;

  if not exists (
    select 1
    from home_accounts
    where id = v_item.account_id
      and user_id = auth.uid()
      and currency = 'CNY'
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '人民币固定项账户无效或已停用。');
  end if;

  v_transaction_type := case
    when v_item.direction = 'income' then 'income'
    else 'expense'
  end;
  v_transacted_at := coalesce(v_item.due_date, to_date(v_item.month_key || '-01', 'YYYY-MM-DD'));

  if v_item.linked_cny_transaction_id is not null and exists (
    select 1
    from home_cny_transactions
    where id = v_item.linked_cny_transaction_id
      and user_id = auth.uid()
  ) then
    update home_cny_transactions
    set
      transaction_type = v_transaction_type,
      account_id = v_item.account_id,
      transfer_account_id = null,
      transacted_at = v_transacted_at,
      amount = v_item.amount,
      description = v_item.name,
      note = v_item.note,
      linked_fixed_month_item_id = v_item.id
    where id = v_item.linked_cny_transaction_id
      and user_id = auth.uid()
    returning id into v_transaction_id;
  else
    insert into home_cny_transactions (
      user_id,
      transaction_type,
      account_id,
      transfer_account_id,
      currency,
      transacted_at,
      amount,
      description,
      note,
      linked_fixed_month_item_id
    )
    values (
      auth.uid(),
      v_transaction_type,
      v_item.account_id,
      null,
      'CNY',
      v_transacted_at,
      v_item.amount,
      v_item.name,
      v_item.note,
      v_item.id
    )
    returning id into v_transaction_id;

    update home_fixed_month_items
    set linked_cny_transaction_id = v_transaction_id
    where id = v_item.id
      and user_id = auth.uid();
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', '人民币固定项已同步到统一流水。',
    'cny_transaction_id', v_transaction_id
  );
end;
$$;


--
-- Name: home_validate_fx_accounts(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_validate_fx_accounts(p_cny_account_id uuid, p_jpy_account_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
begin
  if not exists (
    select 1
    from home_accounts
    where id = p_cny_account_id
      and user_id = auth.uid()
      and currency = 'CNY'
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '人民币账户无效或已停用。');
  end if;

  if not exists (
    select 1
    from home_accounts
    where id = p_jpy_account_id
      and user_id = auth.uid()
      and currency = 'JPY'
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'message', '日元账户无效或已停用。');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;


--
-- Name: home_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    currency text NOT NULL,
    name text NOT NULL,
    account_type text NOT NULL,
    opening_balance numeric(14,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    allow_school_requests boolean DEFAULT false NOT NULL,
    CONSTRAINT home_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['cash'::text, 'bank'::text, 'wallet'::text, 'pass_through'::text, 'investment'::text]))),
    CONSTRAINT home_accounts_currency_check CHECK ((currency = ANY (ARRAY['JPY'::text, 'CNY'::text])))
);


--
-- Name: home_cny_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_cny_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    currency text DEFAULT 'CNY'::text NOT NULL,
    transaction_type text NOT NULL,
    account_id uuid NOT NULL,
    transfer_account_id uuid,
    transacted_at date NOT NULL,
    amount numeric(14,2) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    linked_fixed_month_item_id uuid,
    linked_jpy_transaction_id uuid,
    external_source text,
    external_source_id uuid,
    external_event_type text,
    external_idempotency_key text,
    external_reference_type text,
    external_reference_id uuid,
    external_note text,
    external_payload_hash text,
    external_created_at timestamp with time zone,
    created_by_external boolean DEFAULT false NOT NULL,
    CONSTRAINT home_cny_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT home_cny_transactions_check CHECK ((((transaction_type = 'transfer'::text) AND (transfer_account_id IS NOT NULL) AND (transfer_account_id <> account_id)) OR ((transaction_type <> 'transfer'::text) AND (transfer_account_id IS NULL)))),
    CONSTRAINT home_cny_transactions_currency_check CHECK ((currency = 'CNY'::text)),
    CONSTRAINT home_cny_transactions_external_required_check CHECK (((created_by_external IS NOT TRUE) OR ((external_source = 'aozora_school'::text) AND (external_source_id IS NOT NULL) AND (external_idempotency_key IS NOT NULL) AND (external_reference_id IS NOT NULL) AND (currency = 'CNY'::text) AND (amount > (0)::numeric) AND (transfer_account_id IS NULL) AND (linked_fixed_month_item_id IS NULL) AND (linked_jpy_transaction_id IS NULL) AND (((external_reference_type = 'school_income_records'::text) AND (external_event_type = ANY (ARRAY['tuition_income_received'::text, 'income_received'::text])) AND (transaction_type = 'income'::text)) OR ((external_reference_type = 'school_expense_records'::text) AND (external_event_type = 'expense_paid'::text) AND (transaction_type = 'expense'::text)))))),
    CONSTRAINT home_cny_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text, 'fx_in'::text, 'fx_out'::text])))
);


--
-- Name: home_external_transaction_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_external_transaction_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    external_source text NOT NULL,
    external_event_id uuid NOT NULL,
    external_reference_type text NOT NULL,
    external_reference_id uuid NOT NULL,
    request_type text NOT NULL,
    transaction_type text NOT NULL,
    currency text DEFAULT 'JPY'::text NOT NULL,
    amount numeric(14,2) NOT NULL,
    account_id uuid NOT NULL,
    transacted_at date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejected_reason text,
    created_transaction_id uuid,
    idempotency_key text NOT NULL,
    payload_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text DEFAULT '外部待确认请求'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_external_transaction_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT home_external_transaction_requests_currency_check CHECK ((currency = ANY (ARRAY['JPY'::text, 'CNY'::text]))),
    CONSTRAINT home_external_transaction_requests_lifecycle_check CHECK ((((status = 'pending'::text) AND (approved_at IS NULL) AND (rejected_at IS NULL) AND (rejected_reason IS NULL) AND (created_transaction_id IS NULL)) OR ((status = 'approved'::text) AND (approved_at IS NOT NULL) AND (rejected_at IS NULL) AND (rejected_reason IS NULL) AND (created_transaction_id IS NOT NULL)) OR ((status = 'rejected'::text) AND (approved_at IS NULL) AND (rejected_at IS NOT NULL) AND (created_transaction_id IS NULL)))),
    CONSTRAINT home_external_transaction_requests_reference_check CHECK ((((external_reference_type = 'school_income_records'::text) AND (request_type = ANY (ARRAY['tuition_income_received'::text, 'income_received'::text])) AND (transaction_type = 'income'::text)) OR ((external_reference_type = 'school_expense_records'::text) AND (request_type = 'expense_paid'::text) AND (transaction_type = 'expense'::text)) OR ((status <> 'pending'::text) AND (((external_reference_type = 'school_payment_requests'::text) AND (request_type = ANY (ARRAY['teacher_wage_payment_confirm'::text, 'teacher_wage_payment_reverse'::text]))) OR ((external_reference_type = 'school_part_time_work_income_requests'::text) AND (request_type = 'part_time_work_income_received'::text)))))),
    CONSTRAINT home_external_transaction_requests_source_check CHECK ((external_source = 'aozora_school'::text)),
    CONSTRAINT home_external_transaction_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT home_external_transaction_requests_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: home_fixed_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_fixed_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    currency text NOT NULL,
    direction text NOT NULL,
    name text NOT NULL,
    fixed_type text NOT NULL,
    default_amount numeric(14,2) DEFAULT 0 NOT NULL,
    default_account_id uuid,
    payment_group text,
    due_day integer,
    start_month text,
    end_month text,
    total_terms integer,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_fixed_templates_currency_check CHECK ((currency = ANY (ARRAY['JPY'::text, 'CNY'::text]))),
    CONSTRAINT home_fixed_templates_direction_check CHECK ((direction = ANY (ARRAY['income'::text, 'expense'::text]))),
    CONSTRAINT home_fixed_templates_due_day_check CHECK (((due_day >= 1) AND (due_day <= 31))),
    CONSTRAINT home_fixed_templates_fixed_type_check CHECK ((fixed_type = ANY (ARRAY['long_term'::text, 'short_term'::text]))),
    CONSTRAINT home_fixed_templates_total_terms_check CHECK (((total_terms IS NULL) OR (total_terms > 0)))
);


--
-- Name: home_payment_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_payment_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    currency text NOT NULL,
    name text NOT NULL,
    default_due_day integer,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_payment_channels_currency_check CHECK ((currency = ANY (ARRAY['JPY'::text, 'CNY'::text]))),
    CONSTRAINT home_payment_channels_default_due_day_check CHECK (((default_due_day >= 1) AND (default_due_day <= 31)))
);


--
-- Name: home_accounts home_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_accounts
    ADD CONSTRAINT home_accounts_pkey PRIMARY KEY (id);


--
-- Name: home_cny_transactions home_cny_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_cny_transactions
    ADD CONSTRAINT home_cny_transactions_pkey PRIMARY KEY (id);


--
-- Name: home_external_transaction_requests home_external_transaction_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_external_transaction_requests
    ADD CONSTRAINT home_external_transaction_requests_pkey PRIMARY KEY (id);


--
-- Name: home_fixed_month_items home_fixed_month_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_month_items
    ADD CONSTRAINT home_fixed_month_items_pkey PRIMARY KEY (id);


--
-- Name: home_fixed_templates home_fixed_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_templates
    ADD CONSTRAINT home_fixed_templates_pkey PRIMARY KEY (id);


--
-- Name: home_jpy_transactions home_jpy_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_jpy_transactions
    ADD CONSTRAINT home_jpy_transactions_pkey PRIMARY KEY (id);


--
-- Name: home_payment_channels home_payment_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_payment_channels
    ADD CONSTRAINT home_payment_channels_pkey PRIMARY KEY (id);


--
-- Name: home_accounts_user_currency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_accounts_user_currency_idx ON public.home_accounts USING btree (user_id, currency);


--
-- Name: home_cny_transactions_external_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_cny_transactions_external_idempotency_unique ON public.home_cny_transactions USING btree (external_idempotency_key) WHERE ((created_by_external IS TRUE) AND (external_idempotency_key IS NOT NULL));


--
-- Name: home_cny_transactions_external_source_event_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_cny_transactions_external_source_event_unique ON public.home_cny_transactions USING btree (external_source, external_reference_type, external_reference_id, external_event_type) WHERE ((created_by_external IS TRUE) AND (external_source IS NOT NULL) AND (external_reference_type IS NOT NULL) AND (external_reference_id IS NOT NULL) AND (external_event_type IS NOT NULL));


--
-- Name: home_cny_transactions_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_cny_transactions_user_date_idx ON public.home_cny_transactions USING btree (user_id, transacted_at);


--
-- Name: home_external_transaction_requests_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_external_transaction_requests_account_idx ON public.home_external_transaction_requests USING btree (account_id);


--
-- Name: home_external_transaction_requests_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_external_transaction_requests_idempotency_unique ON public.home_external_transaction_requests USING btree (idempotency_key);


--
-- Name: home_external_transaction_requests_reference_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_external_transaction_requests_reference_active_unique ON public.home_external_transaction_requests USING btree (external_source, external_reference_type, external_reference_id, request_type) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));


--
-- Name: home_external_transaction_requests_source_event_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_external_transaction_requests_source_event_unique ON public.home_external_transaction_requests USING btree (external_source, external_event_id, request_type);


--
-- Name: home_external_transaction_requests_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_external_transaction_requests_user_status_idx ON public.home_external_transaction_requests USING btree (user_id, status, requested_at DESC);


--
-- Name: home_fixed_month_items_template_month_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_fixed_month_items_template_month_unique ON public.home_fixed_month_items USING btree (user_id, month_key, template_id) WHERE (template_id IS NOT NULL);


--
-- Name: home_fixed_month_items_user_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_fixed_month_items_user_month_idx ON public.home_fixed_month_items USING btree (user_id, month_key, currency);


--
-- Name: home_fixed_templates_user_currency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_fixed_templates_user_currency_idx ON public.home_fixed_templates USING btree (user_id, currency);


--
-- Name: home_jpy_transactions_external_idempotency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_jpy_transactions_external_idempotency_unique ON public.home_jpy_transactions USING btree (external_idempotency_key) WHERE ((created_by_external IS TRUE) AND (external_idempotency_key IS NOT NULL));


--
-- Name: home_jpy_transactions_external_source_event_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_jpy_transactions_external_source_event_unique ON public.home_jpy_transactions USING btree (external_source, external_reference_type, external_reference_id, external_event_type) WHERE ((created_by_external IS TRUE) AND (external_source IS NOT NULL) AND (external_reference_type IS NOT NULL) AND (external_reference_id IS NOT NULL) AND (external_event_type IS NOT NULL));


--
-- Name: home_jpy_transactions_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_jpy_transactions_user_date_idx ON public.home_jpy_transactions USING btree (user_id, transacted_at);


--
-- Name: home_payment_channels_user_currency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX home_payment_channels_user_currency_idx ON public.home_payment_channels USING btree (user_id, currency);


--
-- Name: home_payment_channels_user_currency_name_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX home_payment_channels_user_currency_name_active_unique ON public.home_payment_channels USING btree (user_id, currency, name) WHERE is_active;


--
-- Name: home_accounts home_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_accounts
    ADD CONSTRAINT home_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_cny_transactions home_cny_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_cny_transactions
    ADD CONSTRAINT home_cny_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.home_accounts(id) ON DELETE CASCADE;


--
-- Name: home_cny_transactions home_cny_transactions_linked_fixed_month_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_cny_transactions
    ADD CONSTRAINT home_cny_transactions_linked_fixed_month_item_id_fkey FOREIGN KEY (linked_fixed_month_item_id) REFERENCES public.home_fixed_month_items(id) ON DELETE SET NULL;


--
-- Name: home_cny_transactions home_cny_transactions_linked_jpy_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_cny_transactions
    ADD CONSTRAINT home_cny_transactions_linked_jpy_transaction_id_fkey FOREIGN KEY (linked_jpy_transaction_id) REFERENCES public.home_jpy_transactions(id) ON DELETE SET NULL;


--
-- Name: home_cny_transactions home_cny_transactions_transfer_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_cny_transactions
    ADD CONSTRAINT home_cny_transactions_transfer_account_id_fkey FOREIGN KEY (transfer_account_id) REFERENCES public.home_accounts(id) ON DELETE CASCADE;


--
-- Name: home_cny_transactions home_cny_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_cny_transactions
    ADD CONSTRAINT home_cny_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_external_transaction_requests home_external_transaction_requests_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_external_transaction_requests
    ADD CONSTRAINT home_external_transaction_requests_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.home_accounts(id) ON DELETE RESTRICT;


--
-- Name: home_external_transaction_requests home_external_transaction_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_external_transaction_requests
    ADD CONSTRAINT home_external_transaction_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_fixed_month_items home_fixed_month_items_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_month_items
    ADD CONSTRAINT home_fixed_month_items_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.home_accounts(id) ON DELETE SET NULL;


--
-- Name: home_fixed_month_items home_fixed_month_items_linked_cny_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_month_items
    ADD CONSTRAINT home_fixed_month_items_linked_cny_transaction_id_fkey FOREIGN KEY (linked_cny_transaction_id) REFERENCES public.home_cny_transactions(id) ON DELETE SET NULL;


--
-- Name: home_fixed_month_items home_fixed_month_items_linked_jpy_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_month_items
    ADD CONSTRAINT home_fixed_month_items_linked_jpy_transaction_id_fkey FOREIGN KEY (linked_jpy_transaction_id) REFERENCES public.home_jpy_transactions(id) ON DELETE SET NULL;


--
-- Name: home_fixed_month_items home_fixed_month_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_month_items
    ADD CONSTRAINT home_fixed_month_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.home_fixed_templates(id) ON DELETE SET NULL;


--
-- Name: home_fixed_month_items home_fixed_month_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_month_items
    ADD CONSTRAINT home_fixed_month_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_fixed_templates home_fixed_templates_default_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_templates
    ADD CONSTRAINT home_fixed_templates_default_account_id_fkey FOREIGN KEY (default_account_id) REFERENCES public.home_accounts(id) ON DELETE SET NULL;


--
-- Name: home_fixed_templates home_fixed_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_fixed_templates
    ADD CONSTRAINT home_fixed_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_jpy_transactions home_jpy_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_jpy_transactions
    ADD CONSTRAINT home_jpy_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.home_accounts(id) ON DELETE CASCADE;


--
-- Name: home_jpy_transactions home_jpy_transactions_linked_cny_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_jpy_transactions
    ADD CONSTRAINT home_jpy_transactions_linked_cny_transaction_id_fkey FOREIGN KEY (linked_cny_transaction_id) REFERENCES public.home_cny_transactions(id) ON DELETE SET NULL;


--
-- Name: home_jpy_transactions home_jpy_transactions_linked_fixed_month_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_jpy_transactions
    ADD CONSTRAINT home_jpy_transactions_linked_fixed_month_item_id_fkey FOREIGN KEY (linked_fixed_month_item_id) REFERENCES public.home_fixed_month_items(id) ON DELETE SET NULL;


--
-- Name: home_jpy_transactions home_jpy_transactions_transfer_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_jpy_transactions
    ADD CONSTRAINT home_jpy_transactions_transfer_account_id_fkey FOREIGN KEY (transfer_account_id) REFERENCES public.home_accounts(id) ON DELETE CASCADE;


--
-- Name: home_jpy_transactions home_jpy_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_jpy_transactions
    ADD CONSTRAINT home_jpy_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_payment_channels home_payment_channels_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_payment_channels
    ADD CONSTRAINT home_payment_channels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: home_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: home_accounts home_accounts_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_accounts_user_all ON public.home_accounts TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: home_cny_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_cny_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: home_cny_transactions home_cny_transactions_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_cny_transactions_user_all ON public.home_cny_transactions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: home_external_transaction_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_external_transaction_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: home_external_transaction_requests home_external_transaction_requests_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_external_transaction_requests_user_select ON public.home_external_transaction_requests FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: home_fixed_month_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_fixed_month_items ENABLE ROW LEVEL SECURITY;

--
-- Name: home_fixed_month_items home_fixed_month_items_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_fixed_month_items_user_all ON public.home_fixed_month_items TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: home_fixed_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_fixed_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: home_fixed_templates home_fixed_templates_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_fixed_templates_user_all ON public.home_fixed_templates TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: home_jpy_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_jpy_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: home_jpy_transactions home_jpy_transactions_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_jpy_transactions_user_all ON public.home_jpy_transactions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: home_payment_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_payment_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: home_payment_channels home_payment_channels_user_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_payment_channels_user_all ON public.home_payment_channels TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- PostgreSQL database dump complete
--
