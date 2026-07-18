\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_user_id uuid;
  v_cny_account_id uuid;
  v_jpy_account_id uuid;
  v_cny_transaction_id uuid;
  v_jpy_transaction_id uuid;
  v_school_event_id uuid := gen_random_uuid();
  v_school_transaction_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  select user_id, id into v_user_id, v_cny_account_id
  from public.home_accounts
  where name like 'STAGING Cash %' and currency = 'CNY' and is_active
  order by name limit 1;
  select id into v_jpy_account_id
  from public.home_accounts
  where user_id = v_user_id and name like 'STAGING Cash %'
    and currency = 'JPY' and is_active
  order by name limit 1;

  if v_user_id is null or v_cny_account_id is null or v_jpy_account_id is null then
    raise exception 'Staging CNY/JPY Cash accounts are incomplete.';
  end if;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  v_result := public.home_create_cny_to_jpy_fx(
    v_cny_account_id, v_jpy_account_id, date '2099-10-31',
    88, 1800, 'STAGING-E2E CNY to JPY FX', '');
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'Staging FX pair creation failed: %', v_result;
  end if;
  v_cny_transaction_id := (v_result ->> 'cny_transaction_id')::uuid;
  v_jpy_transaction_id := (v_result ->> 'jpy_transaction_id')::uuid;

  v_result := public.home_mark_cny_to_jpy_fx_school_synced(
    v_cny_transaction_id, v_school_event_id, v_school_transaction_id);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, false) is not true then
    raise exception 'FX School marker failed: %', v_result;
  end if;

  v_result := public.home_mark_cny_to_jpy_fx_school_synced(
    v_cny_transaction_id, v_school_event_id, v_school_transaction_id);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, true) is not false then
    raise exception 'FX marker retry was not idempotent: %', v_result;
  end if;

  v_result := public.home_mark_cny_to_jpy_fx_school_synced(
    v_cny_transaction_id, gen_random_uuid(), v_school_transaction_id);
  if coalesce((v_result ->> 'ok')::boolean, true) is not false then
    raise exception 'Conflicting FX School identity was not rejected: %', v_result;
  end if;

  begin
    update public.home_cny_transactions set note = note where id = v_cny_transaction_id;
    raise exception 'CNY update guard did not reject mutation.';
  exception when others then
    if sqlerrm <> '已回写 School 的人民币购汇流水不可编辑或删除。' then raise; end if;
  end;
  begin
    delete from public.home_cny_transactions where id = v_cny_transaction_id;
    raise exception 'CNY delete guard did not reject mutation.';
  exception when others then
    if sqlerrm <> '已回写 School 的人民币购汇流水不可编辑或删除。' then raise; end if;
  end;
  begin
    update public.home_jpy_transactions set note = note where id = v_jpy_transaction_id;
    raise exception 'JPY update guard did not reject mutation.';
  exception when others then
    if sqlerrm <> '已回写 School 的日元入金流水不可编辑或删除。' then raise; end if;
  end;
  begin
    delete from public.home_jpy_transactions where id = v_jpy_transaction_id;
    raise exception 'JPY delete guard did not reject mutation.';
  exception when others then
    if sqlerrm <> '已回写 School 的日元入金流水不可编辑或删除。' then raise; end if;
  end;

  raise notice 'STAGING-E2E FX sync idempotency and guards: passed';
end;
$$;

rollback;
