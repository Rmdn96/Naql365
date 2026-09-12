-- SQL authorization and multi-Trip execution assertions; no surviving fixtures.
begin;
create function public.phase3_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Phase 3 assertion: %',label; end if; end $$;
insert into public.organizations(id,name) values('23000000-0000-4000-8000-000000000001','Phase 3 A'),('23000000-0000-4000-8000-000000000002','Phase 3 B');
insert into auth.users(id,email) values
 ('13000000-0000-4000-8000-000000000001','operations@example.invalid'),
 ('13000000-0000-4000-8000-000000000002','customer@example.invalid'),
 ('13000000-0000-4000-8000-000000000003','sales@example.invalid'),
 ('13000000-0000-4000-8000-000000000004','other-tenant@example.invalid'),
 ('13000000-0000-4000-8000-000000000005','other-customer@example.invalid');
insert into public.organization_memberships(organization_id,profile_id,member_type)
 select case when id='13000000-0000-4000-8000-000000000004' then '23000000-0000-4000-8000-000000000002'::uuid else '23000000-0000-4000-8000-000000000001'::uuid end,
 id,case when id in ('13000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000005') then 'customer' else 'staff' end
 from public.profiles where id::text like '13000000%';
insert into public.user_roles(organization_id,profile_id,role_id)
 select m.organization_id,m.profile_id,r.id from public.organization_memberships m join public.roles r on r.code=case
 when m.member_type='customer' then 'CUSTOMER' when m.profile_id='13000000-0000-4000-8000-000000000003' then 'SALES' else 'DISPATCHER' end
 where m.profile_id::text like '13000000%';
insert into public.customers(id,organization_id,profile_id) values('33000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000002');
insert into public.requests(id,organization_id,customer_id) values('53000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001');
insert into public.quotes(id,organization_id,request_id) values('63000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001');
insert into public.quote_versions(id,organization_id,quote_id,version,status,sent_at,expires_at,distance_km,distance_source,distance_verified_at)
 values('73000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',1,'ACCEPTED',now(),now()+interval '2 days',10,'MANUAL_VERIFIED',now());
insert into public.orders(id,organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,accepted_at)
 values('83000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','phase3','O-N365-202609-930001','53000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',10,'MANUAL_VERIFIED',now());
create function public.phase3_command(action text,entity uuid,payload jsonb default '{}') returns jsonb language plpgsql as $$
declare rev integer;
begin
 if action='create_trip' then select revision into rev from public.jobs where id=entity;
 else select revision into rev from public.trips where id=entity; end if;
 return public.operations_command('23000000-0000-4000-8000-000000000001',action,entity,coalesce(rev,0),gen_random_uuid(),payload);
end $$;
set local role authenticated;
do $$ declare uid uuid; begin
 foreach uid in array array['13000000-0000-4000-8000-000000000002'::uuid,'13000000-0000-4000-8000-000000000003'::uuid,'13000000-0000-4000-8000-000000000004'::uuid] loop
 perform set_config('request.jwt.claim.sub',uid::text,true);
 begin perform public.phase3_command('create_job','83000000-0000-4000-8000-000000000001'); raise exception 'Unauthorized Job creation'; exception when insufficient_privilege then null; end;
 begin insert into public.trip_events(organization_id,trip_id,event_type) values('23000000-0000-4000-8000-000000000001',gen_random_uuid(),'forged'); raise exception 'Forged event'; exception when insufficient_privilege then null; end;
 end loop;
end $$;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
do $$
declare j uuid; t1 uuid; t2 uuid; d1 uuid; d2 uuid; v1 uuid; v2 uuid; stop public.trip_stops; trip uuid; f uuid; pod jsonb; command jsonb; prior jsonb; mutation uuid=gen_random_uuid(); expected_revision integer; snapshot jsonb;
 plan jsonb=jsonb_build_object('plannedStart',now()+interval '1 hour','plannedEnd',now()+interval '5 hours','stops',
 '[{"kind":"PICKUP","address":"Synthetic pickup A","pickups":[]},{"kind":"PICKUP","address":"Synthetic pickup B","pickups":[]},{"kind":"DELIVERY","address":"Synthetic delivery A","pickups":[0,1]},{"kind":"DELIVERY","address":"Synthetic delivery B","pickups":[1]}]'::jsonb);
begin
 select to_jsonb(o)-array['updated_at','operational_status','operational_completed_at'] into snapshot from public.orders o where id='83000000-0000-4000-8000-000000000001';
 command=public.operations_command('23000000-0000-4000-8000-000000000001','create_job','83000000-0000-4000-8000-000000000001',0,mutation);
 prior=public.operations_command('23000000-0000-4000-8000-000000000001','create_job','83000000-0000-4000-8000-000000000001',0,mutation);
 perform public.phase3_assert(command=prior,'Job retry identity'); j=(command->>'id')::uuid;
 perform public.phase3_assert((public.phase3_command('create_job','83000000-0000-4000-8000-000000000001')->>'id')::uuid=j,'Exactly one primary Job');
 t1=(public.phase3_command('create_trip',j)->>'id')::uuid;
 t2=(public.phase3_command('create_trip',j)->>'id')::uuid;
 perform public.phase3_assert((select count(distinct reference)=2 from public.trips where job_id=j),'Unique references');
 d1=(public.phase3_command('create_driver',j,'{"type":"INTERNAL","name":"Internal fixture"}')->>'id')::uuid;
 d2=(public.phase3_command('create_driver',j,'{"type":"EXTERNAL","name":"External fixture"}')->>'id')::uuid;
 perform public.phase3_assert((select profile_id is null from public.drivers where id=d2),'External no Auth link');
 v1=(public.phase3_command('create_vehicle',j,'{"type":"Truck","identifier":"FIXTURE-A"}')->>'id')::uuid;
 v2=(public.phase3_command('create_vehicle',j,'{"type":"Truck","identifier":"FIXTURE-B"}')->>'id')::uuid;
 foreach trip in array array[t1,t2] loop
  perform public.phase3_command('plan',trip,plan);
  perform public.phase3_command('assign',trip,jsonb_build_object('driverId',d1,'vehicleId',v1));
  perform public.phase3_command('ready',trip);
 end loop;
 perform public.phase3_command('dispatch',t1);
 begin perform public.phase3_command('dispatch',t2); raise exception 'Resource conflict escaped'; exception when unique_violation then null; end;
 begin perform public.phase3_command('plan',t1,plan); raise exception 'Plan rewritten after start'; exception when object_not_in_prerequisite_state then null; end;
 begin perform public.phase3_command('complete_trip',t1); raise exception 'Incomplete stops accepted'; exception when object_not_in_prerequisite_state then null; end;
 begin perform public.phase3_command('reassign',t1,jsonb_build_object('driverId',d2,'vehicleId',v2)); raise exception 'No reason reassignment'; exception when invalid_parameter_value then null; end;
 perform public.phase3_command('reassign',t1,jsonb_build_object('driverId',d2,'vehicleId',v2,'reason','Controlled fixture replacement','confirmed',true));
 perform public.phase3_assert((select count(*)=2 from public.assignments where trip_id=t1),'Assignment history retained');
 perform public.phase3_assert((select count(*)=1 from public.assignments where trip_id=t1 and ended_at is null),'One current assignment');
 perform public.phase3_command('dispatch',t2);
 foreach trip in array array[t1,t2] loop
  select * into stop from public.trip_stops where trip_id=trip and kind='DELIVERY' order by position limit 1;
  begin perform public.phase3_command('complete_stop',trip,jsonb_build_object('stopId',stop.id)); raise exception 'Delivery before pickup'; exception when object_not_in_prerequisite_state then null; end;
  for stop in select * from public.trip_stops where trip_id=trip order by position loop
   if stop.position>0 then perform public.phase3_command('depart',trip,jsonb_build_object('stopId',stop.id)); end if;
   perform public.phase3_command('arrive',trip,jsonb_build_object('stopId',stop.id));
   perform public.phase3_command('start_service',trip,jsonb_build_object('stopId',stop.id));
   select revision into expected_revision from public.trips where id=trip;
   perform public.phase3_command('complete_stop',trip,jsonb_build_object('stopId',stop.id));
   begin perform public.operations_command('23000000-0000-4000-8000-000000000001','complete_stop',trip,expected_revision,gen_random_uuid(),jsonb_build_object('stopId',stop.id)); raise exception 'Stale transition'; exception when serialization_failure then null; end;
  end loop;
  begin perform public.phase3_command('complete_trip',trip); raise exception 'No POD completion'; exception when object_not_in_prerequisite_state then null; end;
  f=gen_random_uuid();
  pod=public.trip_pod_command(trip,f,'reserve','Fixture recipient','image/png',8);
  perform set_config('storage.operation','object.upload',true);
  insert into storage.objects(bucket_id,name,metadata) values('pod-files',pod->>'path','{"mimetype":"image/png","size":8}');
  pod=public.trip_pod_command(trip,f,'finalize');
  perform public.phase3_assert(pod->>'state'='FINAL','POD finalized');
  begin insert into storage.objects(bucket_id,name,metadata) values('pod-files',pod->>'path','{"mimetype":"image/png","size":8}'); raise exception 'Final signature overwritten'; exception when insufficient_privilege then null; end;
  perform public.phase3_command('complete_trip',trip);
  if trip=t1 then perform public.phase3_assert((select status<>'COMPLETED' from public.jobs where id=j),'First Trip cannot complete Job'); end if;
  begin perform public.phase3_command('assign',trip,jsonb_build_object('driverId',d1,'vehicleId',v1)); raise exception 'Completed Trip changed'; exception when object_not_in_prerequisite_state then null; end;
 end loop;
 perform public.phase3_assert((select status='COMPLETED' from public.jobs where id=j),'Whole Job completes');
 perform public.phase3_assert((select operational_status='COMPLETED' from public.orders where id='83000000-0000-4000-8000-000000000001'),'Whole Order completes');
 perform public.phase3_assert((select to_jsonb(o)-array['updated_at','operational_status','operational_completed_at']=snapshot from public.orders o where id='83000000-0000-4000-8000-000000000001'),'Commercial immutability');
 perform public.phase3_assert((select bool_and(actor_id='13000000-0000-4000-8000-000000000001') from public.trip_events where trip_id in(t1,t2)),'Staff actor distinct from external Driver');
 begin update public.trips set status='PLANNED' where id=t1; raise exception 'Arbitrary status write'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
select public.phase3_assert((public.customer_order_progress('83000000-0000-4000-8000-000000000001')->>'status')='COMPLETED','Customer own progress');
select public.phase3_assert((select count(*)=0 from public.trip_pods),'Customer cannot read POD');
select public.phase3_assert((select count(*)=0 from public.trip_events),'Customer cannot read internal events');
select public.phase3_assert((select count(*)=0 from storage.objects where bucket_id='pod-files'),'Customer cannot read signature');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000005',true);
do $$ begin begin perform public.customer_order_progress('83000000-0000-4000-8000-000000000001'); raise exception 'Cross-customer progress'; exception when insufficient_privilege then null; end; end $$;
reset role;
update public.organization_memberships set status='suspended' where profile_id='13000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
do $$ begin begin perform public.phase3_command('create_job','83000000-0000-4000-8000-000000000001'); raise exception 'Suspended access'; exception when insufficient_privilege then null; end; end $$;
rollback;
-- Supabase TAP report
begin;
select plan(1);
select pass('Phase 3 operational invariants completed');
select * from finish();
rollback;
