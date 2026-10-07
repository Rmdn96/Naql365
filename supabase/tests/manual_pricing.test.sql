-- Privilege and schema checks on real Supabase; business races use independent psql connections.
begin;
select plan(8);
select is((select count(*)::int from information_schema.columns where table_schema='public' and table_name='pricing_settings' and column_name='pricing_mode'),1,'authoritative market pricing mode exists');
select ok(not has_function_privilege('anon','public.create_manual_quote_draft(uuid,integer,bigint,numeric,text,integer,uuid)','execute'),'anonymous cannot invoke manual quote');
select ok(has_function_privilege('authenticated','public.create_manual_quote_draft(uuid,integer,bigint,numeric,text,integer,uuid)','execute'),'authenticated entry retains internal permission checks');
select ok(not has_table_privilege('authenticated','public.quote_pricing_details','insert'),'no direct provenance writes');
select ok(not has_table_privilege('anon','public.quote_pricing_details','select'),'no anonymous private provenance');
select ok(not has_table_privilege('authenticated','private.manual_quote_mutations','select'),'private idempotency ledger inaccessible');
select ok(not has_function_privilege('anon','private.request_coverage_valid(public.requests)','execute'),'coverage predicate not a public data oracle');
select is((select count(*)::int from information_schema.columns where table_schema='public' and table_name='service_areas' and column_name in ('pickup_eligible','delivery_eligible')),2,'directional city eligibility without route pairs');
select * from finish();
rollback;
