begin;

do $$
begin
  if (select count(*) from public.income_records where id='5e34939a-049c-4034-8dd8-42113d3d8049'::uuid and memo='STAGING-E2E-FX-1784423188456' and original_amount_cny=88 and record_status='cash_confirmed' and cash_status='account_transaction_created') <> 1 then
    raise exception 'Retained FX School income does not match.';
  end if;
  if (select count(*) from public.home_school_fx_syncs where id='cccba270-6779-44c6-88ad-2bbe4b09f618'::uuid and cny_transaction_id='22223532-2609-439a-bb48-3b48b53f34e1'::uuid and jpy_transaction_id='091daf51-6326-41b7-83a2-b40d17493da2'::uuid and school_inbound_event_id='aad7aa27-62f8-4220-9371-c71265a5f7b2'::uuid and school_account_transaction_id='76591bca-0529-4ae0-9a03-2309886877b2'::uuid) <> 1 then
    raise exception 'Retained FX Cash sync identity does not match.';
  end if;
  if (select count(*) from public.home_cny_transactions where id='22223532-2609-439a-bb48-3b48b53f34e1'::uuid and transaction_type='fx_out' and amount=88 and linked_jpy_transaction_id='091daf51-6326-41b7-83a2-b40d17493da2'::uuid) <> 1
    or (select count(*) from public.home_jpy_transactions where id='091daf51-6326-41b7-83a2-b40d17493da2'::uuid and transaction_type='fx_in' and amount=1800 and linked_cny_transaction_id='22223532-2609-439a-bb48-3b48b53f34e1'::uuid) <> 1 then
    raise exception 'Retained FX Cash pair does not match.';
  end if;
  if (select count(*) from public.cash_inbound_events where id='aad7aa27-62f8-4220-9371-c71265a5f7b2'::uuid and external_cash_event_id='22223532-2609-439a-bb48-3b48b53f34e1' and source_amount_cny=88 and target_amount_jpy=1800 and account_transaction_id='76591bca-0529-4ae0-9a03-2309886877b2'::uuid) <> 1
    or (select count(*) from public.account_transactions where id='76591bca-0529-4ae0-9a03-2309886877b2'::uuid and amount_jpy=1800 and status='active' and external_event_id='22223532-2609-439a-bb48-3b48b53f34e1') <> 1 then
    raise exception 'Retained FX School inbound identity does not match.';
  end if;
end
$$;

delete from public.audit_events where target_id in (
  '5e34939a-049c-4034-8dd8-42113d3d8049',
  '08e8e670-d33e-4bb2-b26b-09f6639d89be',
  'aad7aa27-62f8-4220-9371-c71265a5f7b2',
  '76591bca-0529-4ae0-9a03-2309886877b2'
);
delete from public.home_school_fx_syncs where id='cccba270-6779-44c6-88ad-2bbe4b09f618'::uuid;
delete from public.cash_inbound_events where id='aad7aa27-62f8-4220-9371-c71265a5f7b2'::uuid;
delete from public.account_transactions where id='76591bca-0529-4ae0-9a03-2309886877b2'::uuid;
delete from public.home_cny_transactions where id='22223532-2609-439a-bb48-3b48b53f34e1'::uuid;
delete from public.home_jpy_transactions where id='091daf51-6326-41b7-83a2-b40d17493da2'::uuid;
delete from public.home_external_transaction_requests where id='f4fe39e4-7fe4-4c42-b2c8-c9751bf88035'::uuid;
delete from public.cash_requests where id='08e8e670-d33e-4bb2-b26b-09f6639d89be'::uuid;
delete from public.home_cny_transactions where id='a1d002fa-5358-4e64-aa9a-a9cbe60739b1'::uuid;
delete from public.income_records where id='5e34939a-049c-4034-8dd8-42113d3d8049'::uuid;

do $$
begin
  if exists (select 1 from public.income_records where memo='STAGING-E2E-FX-1784423188456')
    or exists (select 1 from public.home_school_fx_syncs where id='cccba270-6779-44c6-88ad-2bbe4b09f618'::uuid)
    or exists (select 1 from public.cash_inbound_events where id='aad7aa27-62f8-4220-9371-c71265a5f7b2'::uuid) then
    raise exception 'Finalized FX cleanup left residual records.';
  end if;
end
$$;

commit;
select 0 as residual_rows;
