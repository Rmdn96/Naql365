create table private.driver_mutations(
 actor_id uuid not null references public.profiles(id), mutation_id uuid not null,
 intent jsonb not null, result jsonb not null, primary key(actor_id,mutation_id)
);
revoke all on private.driver_mutations from public,anon,authenticated;

create function public.driver_trip(p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 'issues',case when live then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'stopId',i.stop_id,'category',i.category,'reason',i.reason,'status',i.status,'createdAt',i.created_at) order by i.created_at desc) from public.issues i where i.trip_id=t.id),'[]'::jsonb) else '[]'::jsonb end,
 'pod', (select jsonb_build_object('id',p.id,'state',p.state,'capturedAt',p.captured_at,'own',p.actor_id=auth.uid()) from public.trip_pods p where p.trip_id=t.id)) into result
 from public.markets m join public.vehicles v on v.id=a.vehicle_id where m.id=t.market_id;
 return result;
end $$;
create function public.driver_trips(p_view text default 'today',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_view is null or p_view not in ('today','upcoming','completed') or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid list' using errcode='22023'; end if;
 if public.driver_identity()='[]'::jsonb then raise exception 'Driver identity required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(public.driver_trip(c.id) order by c.sort_time,c.id),'[]'::jsonb) into result from (
  select t.id,case when p_view='completed' then -extract(epoch from t.completed_at) else coalesce(extract(epoch from t.planned_start),0) end as sort_time
  from public.trips t join public.markets m on m.id=t.market_id where private.driver_trip_access(t.id,p_view='completed') and
  ((p_view='completed' and t.status='COMPLETED') or (p_view='today' and t.status not in ('COMPLETED','FAILED','CANCELLED') and (t.planned_start is null or (t.planned_start at time zone m.timezone)::date<=(now() at time zone m.timezone)::date))
   or (p_view='upcoming' and t.status not in ('COMPLETED','FAILED','CANCELLED') and (t.planned_start at time zone m.timezone)::date>(now() at time zone m.timezone)::date))
  order by sort_time,t.id limit 20 offset p_offset
 ) c;
 return result;
end $$;
revoke all on function public.driver_trip(uuid),public.driver_trips(text,integer) from public,anon,authenticated;
grant execute on function public.driver_trip(uuid),public.driver_trips(text,integer) to authenticated;

create function public.report_driver_issue(p_trip uuid,p_stop uuid,p_category text,p_reason text,p_mutation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.trips; i public.issues; request uuid;
begin
 select * into t from public.trips where id=p_trip;
 if not found or auth.uid() is null then raise exception 'Trip unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,33));
 perform pg_advisory_xact_lock(hashtextextended(t.organization_id::text,34));
 if not private.driver_trip_access(t.id,false) then raise exception 'Assignment required' using errcode='42501'; end if;
 if p_mutation is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 or p_category is null or p_category not in ('CUSTOMER_UNAVAILABLE','ADDRESS_ISSUE','ACCESS_BLOCKED','ITEM_NOT_READY','VEHICLE_ISSUE','DAMAGE_CONCERN','OTHER')
 or not exists(select 1 from public.trip_stops where id=p_stop and trip_id=t.id) then raise exception 'Invalid issue' using errcode='22023'; end if;
 select * into i from public.issues where actor_id=auth.uid() and mutation_id=p_mutation;
 if found then
  if i.trip_id<>p_trip or i.stop_id<>p_stop or i.category<>p_category or i.reason<>btrim(p_reason) then raise exception 'Issue retry differs' using errcode='22023'; end if;
  return jsonb_build_object('id',i.id);
 end if;
 if exists(select 1 from public.trip_stops where id=p_stop and status='COMPLETED') then raise exception 'Stop already completed' using errcode='55000'; end if;
 select o.request_id into request from public.jobs j join public.orders o on o.id=j.order_id where j.id=t.job_id;
 insert into public.issues(organization_id,market_id,request_id,trip_id,stop_id,actor_id,category,reason,mutation_id)
 values(t.organization_id,t.market_id,request,t.id,p_stop,auth.uid(),p_category,btrim(p_reason),p_mutation) returning * into i;
 update public.trips set revision=revision+1 where id=t.id;
 perform private.operational_event(t.organization_id,t.id,'ISSUE_REPORTED',p_stop,jsonb_build_object('issue_id',i.id,'category',i.category));
 return jsonb_build_object('id',i.id);
end $$;
create function public.resolve_driver_issue(p_issue uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.issues;
begin
 select * into i from public.issues where id=p_issue and trip_id is not null;
 if not found or not private.has_permission(i.organization_id,'dispatch.manage') then raise exception 'Operations required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(i.organization_id::text,34));
 select * into i from public.issues where id=p_issue for update;
 if not private.has_permission(i.organization_id,'dispatch.manage') then raise exception 'Operations required' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'Resolution reason required' using errcode='22023'; end if;
 if i.status='RESOLVED' then
  if i.resolved_by<>auth.uid() or i.resolution<>btrim(p_reason) then raise exception 'Resolution immutable' using errcode='55000'; end if;
  return jsonb_build_object('id',i.id);
 end if;
 update public.issues set status='RESOLVED',resolved_by=auth.uid(),resolved_at=now(),resolution=btrim(p_reason) where id=i.id;
 update public.trips set revision=revision+1 where id=i.trip_id;
 perform private.operational_event(i.organization_id,i.trip_id,'ISSUE_RESOLVED',i.stop_id,jsonb_build_object('issue_id',i.id));
 return jsonb_build_object('id',i.id);
end $$;
revoke all on function public.report_driver_issue(uuid,uuid,text,text,uuid),public.resolve_driver_issue(uuid,text) from public,anon,authenticated;
grant execute on function public.report_driver_issue(uuid,uuid,text,text,uuid),public.resolve_driver_issue(uuid,text) to authenticated;

-- Milestone wrapper binds optional location to the event generated in this transaction.
-- Mutations remain in the accepted engine; wrapper replay includes optional evidence intent.
create function public.driver_execute(p_trip uuid,p_action text,p_revision integer,p_mutation uuid,p_payload jsonb default '{}',p_location jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.trips; old_events uuid[]; e uuid; prior private.driver_mutations; intent jsonb; result jsonb;
begin
 select * into t from public.trips where id=p_trip;
 if not found or auth.uid() is null or p_mutation is null then raise exception 'Driver assignment required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,33));
 perform pg_advisory_xact_lock(hashtextextended(t.organization_id::text,34));
 if not private.driver_action_allowed(t.organization_id,t.id,p_action,p_payload) then raise exception 'Driver command denied' using errcode='42501'; end if;
 if p_location is not null and p_location<>'null'::jsonb and p_action<>'arrive' then raise exception 'Location milestone unsupported' using errcode='22023'; end if;
 intent=jsonb_build_object('trip',p_trip,'action',p_action,'revision',p_revision,'payload',p_payload,'location',p_location);
 select * into prior from private.driver_mutations where actor_id=auth.uid() and mutation_id=p_mutation;
 if found then
  if prior.intent<>intent then raise exception 'Retry intent differs' using errcode='22023'; end if;
  return prior.result;
 end if;
 select coalesce(array_agg(id),'{}') into old_events from public.trip_events where trip_id=t.id;
 result=public.operations_command(t.organization_id,p_action,t.id,p_revision,p_mutation,p_payload);
 if p_location is not null and p_location<>'null'::jsonb then
  select id into e from public.trip_events where trip_id=t.id and actor_id=auth.uid() and event_type='ARRIVE' and not(id=any(old_events));
  if e is null then raise exception 'No new arrival milestone' using errcode='22023'; end if;
  perform private.record_event_location(e,p_location);
 end if;
 insert into private.driver_mutations values(auth.uid(),p_mutation,intent,result);
 return result;
end $$;
revoke all on function public.driver_execute(uuid,text,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.driver_execute(uuid,text,integer,uuid,jsonb,jsonb) to authenticated;
