-- Phase 3 additive schema; gap analysis committed separately before this migration.
alter table public.drivers alter column profile_id drop not null;
alter table public.drivers
 add column driver_type text not null default 'INTERNAL' check(driver_type in ('INTERNAL','EXTERNAL')),
 add column display_name text check(length(btrim(display_name)) between 1 and 120),
 add column active boolean not null default false,
 add constraint external_driver_no_profile check(driver_type<>'EXTERNAL' or profile_id is null),
 add constraint active_driver_named check(not active or display_name is not null);
create or replace function private.validate_person_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='drivers' and new.profile_id is null then return new; end if;
 if not exists(select 1 from public.organization_memberships m where m.organization_id=new.organization_id
 and m.profile_id=new.profile_id and m.member_type=case when tg_table_name='customers' then 'customer' else 'driver' end)
 then raise exception 'Record does not match membership type' using errcode='23514'; end if;
 return new;
end $$;
alter table public.vehicles
 add column identifier text check(length(btrim(identifier)) between 1 and 60),
 add column vehicle_type text check(length(btrim(vehicle_type)) between 1 and 80),
 add column active boolean not null default false,
 add constraint active_vehicle_identified check(not active or (identifier is not null and vehicle_type is not null)),
 add constraint vehicles_org_identifier unique(organization_id,identifier);

alter table public.orders
 add column operational_status text not null default 'NOT_STARTED' check(operational_status in ('NOT_STARTED','IN_PROGRESS','EXCEPTION','COMPLETED')),
 add column operational_completed_at timestamptz,
 add constraint order_operational_completion check((operational_status='COMPLETED')=(operational_completed_at is not null));
alter table public.jobs
 add column reference text unique check(reference ~ '^J-N365-[0-9]{6}-[0-9]{6,}$'),
 add column status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','EXCEPTION','COMPLETED')),
 add column revision integer not null default 0 check(revision>=0),
 add column completed_at timestamptz,
 add constraint one_primary_job unique(organization_id,order_id),
 add constraint job_completion check((status='COMPLETED')=(completed_at is not null));
alter table public.trips
 add column reference text unique check(reference ~ '^T-N365-[0-9]{6}-[0-9]{6,}$'),
 add column status text not null default 'PLANNED' check(status in ('PLANNED','ASSIGNED','READY','EN_ROUTE_TO_PICKUP','AT_PICKUP','PICKUP_IN_PROGRESS','PICKED_UP','IN_TRANSIT','AT_DELIVERY','DELIVERY_IN_PROGRESS','DELIVERED','COMPLETED','CANCELLED','FAILED')),
 add column revision integer not null default 0 check(revision>=0),
 add column planned_start timestamptz,
 add column planned_end timestamptz,
 add column started_at timestamptz,
 add column completed_at timestamptz,
 add constraint trip_window check(planned_end>planned_start),
 add constraint trip_completion check((status='COMPLETED')=(completed_at is not null));
create index trips_dispatch_idx on public.trips(organization_id,status,planned_start);
alter table public.trip_stops
 add column kind text check(kind in ('PICKUP','DELIVERY')),
 add column address text check(length(btrim(address)) between 1 and 500),
 add column notes text not null default '' check(length(notes)<=1000),
 add column status text not null default 'PENDING' check(status in ('PENDING','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED')),
 add column arrived_at timestamptz,
 add column completed_at timestamptz,
 add constraint stop_completion check((status='COMPLETED')=(completed_at is not null));
create table public.trip_stop_dependencies(
 organization_id uuid not null,
 trip_id uuid not null,
 delivery_stop_id uuid not null,
 pickup_stop_id uuid not null,
 primary key(organization_id,trip_id,delivery_stop_id,pickup_stop_id),
 foreign key(organization_id,trip_id,delivery_stop_id) references public.trip_stops(organization_id,trip_id,id),
 foreign key(organization_id,trip_id,pickup_stop_id) references public.trip_stops(organization_id,trip_id,id),
 check(delivery_stop_id<>pickup_stop_id)
);
create index trip_dependencies_pickup_idx on public.trip_stop_dependencies(organization_id,trip_id,pickup_stop_id);
alter table public.assignments
 add column assigned_by uuid references public.profiles(id),
 add column ended_at timestamptz,
 add column execution_active boolean not null default false,
 add column reason text not null default '' check(length(reason)<=500),
 add constraint complete_operational_assignment check(assigned_by is null or (driver_id is not null and vehicle_id is not null and team_id is null)),
 add constraint execution_assignment_open check(not execution_active or (ended_at is null and driver_id is not null and vehicle_id is not null));
create unique index assignments_current_trip on public.assignments(organization_id,trip_id) where ended_at is null;
create unique index assignments_exclusive_driver on public.assignments(organization_id,driver_id) where execution_active;
create unique index assignments_exclusive_vehicle on public.assignments(organization_id,vehicle_id) where execution_active;
create index assignments_actor_idx on public.assignments(assigned_by);
alter table public.trip_events
 add column actor_id uuid references public.profiles(id),
 add column metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=2048);
create index trip_events_actor_idx on public.trip_events(actor_id);

-- Deliberately separate from generic files.read: signatures are operational private evidence.
create table public.trip_pods(
 id uuid primary key,
 organization_id uuid not null,
 trip_id uuid not null,
 object_name text not null unique,
 mime_type text not null check(mime_type in ('image/png','image/jpeg')),
 size_bytes integer not null check(size_bytes between 1 and 2097152),
 state text not null default 'PENDING' check(state in ('PENDING','REMOVING','FINAL')),
 recipient_name text not null check(length(btrim(recipient_name)) between 1 and 120),
 notes text not null default '' check(length(notes)<=500),
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 captured_at timestamptz,
 unique(organization_id,trip_id),
 unique(organization_id,id),
 foreign key(organization_id,trip_id) references public.trips(organization_id,id),
 check((state='FINAL')=(captured_at is not null))
);
create index trip_pods_actor_idx on public.trip_pods(actor_id);
create table private.operational_reference_counters(
 kind text not null check(kind in ('job','trip')), month text not null,
 value bigint not null check(value>0), primary key(kind,month)
);
create table private.operational_mutations(
 actor_id uuid not null references public.profiles(id), mutation_id uuid not null,
 organization_id uuid not null references public.organizations(id),
 intent jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_id,mutation_id)
);
revoke all on private.operational_reference_counters,private.operational_mutations from public,anon,authenticated;

create function private.protect_order_commercial() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['updated_at','operational_status','operational_completed_at'])
 is distinct from (to_jsonb(old)-array['updated_at','operational_status','operational_completed_at'])
 then raise exception 'Accepted Order commercial facts are immutable' using errcode='55000'; end if;
 return new;
end $$;
create trigger order_commercial_immutable before update on public.orders for each row execute function private.protect_order_commercial();
create function private.protect_operational_history() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and auth.uid() is null and current_setting('app.fixture_cleanup',true)='on' then return old; end if;
 if tg_table_name='trip_pods' and tg_op='DELETE' and to_jsonb(old)->>'state'='REMOVING' then return old; end if;
 if tg_table_name='trip_pods' and tg_op='UPDATE' and to_jsonb(old)->>'state'='PENDING' then
  if (to_jsonb(new)-array['state','captured_at'])=(to_jsonb(old)-array['state','captured_at']) then return new; end if;
 end if;
 raise exception 'Operational history is immutable' using errcode='55000';
end $$;
create trigger trip_event_immutable before update or delete on public.trip_events for each row execute function private.protect_operational_history();
create trigger trip_pod_immutable before update or delete on public.trip_pods for each row execute function private.protect_operational_history();
revoke all on function private.protect_order_commercial(),private.protect_operational_history() from public,anon,authenticated;

insert into public.permissions(code) values('operations.manage'),('dispatch.manage'),('fleet.manage'),('pod.read') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('SUPER_ADMIN','OPERATIONS','DISPATCHER') and p.code in ('operations.manage','dispatch.manage','fleet.manage','pod.read') on conflict do nothing;
alter table public.trip_stop_dependencies enable row level security;
alter table public.trip_pods enable row level security;
revoke all on public.trip_stop_dependencies,public.trip_pods from public,anon,authenticated;
grant select on public.trip_stop_dependencies,public.trip_pods to authenticated;
create policy dependencies_staff_read on public.trip_stop_dependencies for select to authenticated using(private.has_permission(organization_id,'trips.read'));
create policy pods_staff_read on public.trip_pods for select to authenticated using(private.has_permission(organization_id,'pod.read'));
