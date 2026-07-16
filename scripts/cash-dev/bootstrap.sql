\set ON_ERROR_STOP on

-- Cash dev is installed only into a target that has no existing home_* objects.
-- The whole bootstrap runs in one transaction so a failed restore leaves no
-- partially installed Cash schema behind.
begin;

do $$
declare
  v_relations integer;
  v_functions integer;
begin
  select count(*)
  into v_relations
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname like 'home\_%' escape '\';

  select count(*)
  into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'home\_%' escape '\';

  if v_relations <> 0 or v_functions <> 0 then
    raise exception
      'Cash dev bootstrap requires an empty target (found % home relations and % home functions)',
      v_relations,
      v_functions;
  end if;
end
$$;

\ir schema.sql
\ir hardening.sql

commit;
