-- Final execution attribution uses stable assignment identity, not transaction timestamps.
create table private.completed_trip_assignments (
 trip_id uuid primary key references public.trips(id) on delete cascade,
 assignment_id uuid not null unique references public.assignments(id) on delete cascade
);
alter table private.completed_trip_assignments enable row level security;
revoke all on private.completed_trip_assignments from public,anon,authenticated;
-- Existing unambiguous records are retained. Ambiguous legacy attribution fails closed.
insert into private.completed_trip_assignments(trip_id,assignment_id)
 select t.id,(array_agg(a.id))[1] from public.trips t join public.assignments a
 on a.trip_id=t.id and a.ended_at=t.completed_at
 where t.status='COMPLETED' group by t.id having count(*)=1;
create function private.capture_completed_trip_assignment() returns trigger
 language plpgsql security definer set search_path='' as $$
declare assignment uuid;
begin
 if new.status='COMPLETED' and old.status is distinct from 'COMPLETED' then
  select id into strict assignment from public.assignments
   where trip_id=new.id and organization_id=new.organization_id and market_id=new.market_id and ended_at is null;
  insert into private.completed_trip_assignments(trip_id,assignment_id) values(new.id,assignment);
 end if;
 return new;
end $$;
revoke all on function private.capture_completed_trip_assignment() from public,anon,authenticated;
create trigger capture_completed_trip_assignment before update of status on public.trips
 for each row execute function private.capture_completed_trip_assignment();

create or replace function private.driver_trip_access(p_trip uuid,p_history boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trips t join public.assignments a on a.trip_id=t.id and a.organization_id=t.organization_id and a.market_id=t.market_id
 join public.drivers d on d.id=a.driver_id and d.organization_id=t.organization_id and d.market_id=t.market_id
 join public.vehicles v on v.id=a.vehicle_id and v.organization_id=t.organization_id and v.market_id=t.market_id
 where t.id=p_trip and d.id=private.internal_driver(t.organization_id) and
 ((a.ended_at is null and t.status not in ('COMPLETED','CANCELLED','FAILED') and v.active)
 or (p_history and t.status='COMPLETED' and exists(select 1 from private.completed_trip_assignments f where f.trip_id=t.id and f.assignment_id=a.id))))
$$;

-- Bound private issue presentation; attention remains authoritative even beyond the visible page.
create or replace function public.driver_trip(p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.trips; a public.assignments; result jsonb; live boolean;
begin
 if not private.driver_trip_access(p_trip,true) then raise exception 'Driver Trip unavailable' using errcode='42501'; end if;
 select * into t from public.trips where id=p_trip;
 live=t.status<>'COMPLETED';
 select * into a from public.assignments where trip_id=t.id and ((live and ended_at is null) or (not live and id=(select assignment_id from private.completed_trip_assignments where trip_id=t.id))) order by created_at desc limit 1;
 select jsonb_build_object('id',t.id,'reference',t.reference,'status',t.status,'revision',t.revision,'plannedStart',t.planned_start,'plannedEnd',t.planned_end,'completedAt',t.completed_at,
 'market',jsonb_build_object('id',m.id,'countryCode',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,'timezone',m.timezone),
 'vehicle',jsonb_build_object('identifier',v.identifier,'type',v.vehicle_type),
 'contact',case when live then (select jsonb_build_object('name',r.contact_name,'phone',r.contact_phone) from public.jobs j join public.orders o on o.id=j.order_id join public.requests r on r.id=o.request_id where j.id=t.job_id) else null end,
 'stops',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'position',s.position,'kind',s.kind,'status',s.status,'address',case when live then s.address else null end,'instructions',case when live then s.driver_instructions else '' end,'arrivedAt',s.arrived_at,'completedAt',s.completed_at) order by s.position) from public.trip_stops s where s.trip_id=t.id),'[]'::jsonb),
 'attention',live and exists(select 1 from public.issues where trip_id=t.id and status='OPEN'),
 'issues',case when live then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'stopId',i.stop_id,'category',i.category,'reason',i.reason,'status',i.status,'createdAt',i.created_at,'photoState',(select f.state from public.issue_photos f where f.issue_id=i.id)) order by i.created_at desc) from (select * from public.issues where trip_id=t.id order by (status='OPEN') desc,created_at desc,id limit 50) i),'[]'::jsonb) else '[]'::jsonb end,
 'pod', (select jsonb_build_object('id',p.id,'state',p.state,'capturedAt',p.captured_at,'own',p.actor_id=auth.uid()) from public.trip_pods p where p.trip_id=t.id)) into result
 from public.markets m join public.vehicles v on v.id=a.vehicle_id where m.id=t.market_id;
 return result;
end $$;
