-- Short tenant-scoped command transactions serialize aggregate/resource changes. Unique
-- constraints additionally protect exclusive assignments and one primary Job per Order.
create function private.next_operational_reference(p_kind text) returns text
language plpgsql set search_path='' as $$
declare m text=to_char(now() at time zone 'Asia/Riyadh','YYYYMM'); n bigint;
begin
 insert into private.operational_reference_counters(kind,month,value) values(p_kind,m,1)
 on conflict(kind,month) do update set value=private.operational_reference_counters.value+1 returning value into n;
 return case p_kind when 'job' then 'J' else 'T' end||'-N365-'||m||'-'||lpad(n::text,greatest(6,length(n::text)),'0');
end $$;
create function private.operational_event(p_org uuid,p_trip uuid,p_action text,p_stop uuid default null,p_facts jsonb default '{}') returns void
language plpgsql set search_path='' as $$
begin
 insert into public.trip_events(organization_id,trip_id,event_type,stop_id,actor_id,metadata)
 values(p_org,p_trip,p_action,p_stop,auth.uid(),p_facts);
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(p_org,auth.uid(),p_action,'trips',p_trip,p_facts);
end $$;
create function private.refresh_job_progress(p_job uuid) returns void language plpgsql set search_path='' as $$
declare j public.jobs; next_status text;
begin
 select * into strict j from public.jobs where id=p_job for update;
 select case
 when not exists(select 1 from public.trips where job_id=j.id) then 'OPEN'
 when exists(select 1 from public.trips where job_id=j.id and status in ('FAILED','CANCELLED')) then 'EXCEPTION'
 when not exists(select 1 from public.trips where job_id=j.id and status<>'COMPLETED') then 'COMPLETED'
 else 'IN_PROGRESS' end into next_status;
 if j.status<>next_status then
  update public.jobs set status=next_status,revision=revision+1,completed_at=case when next_status='COMPLETED' then now() end where id=j.id;
  update public.orders set operational_status=case when next_status='OPEN' then 'IN_PROGRESS' else next_status end,
   operational_completed_at=case when next_status='COMPLETED' then now() end where id=j.order_id;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(j.organization_id,auth.uid(),'JOB_'||next_status,'jobs',j.id,jsonb_build_object('status',next_status));
  if next_status='COMPLETED' then
   insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) values(j.organization_id,auth.uid(),'ORDER_OPERATIONALLY_COMPLETED','orders',j.order_id);
  end if;
 end if;
end $$;
create function private.validate_trip_plan(p_trip uuid) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.trip_stops where trip_id=p_trip and kind='PICKUP')
 or not exists(select 1 from public.trip_stops where trip_id=p_trip and kind='DELIVERY')
 or exists(select 1 from public.trip_stops where trip_id=p_trip and (kind is null or address is null))
 or (select kind from public.trip_stops where trip_id=p_trip order by position limit 1)<>'PICKUP'
 or (select kind from public.trip_stops where trip_id=p_trip order by position desc limit 1)<>'DELIVERY'
 or exists(select 1 from public.trip_stops s where s.trip_id=p_trip and s.kind='DELIVERY' and not exists(select 1 from public.trip_stop_dependencies d where d.delivery_stop_id=s.id))
 or exists(select 1 from public.trip_stop_dependencies d join public.trip_stops pickup on pickup.id=d.pickup_stop_id
 join public.trip_stops delivery on delivery.id=d.delivery_stop_id where d.trip_id=p_trip and
 (pickup.kind<>'PICKUP' or delivery.kind<>'DELIVERY' or pickup.position>=delivery.position))
 then raise exception 'Incomplete or invalid stop dependencies' using errcode='22023'; end if;
end $$;

create function public.operations_command(p_organization_id uuid,p_action text,p_entity_id uuid,p_revision integer,p_mutation_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 required_permission text; intent jsonb; prior private.operational_mutations; result jsonb;
 j public.jobs; t public.trips; s public.trip_stops; a public.assignments; o public.orders;
 new_id uuid; item jsonb; dependency jsonb; pos integer; did uuid; vid uuid; why text;
 next_status text; actor uuid=auth.uid(); facts jsonb='{}';
begin
 required_permission=case when p_action in ('create_driver','create_vehicle','set_driver_active','set_vehicle_active') then 'fleet.manage'
 when p_action in ('assign','reassign','ready','dispatch','arrive','start_service','complete_stop','depart','complete_trip','cancel','fail') then 'dispatch.manage' else 'operations.manage' end;
 if actor is null or not private.has_permission(p_organization_id,required_permission) then raise exception 'Operational access denied' using errcode='42501'; end if;
 if p_mutation_id is null or p_entity_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768
 then raise exception 'Invalid command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_mutation_id::text,33));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,34));
 intent=jsonb_build_object('action',p_action,'entity',p_entity_id,'revision',p_revision,'payload',p_payload);
 select * into prior from private.operational_mutations where actor_id=actor and mutation_id=p_mutation_id;
 if found then
  if prior.organization_id<>p_organization_id or prior.intent<>intent then raise exception 'Mutation identity reused' using errcode='22023'; end if;
  return prior.result;
 end if;
 if p_action in ('create_driver','create_vehicle') then
  new_id=gen_random_uuid();
  if p_action='create_driver' then
   if p_payload->>'type' is null or nullif(btrim(p_payload->>'name'),'') is null then raise exception 'Driver facts required' using errcode='22023'; end if;
   insert into public.drivers(id,organization_id,driver_type,display_name,active)
    values(new_id,p_organization_id,p_payload->>'type',btrim(p_payload->>'name'),true);
  else
   if nullif(btrim(p_payload->>'identifier'),'') is null or nullif(btrim(p_payload->>'type'),'') is null then raise exception 'Vehicle facts required' using errcode='22023'; end if;
   insert into public.vehicles(id,organization_id,identifier,vehicle_type,active)
    values(new_id,p_organization_id,btrim(p_payload->>'identifier'),btrim(p_payload->>'type'),true);
  end if;
  result=jsonb_build_object('id',new_id,'revision',0);
 elsif p_action in ('set_driver_active','set_vehicle_active') then
  if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Active flag required' using errcode='22023'; end if;
  if exists(select 1 from public.assignments where organization_id=p_organization_id and execution_active and
   ((p_action='set_driver_active' and driver_id=p_entity_id) or (p_action='set_vehicle_active' and vehicle_id=p_entity_id)))
  then raise exception 'Executing resource cannot be deactivated' using errcode='55000'; end if;
  if p_action='set_driver_active' then update public.drivers set active=(p_payload->>'active')::boolean where id=p_entity_id and organization_id=p_organization_id;
  else update public.vehicles set active=(p_payload->>'active')::boolean where id=p_entity_id and organization_id=p_organization_id; end if;
  if not found then raise exception 'Resource unavailable' using errcode='42501'; end if;
  result=jsonb_build_object('id',p_entity_id,'revision',0);
 elsif p_action='create_job' then
  select * into o from public.orders where id=p_entity_id and organization_id=p_organization_id for update;
  if not found or o.accepted_at is null or not exists(select 1 from public.quote_versions where id=o.accepted_quote_version_id and status='ACCEPTED')
  then raise exception 'Accepted Order required' using errcode='42501'; end if;
  select * into j from public.jobs where organization_id=p_organization_id and order_id=o.id;
  if not found then
   insert into public.jobs(organization_id,order_id,reference) values(p_organization_id,o.id,private.next_operational_reference('job')) returning * into j;
   update public.orders set operational_status='IN_PROGRESS' where id=o.id;
  end if;
  result=jsonb_build_object('id',j.id,'revision',j.revision);
 elsif p_action='create_trip' then
  select * into j from public.jobs where id=p_entity_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Job unavailable' using errcode='42501'; end if;
  if j.status='COMPLETED' then raise exception 'Job complete' using errcode='55000'; end if;
  if p_revision is distinct from j.revision then raise exception 'Job changed' using errcode='40001'; end if;
  insert into public.trips(organization_id,job_id,reference) values(p_organization_id,j.id,private.next_operational_reference('trip')) returning * into t;
  update public.jobs set revision=revision+1 where id=j.id;
  perform private.operational_event(p_organization_id,t.id,'TRIP_CREATED');
  perform private.refresh_job_progress(j.id);
  result=jsonb_build_object('id',t.id,'revision',t.revision);
 else
  select * into t from public.trips where id=p_entity_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
  perform 1 from public.jobs where id=t.job_id for update;
  if p_revision is distinct from t.revision then raise exception 'Trip changed' using errcode='40001'; end if;
  if t.status in ('COMPLETED','CANCELLED','FAILED') then raise exception 'Terminal Trip' using errcode='55000'; end if;
  next_status=t.status;
  if p_action='plan' then
   if t.started_at is not null then raise exception 'Execution plan frozen' using errcode='55000'; end if;
   if jsonb_typeof(p_payload->'stops') is distinct from 'array' or jsonb_array_length(p_payload->'stops') not between 2 and 40
    or p_payload->>'plannedStart' is null or p_payload->>'plannedEnd' is null
    then raise exception 'Bounded stop plan and window required' using errcode='22023'; end if;
   delete from public.trip_stop_dependencies where trip_id=t.id;
   delete from public.trip_stops where trip_id=t.id;
   pos=0;
   for item in select value from jsonb_array_elements(p_payload->'stops') loop
    if item->>'kind' is null or nullif(btrim(item->>'address'),'') is null then raise exception 'Stop facts required' using errcode='22023'; end if;
    insert into public.trip_stops(organization_id,trip_id,position,kind,address,notes)
     values(p_organization_id,t.id,pos,item->>'kind',btrim(item->>'address'),coalesce(item->>'notes',''));
    pos=pos+1;
   end loop;
   pos=0;
   for item in select value from jsonb_array_elements(p_payload->'stops') loop
    if jsonb_typeof(item->'pickups') is distinct from 'array' then raise exception 'Pickup dependencies required' using errcode='22023'; end if;
    for dependency in select value from jsonb_array_elements(item->'pickups') loop
     select id into did from public.trip_stops where trip_id=t.id and position=(dependency#>>'{}')::integer;
     select id into vid from public.trip_stops where trip_id=t.id and position=pos;
     insert into public.trip_stop_dependencies values(p_organization_id,t.id,vid,did);
    end loop;
    pos=pos+1;
   end loop;
   perform private.validate_trip_plan(t.id);
   update public.trips set planned_start=(p_payload->>'plannedStart')::timestamptz,planned_end=(p_payload->>'plannedEnd')::timestamptz where id=t.id;
   next_status=case when exists(select 1 from public.assignments where trip_id=t.id and ended_at is null) then 'ASSIGNED' else 'PLANNED' end;
   facts=jsonb_build_object('stop_count',pos);
  elsif p_action in ('assign','reassign') then
   if (p_action='assign' and t.started_at is not null) or (p_action='reassign' and t.started_at is null)
   then raise exception 'Use appropriate assignment action' using errcode='55000'; end if;
   why=coalesce(btrim(p_payload->>'reason'),'');
   if p_action='reassign' and (length(why) not between 1 and 500 or p_payload->'confirmed' is distinct from 'true'::jsonb)
   then raise exception 'Confirmed emergency reason required' using errcode='22023'; end if;
   did=(p_payload->>'driverId')::uuid; vid=(p_payload->>'vehicleId')::uuid;
   if not exists(select 1 from public.drivers where id=did and organization_id=p_organization_id and active)
    or not exists(select 1 from public.vehicles where id=vid and organization_id=p_organization_id and active)
   then raise exception 'Active same-tenant resources required' using errcode='42501'; end if;
   select * into a from public.assignments where trip_id=t.id and ended_at is null for update;
   if found and a.driver_id=did and a.vehicle_id=vid then raise exception 'Assignment unchanged' using errcode='22023'; end if;
   update public.assignments set ended_at=now(),execution_active=false where trip_id=t.id and ended_at is null;
   insert into public.assignments(organization_id,trip_id,driver_id,vehicle_id,assigned_by,reason,execution_active)
    values(p_organization_id,t.id,did,vid,actor,why,t.started_at is not null);
   next_status=case when t.started_at is null then 'ASSIGNED' else t.status end;
   facts=jsonb_build_object('previous_assignment',a.id,'driver_id',did,'vehicle_id',vid,'reason',why);
  elsif p_action='ready' then
   if t.status<>'ASSIGNED' or t.planned_start is null or t.planned_end is null then raise exception 'Assigned and scheduled Trip required' using errcode='55000'; end if;
   perform private.validate_trip_plan(t.id);
   if not exists(select 1 from public.assignments candidate join public.drivers d on d.id=candidate.driver_id join public.vehicles v on v.id=candidate.vehicle_id
    where candidate.trip_id=t.id and candidate.ended_at is null and d.active and v.active)
   then raise exception 'Active resources required' using errcode='55000'; end if;
   next_status='READY';
  elsif p_action='dispatch' then
   if t.status<>'READY' then raise exception 'Ready Trip required' using errcode='55000'; end if;
   perform private.validate_trip_plan(t.id);
   if not exists(select 1 from public.assignments candidate join public.drivers d on d.id=candidate.driver_id join public.vehicles v on v.id=candidate.vehicle_id
    where candidate.trip_id=t.id and candidate.ended_at is null and d.active and v.active)
   then raise exception 'Active resources required' using errcode='55000'; end if;
   update public.assignments set execution_active=true where trip_id=t.id and ended_at is null;
   select * into s from public.trip_stops where trip_id=t.id order by position limit 1;
   update public.trip_stops set status='EN_ROUTE' where id=s.id;
   update public.trips set started_at=now() where id=t.id;
   next_status='EN_ROUTE_TO_PICKUP';
  elsif p_action in ('arrive','start_service','complete_stop','depart') then
   if t.started_at is null then raise exception 'Dispatch required' using errcode='55000'; end if;
   select * into s from public.trip_stops where trip_id=t.id and status<>'COMPLETED' order by position limit 1 for update;
   if not found or s.id is distinct from (p_payload->>'stopId')::uuid then raise exception 'Current Stop required' using errcode='55000'; end if;
   if s.kind='DELIVERY' and exists(select 1 from public.trip_stop_dependencies dep join public.trip_stops pickup on pickup.id=dep.pickup_stop_id where dep.delivery_stop_id=s.id and pickup.status<>'COMPLETED')
    then raise exception 'Pickup dependencies incomplete' using errcode='55000'; end if;
   if p_action='depart' and s.status='PENDING' then
    update public.trip_stops set status='EN_ROUTE' where id=s.id;
    next_status=case when s.kind='PICKUP' then 'EN_ROUTE_TO_PICKUP' else 'IN_TRANSIT' end;
   elsif p_action='arrive' and s.status='EN_ROUTE' then
    update public.trip_stops set status='ARRIVED',arrived_at=now() where id=s.id;
    next_status=case when s.kind='PICKUP' then 'AT_PICKUP' else 'AT_DELIVERY' end;
   elsif p_action='start_service' and s.status='ARRIVED' then
    update public.trip_stops set status='IN_PROGRESS' where id=s.id;
    next_status=case when s.kind='PICKUP' then 'PICKUP_IN_PROGRESS' else 'DELIVERY_IN_PROGRESS' end;
   elsif p_action='complete_stop' and s.status='IN_PROGRESS' then
    update public.trip_stops set status='COMPLETED',completed_at=now() where id=s.id;
    next_status=case when s.kind='PICKUP' then 'PICKED_UP' else 'DELIVERED' end;
   else raise exception 'Invalid Stop transition' using errcode='55000'; end if;
  elsif p_action='complete_trip' then
   if t.status<>'DELIVERED' or not exists(select 1 from public.trip_stops where trip_id=t.id)
    or exists(select 1 from public.trip_stops where trip_id=t.id and status<>'COMPLETED')
    or not exists(select 1 from public.trip_pods where trip_id=t.id and state='FINAL')
    then raise exception 'Completed Stops and final POD required' using errcode='55000'; end if;
   next_status='COMPLETED';
   update public.trips set status='COMPLETED',completed_at=now() where id=t.id;
   update public.assignments set execution_active=false,ended_at=now() where trip_id=t.id and ended_at is null;
  elsif p_action in ('cancel','fail') then
   why=btrim(p_payload->>'reason');
   if why is null or length(why) not between 1 and 500 then raise exception 'Exception reason required' using errcode='22023'; end if;
   next_status=case p_action when 'cancel' then 'CANCELLED' else 'FAILED' end;
   update public.assignments set execution_active=false,ended_at=now() where trip_id=t.id and ended_at is null;
   facts=jsonb_build_object('reason',why);
  else raise exception 'Unsupported operational action' using errcode='22023'; end if;
  update public.trips set status=next_status,revision=revision+1 where id=t.id returning * into t;
  perform private.operational_event(p_organization_id,t.id,upper(p_action),s.id,facts);
  perform private.refresh_job_progress(t.job_id);
  result=jsonb_build_object('id',t.id,'revision',t.revision,'status',t.status);
 end if;
 if p_action in ('create_driver','create_vehicle','set_driver_active','set_vehicle_active','create_job') then
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
  values(p_organization_id,actor,upper(p_action),case when p_action='create_job' then 'jobs' else 'resources' end,(result->>'id')::uuid);
 end if;
 insert into private.operational_mutations(actor_id,mutation_id,organization_id,intent,result) values(actor,p_mutation_id,p_organization_id,intent,result);
 return result;
end $$;
revoke all on function private.next_operational_reference(text),private.operational_event(uuid,uuid,text,uuid,jsonb),private.refresh_job_progress(uuid),private.validate_trip_plan(uuid) from public,anon,authenticated;
revoke all on function public.operations_command(uuid,text,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.operations_command(uuid,text,uuid,integer,uuid,jsonb) to authenticated;
