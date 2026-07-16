\pset pager off
\pset tuples_only on
\pset format unaligned

select 'target_home_relations=' || count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'home\_%' escape '\';

select 'target_home_functions=' || count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'home\_%' escape '\';

select 'target_home_policies=' || count(*)
from pg_policies
where schemaname = 'public'
  and tablename like 'home\_%' escape '\';
