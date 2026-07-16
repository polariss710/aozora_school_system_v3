-- pg_dump ACLs are intentionally not copied from the current Cash production
-- project. Establish the minimum dev permissions explicitly.
do $$
declare
  v_table record;
  v_function record;
begin
  for v_table in
    select format('%I.%I', n.nspname, c.relname) as qualified_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname like 'home\_%' escape '\'
  loop
    execute format('revoke all on table %s from public, anon', v_table.qualified_name);
    execute format(
      'grant select, insert, update, delete on table %s to authenticated',
      v_table.qualified_name
    );
    execute format('grant all on table %s to service_role', v_table.qualified_name);
  end loop;

  for v_function in
    select p.oid::regprocedure::text as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'home\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon', v_function.signature);
    execute format('grant execute on function %s to service_role', v_function.signature);

    -- Only the School API service role may create external requests or invoke
    -- the low-level external transaction writers. Cash users approve/reject
    -- pending requests through their authenticated session.
    if v_function.proname not in (
      'home_create_external_transaction_request',
      'home_create_external_jpy_transaction',
      'home_create_external_cny_transaction'
    ) then
      execute format('grant execute on function %s to authenticated', v_function.signature);
    end if;
  end loop;
end
$$;
