\set ON_ERROR_STOP on
\pset pager off

begin;

do $$
declare
  v_batch public.home_external_transaction_batches%rowtype;
  v_item_count integer;
  v_item_total numeric(14,2);
  v_request_count integer;
  v_transaction_count integer;
  v_school_batch_count integer;
  v_school_item_count integer;
  v_school_item_total numeric(14,2);
  v_request_ids uuid[];
  v_result jsonb;
begin
  select * into v_batch
  from public.home_external_transaction_batches
  where school_payment_batch_id is not null
    and school_synced_at is not null
  order by school_synced_at desc
  limit 1;

  if v_batch.id is null then
    raise exception 'No School-synced teacher wage batch exists for E2E verification.';
  end if;

  select count(*), sum(amount), array_agg(request_id order by request_id)
  into v_item_count, v_item_total, v_request_ids
  from public.home_external_transaction_batch_items
  where batch_id = v_batch.id;

  if v_item_count <> v_batch.request_count
    or v_item_total <> v_batch.total_amount then
    raise exception 'Cash batch item totals do not match the batch header.';
  end if;

  select count(*) into v_request_count
  from public.home_external_transaction_requests
  where id = any(v_request_ids)
    and status = 'approved'
    and created_transaction_id = v_batch.created_transaction_id;

  if v_request_count <> v_batch.request_count then
    raise exception 'Cash requests do not share the approved batch transaction.';
  end if;

  if v_batch.currency = 'JPY' then
    select count(*) into v_transaction_count
    from public.home_jpy_transactions
    where id = v_batch.created_transaction_id
      and external_reference_type = 'school_expense_batches'
      and external_reference_id = v_batch.id
      and external_event_type = 'teacher_wage_batch_paid'
      and transaction_type = 'expense'
      and amount = v_batch.total_amount;
  else
    select count(*) into v_transaction_count
    from public.home_cny_transactions
    where id = v_batch.created_transaction_id
      and external_reference_type = 'school_expense_batches'
      and external_reference_id = v_batch.id
      and external_event_type = 'teacher_wage_batch_paid'
      and transaction_type = 'expense'
      and amount = v_batch.total_amount;
  end if;

  if v_transaction_count <> 1 then
    raise exception 'Cash batch does not resolve to exactly one aggregate transaction.';
  end if;

  select count(*) into v_school_batch_count
  from public.cash_payment_batches
  where id = v_batch.school_payment_batch_id
    and external_cash_batch_id = v_batch.id
    and external_cash_transaction_id = v_batch.created_transaction_id
    and status = 'cash_confirmed';

  select count(*), sum(coalesce(amount_jpy, amount_cny))
  into v_school_item_count, v_school_item_total
  from public.cash_payment_batch_items
  where batch_id = v_batch.school_payment_batch_id;

  if v_school_batch_count <> 1
    or v_school_item_count <> v_batch.request_count
    or v_school_item_total <> v_batch.total_amount then
    raise exception 'School batch callback result does not match the Cash batch.';
  end if;

  perform set_config('request.jwt.claim.sub', v_batch.user_id::text, true);

  v_result := public.home_approve_teacher_wage_request_batch(v_request_ids);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, true) is not false
    or (v_result ->> 'batch_id')::uuid <> v_batch.id
    or (v_result ->> 'created_transaction_id')::uuid <> v_batch.created_transaction_id then
    raise exception 'Aggregate approval retry was not idempotent: %', v_result;
  end if;
  raise notice 'Aggregate approval retry: passed';

  v_result := public.home_mark_teacher_wage_batch_school_synced(
    v_batch.id,
    v_batch.school_payment_batch_id
  );
  if coalesce((v_result ->> 'ok')::boolean, false) is not true
    or coalesce((v_result ->> 'inserted')::boolean, true) is not false then
    raise exception 'School sync marker retry was not idempotent: %', v_result;
  end if;
  raise notice 'School sync marker retry: passed';

  v_result := public.home_mark_teacher_wage_batch_school_synced(
    v_batch.id,
    gen_random_uuid()
  );
  if coalesce((v_result ->> 'ok')::boolean, true) is not false then
    raise exception 'Conflicting School sync marker was not rejected: %', v_result;
  end if;
  raise notice 'Conflicting School sync marker: passed';

  if v_batch.currency = 'JPY' then
    begin
      update public.home_jpy_transactions
      set note = note
      where id = v_batch.created_transaction_id;
      raise exception 'JPY aggregate transaction update guard did not reject the mutation.';
    exception
      when others then
        if sqlerrm <> '老师工资聚合 Cash 流水不可编辑或删除。' then
          raise;
        end if;
        raise notice 'JPY aggregate transaction update guard: passed';
    end;

    begin
      delete from public.home_jpy_transactions
      where id = v_batch.created_transaction_id;
      raise exception 'JPY aggregate transaction delete guard did not reject the mutation.';
    exception
      when others then
        if sqlerrm <> '老师工资聚合 Cash 流水不可编辑或删除。' then
          raise;
        end if;
        raise notice 'JPY aggregate transaction delete guard: passed';
    end;
  else
    begin
      update public.home_cny_transactions
      set note = note
      where id = v_batch.created_transaction_id;
      raise exception 'CNY aggregate transaction update guard did not reject the mutation.';
    exception
      when others then
        if sqlerrm <> '老师工资聚合 Cash 流水不可编辑或删除。' then
          raise;
        end if;
        raise notice 'CNY aggregate transaction update guard: passed';
    end;

    begin
      delete from public.home_cny_transactions
      where id = v_batch.created_transaction_id;
      raise exception 'CNY aggregate transaction delete guard did not reject the mutation.';
    exception
      when others then
        if sqlerrm <> '老师工资聚合 Cash 流水不可编辑或删除。' then
          raise;
        end if;
        raise notice 'CNY aggregate transaction delete guard: passed';
    end;
  end if;

  raise notice 'Teacher wage batch E2E: Cash batch %, School batch %, % %, % items',
    v_batch.id,
    v_batch.school_payment_batch_id,
    v_batch.currency,
    v_batch.total_amount,
    v_batch.request_count;
end;
$$;

rollback;
