-- Bound private issue presentation; attention remains authoritative even beyond the visible page.
create or replace function public.driver_trip(p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.trips; a public.assignments; result jsonb; live boolean;
begin
 if not private.driver_trip_access(p_trip,true) then raise exception 'Driver Trip unavailable' using errcode='42501'; end if;
 select * into t from public.trips where id=p_trip;
 live=t.status<>'COMPLETED';
 select * into a from public.assignments where trip_id=t.id and (ended_at is null or ended_at=t.completed_at) order by created_at desc limit 1;
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
