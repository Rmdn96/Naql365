-- Shared local/hosted assertions; no pgTAP dependency in hosted execution.
begin;
do $$ begin
 if ((select count(*)::int from information_schema.columns where table_schema='public' and table_name='pricing_settings' and column_name='pricing_mode')=1) is distinct from true then raise exception 'authoritative market pricing mode exists'; end if;
 if (not has_function_privilege('anon','public.create_manual_quote_draft(uuid,integer,bigint,numeric,text,integer,uuid)','execute')) is distinct from true then raise exception 'anonymous cannot invoke manual quote'; end if;
 if (has_function_privilege('authenticated','public.create_manual_quote_draft(uuid,integer,bigint,numeric,text,integer,uuid)','execute')) is distinct from true then raise exception 'authenticated entry retains internal permission checks'; end if;
 if (not has_table_privilege('authenticated','public.quote_pricing_details','insert')) is distinct from true then raise exception 'no direct provenance writes'; end if;
 if (not has_table_privilege('anon','public.quote_pricing_details','select')) is distinct from true then raise exception 'no anonymous private provenance'; end if;
 if (not has_table_privilege('authenticated','private.manual_quote_mutations','select')) is distinct from true then raise exception 'private idempotency ledger inaccessible'; end if;
 if (not has_function_privilege('anon','private.request_coverage_valid(public.requests)','execute')) is distinct from true then raise exception 'coverage predicate not a public data oracle'; end if;
 if ((select count(*)::int from information_schema.columns where table_schema='public' and table_name='service_areas' and column_name in ('pickup_eligible','delivery_eligible'))=2) is distinct from true then raise exception 'directional city eligibility without route pairs'; end if;
end $$;
rollback;

-- Supabase TAP report
begin;
select plan(1);
select pass('Eight manual pricing privilege and schema assertions passed');
select * from finish();
rollback;
