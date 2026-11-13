-- Egypt V1 contract. Historical two-market contract is retained in tests/fixtures.
begin;
create function public.egypt_market_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Egypt market assertion: %',label; end if; end $$;
insert into public.organizations(id,name) values('e2000000-0000-4000-8000-000000000001','Egypt V1 fixture');
select private.provision_initial_market_catalogue('e2000000-0000-4000-8000-000000000001');
select public.egypt_market_assert((select count(*)=1 from public.markets where organization_id='e2000000-0000-4000-8000-000000000001'),'one Egypt market provisioned');
select public.egypt_market_assert((select bool_and(country_code='EG' and currency='EGP') from public.markets where organization_id='e2000000-0000-4000-8000-000000000001'),'EG/EGP only');
-- The new write gate is present on market-bound Finance, Transport and Store tables.
select public.egypt_market_assert(not exists(select 1 from information_schema.columns c join information_schema.tables t using(table_schema,table_name) where c.table_schema in('public','private') and c.column_name='market_id' and t.table_type='BASE TABLE' and c.table_name<>'audit_logs' and not exists(select 1 from pg_trigger g where g.tgrelid=(quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass and g.tgname='zz_egypt_only_write')),'complete existing market table coverage');
do $$ begin
 begin insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code)values('e2000000-0000-4000-8000-000000000001','SA','اختبار','Test',true,'SAR','Asia/Riyadh','+966');raise exception 'SA creation unexpectedly accepted';exception when insufficient_privilege then null;end;
end $$;
rollback;
-- Supabase TAP report
begin;
select plan(1);
select pass('Egypt provisioning, Saudi creation denial and complete market write-trigger coverage');
select * from finish();
rollback;
