-- Gap analysis e9b53b0 was committed before this migration.
create table private.tracking_configuration(
 singleton boolean primary key default true check(singleton),
 moving_seconds integer not null default 30 check(moving_seconds between 10 and 120),
 stationary_seconds integer not null default 180 check(stationary_seconds between 120 and 900),
 stale_seconds integer not null default 90 check(stale_seconds between 30 and 600),
 movement_m numeric not null default 25 check(movement_m between 10 and 500),
 speed_mps numeric not null default 1.5 check(speed_mps between 0.5 and 10),
 max_age_seconds integer not null default 120 check(max_age_seconds between 30 and 300),
 future_seconds integer not null default 15 check(future_seconds between 0 and 30),
 history_cap integer not null default 2880 check(history_cap between 100 and 10000),
 staging_retention_hours integer check(staging_retention_hours between 1 and 48)
);
insert into private.tracking_configuration(singleton) values(true);
revoke all on private.tracking_configuration from public,anon,authenticated;

create function private.tracking_active(p_trip uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trips t join public.markets m on m.id=t.market_id and m.organization_id=t.organization_id
 where t.id=p_trip and m.active and t.started_at is not null and t.status not in ('COMPLETED','CANCELLED','FAILED'))
$$;
create function private.tracking_reader(p_trip uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trips t join public.jobs j on j.id=t.job_id join public.orders o on o.id=j.order_id
 join public.markets m on m.id=t.market_id and m.organization_id=t.organization_id
 where t.id=p_trip and m.active and (private.has_permission(t.organization_id,'operations.manage') or private.has_permission(t.organization_id,'dispatch.manage')
 or (private.owns_customer(t.organization_id,o.customer_id) and private.has_permission(t.organization_id,'account.access'))
 or (private.tracking_active(t.id) and private.driver_trip_access(t.id,false))))
$$;
revoke all on function private.tracking_active(uuid),private.tracking_reader(uuid) from public,anon,authenticated;
grant execute on function private.tracking_reader(uuid) to authenticated;

-- Only this minimized row is published. No actor, assignment, private notes or history.
create table public.trip_live_locations(
 trip_id uuid primary key references public.trips(id) on delete cascade,
 organization_id uuid not null,
 market_id uuid not null,
 active boolean not null default false,
 latitude numeric(9,6),longitude numeric(10,6),accuracy_m numeric(10,2),
 captured_at timestamptz,received_at timestamptz,
 version bigint not null default 0 check(version>=0),
 foreign key(organization_id,market_id,trip_id) references public.trips(organization_id,market_id,id),
 check(latitude between -90 and 90 and longitude between -180 and 180 and accuracy_m between 0 and 1000),
 check((latitude is null and longitude is null and accuracy_m is null and captured_at is null and received_at is null)
 or (active and latitude is not null and longitude is not null and accuracy_m is not null and captured_at is not null and received_at is not null))
);
create index trip_live_market on public.trip_live_locations(organization_id,market_id,active,trip_id);
alter table public.trip_live_locations enable row level security;
revoke all on public.trip_live_locations from public,anon,authenticated;
grant select on public.trip_live_locations to authenticated;
create policy live_location_read on public.trip_live_locations for select to authenticated using(private.tracking_reader(trip_id));

create table private.trip_tracking_sessions(
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references public.trips(id) on delete cascade,
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),started_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz,end_reason text check(end_reason in ('REASSIGNED','TERMINAL','RETENTION')),
 check((ended_at is null)=(end_reason is null))
);
create unique index tracking_one_session on private.trip_tracking_sessions(trip_id) where ended_at is null;
create table private.trip_location_samples(
 id uuid primary key,trip_id uuid not null references public.trips(id) on delete cascade,
 session_id uuid not null references private.trip_tracking_sessions(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),assignment_id uuid not null references public.assignments(id) on delete cascade,
 latitude numeric(9,6) not null,longitude numeric(10,6) not null,accuracy_m numeric(10,2) not null,
 speed_mps numeric,heading numeric,captured_at timestamptz not null,received_at timestamptz not null,
 client_type text not null check(client_type in ('WEB','NATIVE')),intent jsonb not null
);
create index tracking_samples_latest on private.trip_location_samples(trip_id,received_at desc,id);
create index tracking_samples_expiry on private.trip_location_samples(received_at);
alter table private.trip_tracking_sessions enable row level security;
alter table private.trip_location_samples enable row level security;
revoke all on private.trip_tracking_sessions,private.trip_location_samples from public,anon,authenticated;

create function private.tracking_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid; terminal boolean; reason text;
begin
 if tg_table_name='trips' then tid=new.id; else tid=new.trip_id; end if;
 terminal=not private.tracking_active(tid);
 if tg_table_name='assignments' then if new.ended_at is null then return new; end if; end if;
 if tg_table_name='trips' and not terminal then return new; end if;
 reason=case when terminal then 'TERMINAL' else 'REASSIGNED' end;
 update private.trip_tracking_sessions set ended_at=clock_timestamp(),end_reason=reason where trip_id=tid and ended_at is null;
 update public.trip_live_locations set active=not terminal,latitude=null,longitude=null,accuracy_m=null,captured_at=null,received_at=null,version=version+1 where trip_id=tid;
 return new;
end $$;
revoke all on function private.tracking_lifecycle() from public,anon,authenticated;
create trigger tracking_trip_end after update of status on public.trips for each row execute function private.tracking_lifecycle();
create trigger tracking_assignment_end after update of ended_at on public.assignments for each row when(old.ended_at is null and new.ended_at is not null) execute function private.tracking_lifecycle();

create function public.publish_trip_location(p_trip uuid,p_sample uuid,p_location jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.trips; a public.assignments; c private.tracking_configuration; prior private.trip_location_samples;
 live public.trip_live_locations; sid uuid; lat numeric; lon numeric; accuracy numeric; speed numeric; heading numeric;
 captured timestamptz; received timestamptz; moving boolean; distance_m double precision; wait_seconds integer;
begin
 if auth.uid() is null or p_sample is null then raise exception 'Driver required' using errcode='42501'; end if;
 select * into t from public.trips where id=p_trip;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(t.organization_id::text,34));
 if not private.tracking_active(t.id) or not private.driver_trip_access(t.id,false) then raise exception 'Active assignment required' using errcode='42501'; end if;
 select * into a from public.assignments where trip_id=t.id and ended_at is null and execution_active;
 if not found then raise exception 'Active assignment required' using errcode='42501'; end if;
 select * into c from private.tracking_configuration where singleton;
 received=clock_timestamp();
 if p_location is null or jsonb_typeof(p_location)<>'object' or (p_location-array['latitude','longitude','accuracy','speed','heading','capturedAt','clientType'])<>'{}'::jsonb
 or jsonb_typeof(p_location->'latitude') is distinct from 'number' or jsonb_typeof(p_location->'longitude') is distinct from 'number'
 or jsonb_typeof(p_location->'accuracy') is distinct from 'number' or jsonb_typeof(p_location->'capturedAt') is distinct from 'string'
 or p_location->>'clientType' is null or p_location->>'clientType' not in ('WEB','NATIVE')
 or (p_location ? 'speed' and jsonb_typeof(p_location->'speed') not in ('number','null'))
 or (p_location ? 'heading' and jsonb_typeof(p_location->'heading') not in ('number','null')) then raise exception 'Invalid sample' using errcode='22023'; end if;
 lat=(p_location->>'latitude')::numeric;lon=(p_location->>'longitude')::numeric;accuracy=(p_location->>'accuracy')::numeric;
 speed=(p_location->>'speed')::numeric;heading=(p_location->>'heading')::numeric;captured=(p_location->>'capturedAt')::timestamptz;
 if lat not between -90 and 90 or lon not between -180 and 180 or accuracy not between 0 and 1000
 or speed<0 or speed>100 or heading<0 or heading>=360 or not isfinite(captured)
 or captured<received-make_interval(secs=>c.max_age_seconds) or captured>received+make_interval(secs=>c.future_seconds)
 then raise exception 'Invalid sample range/time' using errcode='22023'; end if;
 select * into prior from private.trip_location_samples where id=p_sample;
 if found then
  if prior.actor_id<>auth.uid() or prior.trip_id<>t.id or prior.assignment_id<>a.id or prior.intent<>p_location then raise exception 'Sample identity reused' using errcode='22023'; end if;
  return jsonb_build_object('status','REPLAY','receivedAt',prior.received_at);
 end if;
 select * into live from public.trip_live_locations where trip_id=t.id;
 if live.captured_at is not null and captured<=live.captured_at then return jsonb_build_object('status','OUT_OF_ORDER'); end if;
 distance_m=case when live.latitude is null then 0 else 6371000*2*asin(sqrt(least(1::double precision,
 power(sin(radians((lat-live.latitude)::double precision)/2),2)+cos(radians(lat::double precision))*cos(radians(live.latitude::double precision))*power(sin(radians((lon-live.longitude)::double precision)/2),2)))) end;
 moving=coalesce(speed>c.speed_mps,false) or distance_m>=greatest(c.movement_m,accuracy,coalesce(live.accuracy_m,0));
 wait_seconds=case when moving then c.moving_seconds else c.stationary_seconds end;
 if live.received_at is not null and received<live.received_at+make_interval(secs=>wait_seconds) then
  return jsonb_build_object('status','THROTTLED','retryAt',live.received_at+make_interval(secs=>wait_seconds));
 end if;
 select id into sid from private.trip_tracking_sessions where trip_id=t.id and ended_at is null;
 if sid is null then insert into private.trip_tracking_sessions(trip_id,assignment_id,actor_id) values(t.id,a.id,auth.uid()) returning id into sid; end if;
 insert into private.trip_location_samples(id,trip_id,session_id,actor_id,assignment_id,latitude,longitude,accuracy_m,speed_mps,heading,captured_at,received_at,client_type,intent)
 values(p_sample,t.id,sid,auth.uid(),a.id,lat,lon,accuracy,speed,heading,captured,received,p_location->>'clientType',p_location);
 insert into public.trip_live_locations(trip_id,organization_id,market_id,active,latitude,longitude,accuracy_m,captured_at,received_at,version)
 values(t.id,t.organization_id,t.market_id,true,lat,lon,accuracy,captured,received,1)
 on conflict(trip_id) do update set active=true,latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,captured_at=excluded.captured_at,received_at=excluded.received_at,version=trip_live_locations.version+1;
 delete from private.trip_location_samples where id in(select id from private.trip_location_samples where trip_id=t.id order by received_at desc,id offset c.history_cap);
 return jsonb_build_object('status','ACCEPTED','receivedAt',received);
end $$;
revoke all on function public.publish_trip_location(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.publish_trip_location(uuid,uuid,jsonb) to authenticated;

-- Staging operator schedules this bounded capability. No Production retention is inferred.
create function private.prune_tracking_history() returns integer language plpgsql security definer set search_path='' as $$
declare hours integer; removed integer;
begin
 select staging_retention_hours into hours from private.tracking_configuration where singleton;
 if hours is null then raise exception 'Retention policy not configured'; end if;
 delete from private.trip_location_samples where id in(select id from private.trip_location_samples where received_at<clock_timestamp()-make_interval(hours=>hours) order by received_at limit 10000);
 get diagnostics removed=row_count;
 update public.trip_live_locations set latitude=null,longitude=null,accuracy_m=null,captured_at=null,received_at=null,version=version+1 where received_at<clock_timestamp()-make_interval(hours=>hours);
 delete from private.trip_tracking_sessions where id in(select s.id from private.trip_tracking_sessions s where s.ended_at<clock_timestamp()-make_interval(hours=>hours) and not exists(select 1 from private.trip_location_samples p where p.session_id=s.id) limit 10000);
 return removed;
end $$;
revoke all on function private.prune_tracking_history() from public,anon,authenticated;
