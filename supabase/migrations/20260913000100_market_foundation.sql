-- Phase 3.5. Gap analysis committed before this additive migration.
create table public.markets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),
 name_ar text not null check(length(name_ar) between 1 and 120), name_en text not null check(length(name_en) between 1 and 120),
 active boolean not null default false, currency text not null check(currency ~ '^[A-Z]{3}$'),
 timezone text not null, phone_country_code text not null check(phone_country_code ~ '^\+[1-9][0-9]{0,3}$'),
 default_locale text not null default 'ar' check(default_locale in ('ar','en')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,country_code), unique(organization_id,id,currency)
);
create function private.validate_market_configuration() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone)
 then raise exception 'Unknown IANA timezone' using errcode='22023'; end if;
 if tg_op='UPDATE' and (new.organization_id,new.country_code,new.currency,new.timezone,new.phone_country_code) is distinct from
 (old.organization_id,old.country_code,old.currency,old.timezone,old.phone_country_code)
 then raise exception 'Market identity configuration is immutable' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.validate_market_configuration() from public,anon,authenticated;
create trigger market_configuration before insert or update on public.markets for each row execute function private.validate_market_configuration();
create trigger markets_updated_at before update on public.markets for each row execute function private.touch_updated_at();
create trigger markets_audit after insert or update or delete on public.markets for each row execute function private.audit_change();

create table public.market_regions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 code text not null check(length(code) between 1 and 40), name_ar text not null, name_en text not null,
 administrative_type text not null check(administrative_type in ('province','governorate','region')),
 foreign key(organization_id,market_id) references public.markets(organization_id,id),
 unique(organization_id,market_id,id), unique(organization_id,market_id,code)
);
create table public.market_cities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null, region_id uuid not null,
 code text not null check(length(code) between 1 and 60), name_ar text not null, name_en text not null,
 foreign key(organization_id,market_id,region_id) references public.market_regions(organization_id,market_id,id),
 unique(organization_id,market_id,id), unique(organization_id,market_id,region_id,code)
);
create table public.market_services (
 organization_id uuid not null, market_id uuid not null, service_id uuid not null, active boolean not null default false,
 primary key(organization_id,market_id,service_id),
 foreign key(organization_id,market_id) references public.markets(organization_id,id),
 foreign key(organization_id,service_id) references public.services(organization_id,id)
);
create table public.market_tax_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 code text not null, version integer not null check(version>0), rate_bps integer not null check(rate_bps between 0 and 10000),
 label_ar text not null, label_en text not null, active boolean not null default false,
 effective_from timestamptz not null, effective_until timestamptz,
 configuration_kind text not null check(configuration_kind in ('LEGACY_PRESERVED','STAGING_TEST','APPROVED')),
 created_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from),
 foreign key(organization_id,market_id) references public.markets(organization_id,id),
 unique(organization_id,market_id,id), unique(organization_id,market_id,code,version)
);
create index market_tax_effective on public.market_tax_versions(organization_id,market_id,active,effective_from,effective_until);
-- No Egyptian tariff, legal rate or coverage is seeded by this migration.
insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code)
 select id,'SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966' from public.organizations;
insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code)
 select id,'EG','مصر','Egypt',false,'EGP','Africa/Cairo','+20' from public.organizations;
insert into public.market_services(organization_id,market_id,service_id,active)
 select s.organization_id,m.id,s.id,s.active from public.services s join public.markets m on m.organization_id=s.organization_id and m.country_code='SA';
insert into public.market_tax_versions(organization_id,market_id,code,version,rate_bps,label_ar,label_en,active,effective_from,configuration_kind)
 select s.organization_id,m.id,'legacy-vat',1,s.vat_rate_bps,'ضريبة محفوظة','Preserved tax',true,s.created_at,'LEGACY_PRESERVED'
 from public.pricing_settings s join public.markets m on m.organization_id=s.organization_id and m.country_code='SA';

-- Privileged configuration is separate from read-only catalogue access.
insert into public.permissions(code) values('markets.manage') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p where r.code='SUPER_ADMIN' and p.code='markets.manage' on conflict do nothing;
do $$ declare tab text; begin
 foreach tab in array array['markets','market_regions','market_cities','market_services','market_tax_versions'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('create policy market_tenant_read on public.%I for select to authenticated using(private.is_member(organization_id))',tab);
  execute format('grant insert,update,delete on public.%I to authenticated',tab);
  execute format('create policy market_admin_write on public.%I for all to authenticated using(private.has_permission(organization_id,''markets.manage'')) with check(private.has_permission(organization_id,''markets.manage''))',tab);
 end loop;
end $$;

-- All existing records are Saudi-origin. Never rewrite their commercial values.
-- Preserve updated_at, immutable snapshots and audit history during context-only backfill.
-- Hold table locks and restore the exact original user-trigger state in this transaction.
create temporary table market_backfill_triggers on commit drop as
 select c.relname as tab,t.tgname as name,t.tgenabled as state from pg_catalog.pg_trigger t
 join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal and c.relname=any(array['branches','drivers','vehicles','teams','service_areas','requests','request_locations','request_items','request_attachments','request_additional_services','pricing_settings','pricing_rules','vehicle_pricing_classes','distance_snapshots','pricing_evaluations','pricing_evaluation_components','quotes','quote_versions','quote_items','quote_pricing_details','orders','jobs','trips','trip_stops','assignments','trip_events','trip_pods']);
do $$ declare r record; begin
 for r in select * from market_backfill_triggers loop execute format('alter table public.%I disable trigger %I',r.tab,r.name); end loop;
end $$;
do $$ declare tab text; begin
 foreach tab in array array['branches','drivers','vehicles','teams','service_areas','requests','request_locations','request_items','request_attachments','request_additional_services','pricing_settings','pricing_rules','vehicle_pricing_classes','distance_snapshots','pricing_evaluations','pricing_evaluation_components','quotes','quote_versions','quote_items','quote_pricing_details','orders','jobs','trips','trip_stops','assignments','trip_events','trip_pods'] loop
  execute format('alter table public.%I add column market_id uuid',tab);
  execute format('update public.%I t set market_id=m.id from public.markets m where m.organization_id=t.organization_id and m.country_code=''SA''',tab);
  execute format('alter table public.%I alter column market_id set not null',tab);
  execute format('alter table public.%I add constraint %I foreign key(organization_id,market_id) references public.markets(organization_id,id)',tab,tab||'_market_fk');
  execute format('create index %I on public.%I(organization_id,market_id)',tab||'_market_idx',tab);
 end loop;
end $$;
do $$ declare r record; begin
 for r in select * from market_backfill_triggers loop
  execute format('alter table public.%I %s trigger %I',r.tab,case r.state when 'D' then 'disable' when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,r.name);
 end loop;
end $$;

alter table public.pricing_settings drop constraint pricing_settings_pkey, add primary key(organization_id,market_id);
alter table public.pricing_rules drop constraint pricing_rules_organization_id_code_version_key, add unique(organization_id,market_id,code,version);
alter table public.vehicle_pricing_classes drop constraint vehicle_pricing_classes_organization_id_code_key, add unique(organization_id,market_id,code);
do $$ declare tab text; begin
 foreach tab in array array['pricing_settings','pricing_evaluations','quote_versions','orders'] loop
  execute format('alter table public.%I drop constraint %I',tab,tab||'_currency_check');
  execute format('alter table public.%I alter column currency drop default',tab);
  execute format('alter table public.%I add constraint %I foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency)',tab,tab||'_market_currency_fk');
 end loop;
 foreach tab in array array['branches','drivers','vehicles','teams','requests','pricing_rules','vehicle_pricing_classes','distance_snapshots','pricing_evaluations','quotes','quote_versions','orders','jobs','trips','trip_stops'] loop
  execute format('alter table public.%I add unique(organization_id,market_id,id)',tab);
 end loop;
end $$;
alter table public.drivers add column branch_id uuid;
alter table public.request_locations
 add column city_id uuid, add column postal_code text not null default '' check(length(postal_code)<=20),
 add column building text not null default '' check(length(building)<=100), add column unit text not null default '' check(length(unit)<=60);
alter table public.trip_stops add column city_id uuid;
alter table public.service_areas add column city_id uuid, add column active boolean not null default false,
 add unique(organization_id,market_id,service_id,city_id),
 add foreign key(organization_id,market_id,service_id) references public.market_services(organization_id,market_id,service_id),
 add foreign key(organization_id,market_id,city_id) references public.market_cities(organization_id,market_id,id),
 add check(not active or city_id is not null);
alter table public.requests add foreign key(organization_id,market_id,service_id) references public.market_services(organization_id,market_id,service_id);
alter table public.request_locations add foreign key(organization_id,market_id,city_id) references public.market_cities(organization_id,market_id,id);
alter table public.trip_stops add foreign key(organization_id,market_id,city_id) references public.market_cities(organization_id,market_id,id);
alter table public.pricing_evaluations add column tax_version_id uuid,
 add foreign key(organization_id,market_id,tax_version_id) references public.market_tax_versions(organization_id,market_id,id);
alter table public.quote_versions add column tax_version_id uuid,
 add column tax_code text, add column tax_label_ar text, add column tax_label_en text,
 add foreign key(organization_id,market_id,tax_version_id) references public.market_tax_versions(organization_id,market_id,id);
alter table public.orders add column tax_version_id uuid,
 add column tax_code text, add column tax_rate_bps integer check(tax_rate_bps between 0 and 10000),
 add column tax_label_ar text, add column tax_label_en text,
 add foreign key(organization_id,market_id,tax_version_id) references public.market_tax_versions(organization_id,market_id,id);
-- Null tax version means a preserved legacy snapshot, never an invented legal configuration.

create function private.inherit_market() returns trigger language plpgsql security definer set search_path='' as $$
declare parent_market uuid; parent_id uuid;
begin
 parent_id=(to_jsonb(new)->>tg_argv[1])::uuid;
 if parent_id is not null then
  execute format('select market_id from public.%I where id=$1 and organization_id=$2',tg_argv[0]) into parent_market using parent_id,new.organization_id;
  if parent_market is null then raise exception 'Parent context unavailable' using errcode='23503'; end if;
  if new.market_id is null then new.market_id=parent_market; end if;
  if new.market_id<>parent_market then raise exception 'Cross-market relationship' using errcode='23514'; end if;
 end if;
 if tg_op='UPDATE' and (new.market_id,new.organization_id) is distinct from (old.market_id,old.organization_id)
 then raise exception 'Market context is immutable; restart explicitly' using errcode='55000'; end if;
 return new;
end $$;
create function private.freeze_market_context() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.market_id,new.organization_id) is distinct from (old.market_id,old.organization_id)
 then raise exception 'Market context is immutable' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.inherit_market(),private.freeze_market_context() from public,anon,authenticated;
do $$ declare rel text[]; tab text; begin
 foreach rel slice 1 in array array[
 ['request_locations','requests','request_id'],['request_items','requests','request_id'],['request_attachments','requests','request_id'],['request_additional_services','requests','request_id'],
 ['distance_snapshots','requests','request_id'],['pricing_evaluations','requests','request_id'],['pricing_evaluation_components','pricing_evaluations','evaluation_id'],
 ['quotes','requests','request_id'],['quote_versions','quotes','quote_id'],['quote_items','quote_versions','quote_version_id'],['quote_pricing_details','quote_versions','quote_version_id'],
 ['orders','quote_versions','accepted_quote_version_id'],['jobs','orders','order_id'],['trips','jobs','job_id'],['trip_stops','trips','trip_id'],['assignments','trips','trip_id'],['trip_events','trips','trip_id'],['trip_pods','trips','trip_id']
 ] loop
  execute format('create trigger a_inherit_market before insert or update on public.%I for each row execute function private.inherit_market(%L,%L)',rel[1],rel[2],rel[3]);
  execute format('alter table public.%I add constraint %I foreign key(organization_id,market_id,%I) references public.%I(organization_id,market_id,id)',rel[1],rel[1]||'_parent_market_fk',rel[3],rel[2]);
 end loop;
 foreach rel slice 1 in array array[
 ['drivers','branches','branch_id'],['vehicles','branches','branch_id'],['teams','branches','branch_id'],
 ['assignments','drivers','driver_id'],['assignments','vehicles','vehicle_id'],['assignments','teams','team_id'],
 ['pricing_evaluations','distance_snapshots','distance_snapshot_id'],['pricing_evaluations','vehicle_pricing_classes','vehicle_class_id'],['pricing_evaluation_components','pricing_rules','pricing_rule_id'],
 ['quote_pricing_details','pricing_evaluations','evaluation_id'],['orders','requests','request_id'],['orders','quotes','quote_id']
 ] loop
  execute format('alter table public.%I add constraint %I foreign key(organization_id,market_id,%I) references public.%I(organization_id,market_id,id)',rel[1],rel[1]||'_'||rel[3]||'_market_fk',rel[3],rel[2]);
 end loop;
 foreach tab in array array['branches','drivers','vehicles','teams','service_areas','requests','pricing_settings','pricing_rules','vehicle_pricing_classes'] loop
  execute format('create trigger freeze_market before update on public.%I for each row execute function private.freeze_market_context()',tab);
 end loop;
end $$;
create function private.protect_market_tax() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'active'-'effective_until')=(to_jsonb(old)-'active'-'effective_until') then return new; end if;
 raise exception 'Tax version facts are immutable; create a new version' using errcode='55000';
end $$;
revoke all on function private.protect_market_tax() from public,anon,authenticated;
create trigger tax_version_immutable before update or delete on public.market_tax_versions for each row execute function private.protect_market_tax();
create trigger market_tax_audit after insert or update on public.market_tax_versions for each row execute function private.audit_change();
