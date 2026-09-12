-- A stronger (organization,market,parent) FK replaces its old (organization,parent) FK.
-- Remove only the exact subsumed relationship, preserving all other parent references.
-- This also keeps PostgREST embedding unambiguous for the existing application queries.
do $$ declare r record; begin
 for r in
  select old.conrelid::regclass as tab,old.conname from pg_catalog.pg_constraint old
  where old.contype='f' and cardinality(old.conkey)=2 and exists(
   select 1 from pg_catalog.pg_constraint stronger
   where stronger.contype='f' and stronger.conrelid=old.conrelid and stronger.confrelid=old.confrelid
   and cardinality(stronger.conkey)=3 and old.conkey <@ stronger.conkey and old.confkey <@ stronger.confkey
   and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=stronger.conrelid and a.attnum=any(stronger.conkey) and a.attname='market_id')
  ) and old.connamespace='public'::regnamespace
 loop execute format('alter table %s drop constraint %I',r.tab,r.conname); end loop;
end $$;
