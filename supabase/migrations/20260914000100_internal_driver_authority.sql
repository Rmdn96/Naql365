-- Phase 4 analysis committed as 022ae5d before this additive migration.
alter table public.trip_stops add column driver_instructions text not null default '' check(length(driver_instructions)<=1000);
alter table public.trip_events add column source text not null default 'STAFF' check(source in ('STAFF','DRIVER'));
alter table public.issues
 add column trip_id uuid,
 add column stop_id uuid,
 add column market_id uuid,
 add column actor_id uuid references public.profiles(id),
 add column category text check(category in ('CUSTOMER_UNAVAILABLE','ADDRESS_ISSUE','ACCESS_BLOCKED','ITEM_NOT_READY','VEHICLE_ISSUE','DAMAGE_CONCERN','OTHER')),
 add column reason text check(length(btrim(reason)) between 1 and 1000),
 add column status text not null default 'OPEN' check(status in ('OPEN','RESOLVED')),
 add column resolved_by uuid references public.profiles(id),
 add column resolved_at timestamptz,
 add column resolution text check(length(btrim(resolution)) between 1 and 1000),
 add column mutation_id uuid,
 add constraint execution_issue_facts check(trip_id is null or (stop_id is not null and market_id is not null and actor_id is not null and category is not null and reason is not null and mutation_id is not null)),
 add constraint issue_resolution_facts check((status='RESOLVED')=(resolved_by is not null and resolved_at is not null and resolution is not null)),
 add constraint issue_trip_market foreign key(organization_id,market_id,trip_id) references public.trips(organization_id,market_id,id),
 add constraint issue_stop_trip foreign key(organization_id,trip_id,stop_id) references public.trip_stops(organization_id,trip_id,id),
 add constraint issue_mutation unique(actor_id,mutation_id);
create index issues_trip_attention on public.issues(organization_id,trip_id,status);

create function private.internal_driver(p_org uuid) returns uuid language sql stable security definer set search_path='' as $$
 select d.id from public.drivers d join public.organization_memberships m on m.organization_id=d.organization_id and m.profile_id=d.profile_id
 join public.markets market on market.organization_id=d.organization_id and market.id=d.market_id
 where d.organization_id=p_org and d.profile_id=auth.uid() and d.driver_type='INTERNAL' and d.active and market.active
 and m.status='active' and m.member_type='driver' and private.has_permission(p_org,'driver.access')
 and exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.organization_id=p_org and ur.profile_id=auth.uid() and r.code='DRIVER' and r.member_type='driver')
$$;
create function private.driver_trip_access(p_trip uuid,p_history boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trips t join public.assignments a on a.trip_id=t.id and a.organization_id=t.organization_id and a.market_id=t.market_id
 join public.drivers d on d.id=a.driver_id and d.organization_id=t.organization_id and d.market_id=t.market_id
 join public.vehicles v on v.id=a.vehicle_id and v.organization_id=t.organization_id and v.market_id=t.market_id
 where t.id=p_trip and d.id=private.internal_driver(t.organization_id) and
 ((a.ended_at is null and t.status not in ('COMPLETED','CANCELLED','FAILED') and v.active)
 or (p_history and t.status='COMPLETED' and a.ended_at=t.completed_at)))
$$;
create function private.driver_action_allowed(p_org uuid,p_trip uuid,p_action text,p_payload jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if p_action is null or p_action not in ('dispatch','arrive','start_service','complete_stop','depart','complete_trip')
 or not exists(select 1 from public.trips where id=p_trip and organization_id=p_org)
 or not private.driver_trip_access(p_trip,p_action='complete_trip') then return false; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then return false; end if;
 if p_action in ('arrive','start_service','complete_stop','depart') then
  return (p_payload-array['stopId'])='{}'::jsonb and p_payload->>'stopId' is not null
   and exists(select 1 from public.trip_stops where trip_id=p_trip and id::text=p_payload->>'stopId');
 end if;
 return p_payload='{}'::jsonb;
end $$;
create function public.driver_identity() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'organizationId',d.organization_id,'marketId',d.market_id,'name',d.display_name) order by d.id),'[]'::jsonb)
 from public.drivers d where d.id=private.internal_driver(d.organization_id)
$$;
revoke all on function private.internal_driver(uuid),private.driver_trip_access(uuid,boolean),private.driver_action_allowed(uuid,uuid,text,jsonb),public.driver_identity() from public,anon,authenticated;
grant execute on function public.driver_identity() to authenticated;

-- Raw staff records remain denied to DRIVER. Projections below are the read boundary.
create policy execution_issues_operations_read on public.issues for select to authenticated using(trip_id is not null and private.has_permission(organization_id,'operations.manage'));

create table public.trip_event_locations(
 event_id uuid primary key references public.trip_events(id),
 organization_id uuid not null,
 trip_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 latitude numeric(9,6) not null check(latitude between -90 and 90),
 longitude numeric(10,6) not null check(longitude between -180 and 180),
 accuracy_m numeric(10,2) check(accuracy_m between 0 and 100000),
 captured_at timestamptz not null,
 recorded_at timestamptz not null default now(),
 foreign key(organization_id,trip_id) references public.trips(organization_id,id)
);
alter table public.trip_event_locations enable row level security;
revoke all on public.trip_event_locations from public,anon,authenticated;
-- Precise coordinates are evidence, not routine driver/customer data or analytics.
grant select on public.trip_event_locations to authenticated;
create policy event_location_audit on public.trip_event_locations for select to authenticated using(private.has_permission(organization_id,'audit.read'));
create trigger event_location_immutable before update or delete on public.trip_event_locations for each row execute function private.protect_operational_history();

create function private.record_event_location(p_event uuid,p_location jsonb) returns void language plpgsql set search_path='' as $$
declare e public.trip_events; lat numeric; lon numeric; accuracy numeric; captured timestamptz;
begin
 if p_location is null or p_location='null'::jsonb then return; end if;
 if jsonb_typeof(p_location)<>'object' or (p_location-array['latitude','longitude','accuracy','capturedAt'])<>'{}'::jsonb
 or jsonb_typeof(p_location->'latitude') is distinct from 'number' or jsonb_typeof(p_location->'longitude') is distinct from 'number'
 or p_location->>'capturedAt' is null
 or (p_location ? 'accuracy' and jsonb_typeof(p_location->'accuracy') not in ('number','null')) then raise exception 'Invalid location' using errcode='22023'; end if;
 lat=(p_location->>'latitude')::numeric; lon=(p_location->>'longitude')::numeric; accuracy=(p_location->>'accuracy')::numeric; captured=(p_location->>'capturedAt')::timestamptz;
 if lat not between -90 and 90 or lon not between -180 and 180 or accuracy<0 or accuracy>100000 or captured>now()+interval '5 minutes' or captured<now()-interval '1 day' then raise exception 'Invalid location range/time' using errcode='22023'; end if;
 select * into e from public.trip_events where id=p_event and actor_id=auth.uid() and event_type in ('ARRIVE','POD_CAPTURED');
 if not found then raise exception 'Invalid milestone association' using errcode='42501'; end if;
 insert into public.trip_event_locations(event_id,organization_id,trip_id,actor_id,latitude,longitude,accuracy_m,captured_at)
 values(e.id,e.organization_id,e.trip_id,e.actor_id,lat,lon,accuracy,captured);
end $$;
revoke all on function private.record_event_location(uuid,jsonb) from public,anon,authenticated;

-- Evidence associations are explicit and immutable, never inferred from client IDs.
create function private.validate_event_location() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.trip_events e where e.id=new.event_id and e.organization_id=new.organization_id and e.trip_id=new.trip_id and e.actor_id=new.actor_id and e.event_type in ('ARRIVE','POD_CAPTURED')) then raise exception 'Location event mismatch' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.validate_event_location() from public,anon,authenticated;
create trigger location_event_identity before insert on public.trip_event_locations for each row execute function private.validate_event_location();
