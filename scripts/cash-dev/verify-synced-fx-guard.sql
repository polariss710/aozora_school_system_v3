\set ON_ERROR_STOP on

begin;

do $$
declare
  v_user_id uuid;
  v_cny_transaction_id uuid;
  v_jpy_transaction_id uuid;
  v_school_inbound_event_id uuid;
  v_school_account_transaction_id uuid;
  v_result jsonb;
begin
  select
    user_id,
    cny_transaction_id,
    jpy_transaction_id,
    school_inbound_event_id,
    school_account_transaction_id
  into
    v_user_id,
    v_cny_transaction_id,
    v_jpy_transaction_id,
    v_school_inbound_event_id,
    v_school_account_transaction_id
  from public.home_school_fx_syncs
  order by synced_at desc
  limit 1;

  if v_cny_transaction_id is null or v_jpy_transaction_id is null then
    raise exception 'No synced Cash FX pair exists for mutation guard verification.';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  v_result := public.home_mark_cny_to_jpy_fx_school_synced(
    v_cny_transaction_id,
    v_school_inbound_event_id,
    v_school_account_transaction_id
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, true) is not false then
    raise exception 'Same-payload sync marker retry was not idempotent: %', v_result;
  end if;
  raise notice 'Same-payload marker retry: passed';

  v_result := public.home_mark_cny_to_jpy_fx_school_synced(
    v_cny_transaction_id,
    gen_random_uuid(),
    v_school_account_transaction_id
  );
  if coalesce((v_result ->> 'ok')::boolean, true) is not false then
    raise exception 'Conflicting sync marker retry was not rejected: %', v_result;
  end if;
  raise notice 'Conflicting marker retry: passed';

  begin
    update public.home_cny_transactions
    set note = note
    where id = v_cny_transaction_id;
    raise exception 'CNY update guard did not reject the synced FX transaction.';
  exception
    when others then
      if sqlerrm <> '已回写 School 的人民币购汇流水不可编辑或删除。' then
        raise;
      end if;
      raise notice 'CNY update guard: passed';
  end;

  begin
    delete from public.home_cny_transactions
    where id = v_cny_transaction_id;
    raise exception 'CNY delete guard did not reject the synced FX transaction.';
  exception
    when others then
      if sqlerrm <> '已回写 School 的人民币购汇流水不可编辑或删除。' then
        raise;
      end if;
      raise notice 'CNY delete guard: passed';
  end;

  begin
    update public.home_jpy_transactions
    set note = note
    where id = v_jpy_transaction_id;
    raise exception 'JPY update guard did not reject the synced FX transaction.';
  exception
    when others then
      if sqlerrm <> '已回写 School 的日元入金流水不可编辑或删除。' then
        raise;
      end if;
      raise notice 'JPY update guard: passed';
  end;

  begin
    delete from public.home_jpy_transactions
    where id = v_jpy_transaction_id;
    raise exception 'JPY delete guard did not reject the synced FX transaction.';
  exception
    when others then
      if sqlerrm <> '已回写 School 的日元入金流水不可编辑或删除。' then
        raise;
      end if;
      raise notice 'JPY delete guard: passed';
  end;
end;
$$;

rollback;
