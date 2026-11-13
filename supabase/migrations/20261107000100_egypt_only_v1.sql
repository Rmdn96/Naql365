-- V1 write boundary only. No historical data, role, RLS or Store-scope changes.
create function private.egypt_only_write() returns trigger
language plpgsql set search_path='' as $$
declare row_data jsonb=to_jsonb(new); selected_market uuid; selected_org uuid;
begin
 if tg_table_name='mvp_funnel_counts' and tg_table_schema='private' then
  if new.country is distinct from 'EG' then raise exception 'V1 supports Egypt only' using errcode='42501'; end if;
 elsif tg_table_name='markets' and tg_table_schema='public' then
  if new.country_code<>'EG' or new.currency<>'EGP' then
   -- Existing markets can be deactivated without rewriting any historical facts.
   if tg_op='UPDATE' and not new.active and
    (to_jsonb(new)-array['active','updated_at'])=(to_jsonb(old)-array['active','updated_at']) then return new; end if;
   raise exception 'V1 supports Egypt (EG/EGP) only' using errcode='42501';
  end if;
  if tg_op='UPDATE' and (old.country_code<>'EG' or old.currency<>'EGP') then
   raise exception 'Historical market identity cannot be converted' using errcode='42501';
  end if;
 else
  if tg_op='UPDATE' and (to_jsonb(old)->>'market_id') is distinct from (row_data->>'market_id') and not exists(select 1 from public.markets m where m.id=(to_jsonb(old)->>'market_id')::uuid and m.country_code='EG' and m.currency='EGP') then
   raise exception 'Historical market ownership cannot be converted' using errcode='42501';
  end if;
  selected_market=(row_data->>'market_id')::uuid;
  selected_org=(row_data->>'organization_id')::uuid;
  if not exists(select 1 from public.markets m where m.id=selected_market and m.organization_id=selected_org and m.country_code='EG' and m.currency='EGP')
   or (row_data ? 'currency' and row_data->>'currency' is distinct from 'EGP') then
   raise exception 'V1 supports Egypt (EG/EGP) only' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.egypt_only_write() from public,anon,authenticated;
-- Run after existing BEFORE triggers derive/validate parent market identity.
create trigger zz_egypt_only_write before insert or update on public.markets
for each row execute function private.egypt_only_write();
do $$ declare target record; begin
 for target in select c.table_schema,c.table_name from information_schema.columns c
 join information_schema.tables t using(table_schema,table_name)
 where c.table_schema in ('public','private') and c.column_name='market_id'
 and t.table_type='BASE TABLE' and c.table_name<>'audit_logs' loop
 execute format('create trigger zz_egypt_only_write before insert or update on %I.%I for each row execute function private.egypt_only_write()',target.table_schema,target.table_name);
 end loop;
end $$;

create or replace function public.public_market_catalogue() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'country',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,
 'currency',m.currency,'timezone',m.timezone,'services',(
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nameAr',s.name_ar,'nameEn',s.name_en) order by s.code),'[]')
 from public.market_services ms join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where ms.market_id=m.id and ms.organization_id=m.organization_id and ms.active and s.active
 and exists(select 1 from public.service_areas a where a.market_id=m.id and a.service_id=s.id and a.active)
 ),'cities',(
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nameAr',c.name_ar,'nameEn',c.name_en,
 'pickupEligible',exists(select 1 from public.service_areas a join public.market_services ms on ms.organization_id=a.organization_id and ms.market_id=a.market_id and ms.service_id=a.service_id join public.services s on s.organization_id=ms.organization_id and s.id=ms.service_id where a.organization_id=m.organization_id and a.market_id=m.id and a.city_id=c.id and a.active and a.pickup_eligible and ms.active and s.active),
 'deliveryEligible',exists(select 1 from public.service_areas a join public.market_services ms on ms.organization_id=a.organization_id and ms.market_id=a.market_id and ms.service_id=a.service_id join public.services s on s.organization_id=ms.organization_id and s.id=ms.service_id where a.organization_id=m.organization_id and a.market_id=m.id and a.city_id=c.id and a.active and a.delivery_eligible and ms.active and s.active)) order by c.code),'[]')
 from public.market_cities c where c.organization_id=m.organization_id and c.market_id=m.id
 and exists(select 1 from public.service_areas a join public.market_services ms on ms.market_id=a.market_id and ms.service_id=a.service_id and ms.organization_id=a.organization_id join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where a.city_id=c.id and a.market_id=m.id and a.active and ms.active and s.active)
 )) order by m.country_code),'[]') from public.markets m
 join private.customer_enrollment e on e.organization_id=m.organization_id
 where m.active and m.country_code='EG' and m.currency='EGP'
$$;


-- New optional geography provisioning is Egypt-only; existing geography is untouched.
-- Administrative provisioning for initial catalogue; no client grants or service activation.
create or replace function private.provision_initial_market_catalogue(p_organization_id uuid) returns void
language plpgsql set search_path='' as $$ begin
insert into public.markets(organization_id,country_code,name_ar,name_en,currency,timezone,phone_country_code)
values(p_organization_id,'EG','مصر','Egypt','EGP','Africa/Cairo','+20')
on conflict(organization_id,country_code) do nothing;
-- Geographic catalogue only. This does not activate a market or any service coverage.
-- Stable codes identify catalogue records within their market; display names are not keys.
insert into public.market_regions(organization_id,market_id,code,name_ar,name_en,administrative_type)
select m.organization_id,m.id,c.code,c.ar,c.en,c.kind from (select * from public.markets where organization_id=p_organization_id and country_code='EG') m
join (values
 ('EG','cairo','القاهرة','Cairo','governorate'),
 ('EG','alexandria','الإسكندرية','Alexandria','governorate')
) c(country,code,ar,en,kind) on c.country=m.country_code
on conflict(organization_id,market_id,code) do nothing;
insert into public.market_cities(organization_id,market_id,region_id,code,name_ar,name_en)
select m.organization_id,m.id,r.id,c.code,c.ar,c.en from (select * from public.markets where organization_id=p_organization_id and country_code='EG') m
join (values
 ('EG','cairo','cairo','القاهرة','Cairo'),
 ('EG','alexandria','alexandria','الإسكندرية','Alexandria')
) c(country,region,code,ar,en) on c.country=m.country_code
join public.market_regions r on r.market_id=m.id and r.code=c.region
on conflict(organization_id,market_id,region_id,code) do nothing;

end $$;

-- Preserve historical Saudi counters, deny any new Saudi telemetry writes.
create trigger zz_egypt_only_write before insert or update on private.mvp_funnel_counts
for each row execute function private.egypt_only_write();

-- Reject unsupported direct RPC telemetry before enrollment lookup or budget consumption.
create or replace function public.record_mvp_event(p_event text,p_country text,p_context text) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_event is null or p_event not in ('homepage_viewed','request_started','request_completed','preliminary_quote_viewed','final_quote_viewed','quote_accepted','quote_rejected','payment_method_selected','transfer_proof_submitted','tracking_viewed','whatsapp_clicked')
 or p_country is null or p_country<>'EG' or p_context is null or p_context not in ('home','request','quote','checkout','tracking')
 then raise exception 'Unsupported metric' using errcode='22023'; end if;
 select e.organization_id into org from private.customer_enrollment e join public.markets m on m.organization_id=e.organization_id and m.country_code=p_country and m.active;
 if org is null then return; end if;
 perform private.consume_guest_budget(org,'analytics',org,600);
 insert into private.mvp_funnel_counts values(org,(clock_timestamp() at time zone 'UTC')::date,p_country,p_event,p_context,1)
 on conflict(organization_id,day,country,event,context) do update set count=mvp_funnel_counts.count+1;
 delete from private.mvp_funnel_counts where organization_id=org and day<(clock_timestamp() at time zone 'UTC')::date-90;
end $$;

-- Marketless child records (tracking samples, payment events, support/media metadata)
-- inherit the boundary from their declared FK parent, without broadening SELECT/RLS.
create function private.egypt_only_parent_write() returns trigger
language plpgsql set search_path='' as $$
declare parent_id uuid=(to_jsonb(new)->>tg_argv[2])::uuid; permitted boolean;
begin
 if parent_id is null then return new; end if;
 execute format('select exists(select 1 from %I.%I p join public.markets m on m.id=p.market_id and m.organization_id=p.organization_id where p.id=$1 and m.country_code=''EG'' and m.currency=''EGP'')',tg_argv[0],tg_argv[1]) into permitted using parent_id;
 if not permitted then raise exception 'V1 supports Egypt (EG/EGP) parents only' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.egypt_only_parent_write() from public,anon,authenticated;
do $$ declare target record; begin
 for target in
 select distinct ns.nspname child_schema,cl.relname child_table,pns.nspname parent_schema,pc.relname parent_table,a.attname child_column
 from pg_constraint f
 join pg_class cl on cl.oid=f.conrelid join pg_namespace ns on ns.oid=cl.relnamespace
 join pg_class pc on pc.oid=f.confrelid join pg_namespace pns on pns.oid=pc.relnamespace
 join lateral unnest(f.conkey,f.confkey) keys(child_key,parent_key) on true
 join pg_attribute a on a.attrelid=cl.oid and a.attnum=keys.child_key
 join pg_attribute pa on pa.attrelid=pc.oid and pa.attnum=keys.parent_key
 where f.contype='f' and ns.nspname in('public','private') and pa.attname='id'
 and exists(select 1 from pg_attribute c where c.attrelid=pc.oid and c.attname='market_id' and not c.attisdropped)
 and not exists(select 1 from pg_attribute c where c.attrelid=cl.oid and c.attname='market_id' and not c.attisdropped)
 loop
 execute format('create trigger %I before insert or update on %I.%I for each row execute function private.egypt_only_parent_write(%L,%L,%L)', 'zz_egypt_parent_'||target.child_column,target.child_schema,target.child_table,target.parent_schema,target.parent_table,target.child_column);
 end loop;
end $$;

-- Disable new non-Egypt market activity, retaining market IDs and every historical fact.
update public.markets set active=false where active and (country_code<>'EG' or currency<>'EGP');
