begin;
create function public.intake_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Intake assertion: %',label; end if; end $$;
create function public.intake_reject(command text, expected text) returns void language plpgsql as $$
begin
 begin execute command;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected rejection code: % instead of %',sqlstate,expected;
 end;
 raise exception 'Command unexpectedly accepted';
end $$;
insert into public.organizations(id,name) values('a0000000-0000-4000-8000-000000000001','Intake fixture A'),('a0000000-0000-4000-8000-000000000002','Intake fixture B');
-- Explicit synthetic catalogue for this rollback-only fixture; no production coverage.
insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code)
 select md5(id::text||'SA')::uuid,id,'SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966' from public.organizations;
insert into public.market_regions(id,organization_id,market_id,code,name_ar,name_en,administrative_type)
 select md5(id::text||'region')::uuid,organization_id,id,'fixture','منطقة اختبار','Fixture region','region' from public.markets;
insert into public.market_cities(id,organization_id,market_id,region_id,code,name_ar,name_en)
 select md5(m.id::text||c.code)::uuid,m.organization_id,m.id,r.id,c.code,c.name,c.name from public.markets m join public.market_regions r on r.market_id=m.id cross join (values('Riyadh','Riyadh'),('Jeddah','Jeddah')) c(code,name);

insert into private.customer_enrollment values(true,'a0000000-0000-4000-8000-000000000001') on conflict(singleton) do update set organization_id=excluded.organization_id;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('b0000000-0000-4000-8000-000000000001','intake-a@example.test',now(),'{"role":"SUPER_ADMIN"}'),
 ('b0000000-0000-4000-8000-000000000002','intake-b@example.test',now(),'{}'),
 ('b0000000-0000-4000-8000-000000000003','intake-c@example.test',now(),'{}'),
 ('b0000000-0000-4000-8000-000000000004','unconfirmed@example.test',null,'{}');
insert into public.services(id,organization_id,code,name_ar,name_en,active,property_required) values
 ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','furniture','نقل أثاث','Furniture',true,true),
 ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','goods','بضائع','Goods',true,false);
insert into public.market_services(organization_id,market_id,service_id,active) select s.organization_id,m.id,s.id,s.active from public.services s join public.markets m on m.organization_id=s.organization_id;
insert into public.service_areas(organization_id,market_id,service_id,city_id,active) select s.organization_id,s.market_id,s.service_id,c.id,true from public.market_services s join public.market_cities c on c.market_id=s.market_id;

insert into public.additional_services(id,organization_id,code,name_ar,name_en,active) values
 ('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','packing','تغليف','Packing',true);
create temporary table intake_state(key text primary key,value jsonb);
grant all on intake_state to authenticated;
set local role anon;
select public.intake_reject($q$select public.onboard_customer('Fixture','+966500000001','ar')$q$,'42501');
select public.intake_reject($q$select public.request_command('create',null,0,gen_random_uuid(),jsonb_build_object('market_id',md5('a0000000-0000-4000-8000-000000000001SA')::uuid))$q$,'42501');
select public.intake_reject('select * from public.requests','42501');
reset role;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select public.intake_reject($q$select public.onboard_customer('Fixture','+966500000001','ar')$q$,'42501');
reset role;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into intake_state values('customer',to_jsonb(public.onboard_customer('Fixture A','+966500000001','ar')));
select public.intake_assert(public.onboard_customer('Fixture A','+966500000001','ar')=(select (value#>>'{}')::uuid from intake_state where key='customer'),'onboarding retry');
select public.intake_assert(not public.has_permission('a0000000-0000-4000-8000-000000000001','portal.access'),'metadata no staff');
select public.intake_reject('update public.organization_memberships set member_type=''staff''','42501');
select public.intake_reject('insert into public.user_roles select organization_id,profile_id,role_id from public.user_roles','42501');
select public.intake_assert((select count(*)=1 from public.services),'customer sees only own active catalogue');
insert into intake_state values('draft',public.request_command('create',null,0,'d0000000-0000-4000-8000-000000000001',jsonb_build_object('market_id',md5('a0000000-0000-4000-8000-000000000001SA')::uuid)));
select public.intake_assert(public.request_command('create',null,0,'d0000000-0000-4000-8000-000000000001',jsonb_build_object('market_id',md5('a0000000-0000-4000-8000-000000000001SA')::uuid))=(select value from intake_state where key='draft'),'create retry one draft');
insert into intake_state values('payload',jsonb_build_object(
 'service_id','c0000000-0000-4000-8000-000000000001','description','Fixture shipment','notes','',
 'pickup',jsonb_build_object('city_id',md5(md5('a0000000-0000-4000-8000-000000000001SA')::uuid::text||'Riyadh')::uuid,'city','Riyadh','district','Fixture','address','Fixture pickup','notes','','floor',2,'elevator',true,'access_notes',''),
 'delivery',jsonb_build_object('city_id',md5(md5('a0000000-0000-4000-8000-000000000001SA')::uuid::text||'Jeddah')::uuid,'city','Jeddah','district','Fixture','address','Fixture delivery','notes','','floor',1,'elevator',false,'access_notes',''),
 'items','[{"description":"Box","quantity":2,"notes":""},{"description":"Desk","quantity":1,"notes":""}]'::jsonb,
 'additional_service_ids','["c0000000-0000-4000-8000-000000000003"]'::jsonb,
 'preferred_date',((now() at time zone 'Asia/Riyadh')::date+1)::text,'time_window','morning',
 'contact_name','Fixture A','contact_phone','+966500000001','contact_email','intake@example.test','contact_notes',''));
select public.intake_reject(format('select public.request_command(''submit'',%L,0,gen_random_uuid())',(select value->>'id' from intake_state where key='draft')),'22023');
select public.intake_reject(format('select public.request_command(''save'',%L,0,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft'),(select value||'{"organization_id":"a0000000-0000-4000-8000-000000000002"}'::jsonb from intake_state where key='payload')),'22023');
select public.intake_reject(format('select public.request_command(''save'',%L,0,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft'),(select value||'{"service_id":"c0000000-0000-4000-8000-000000000002"}'::jsonb from intake_state where key='payload')),'22023');
select public.intake_reject(format('select public.request_command(''save'',%L,0,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft'),(select jsonb_set(value,'{items,0,quantity}','0') from intake_state where key='payload')),'23514');
update intake_state set value=public.request_command('save',(value->>'id')::uuid,0,'d0000000-0000-4000-8000-000000000002',(select value from intake_state where key='payload')) where key='draft';
select public.intake_assert((select (value->>'revision')::int=1 from intake_state where key='draft'),'save revision');
select public.intake_assert((select count(*)=2 from public.request_items),'items persisted');
select public.intake_reject(format('select public.request_command(''save'',%L,0,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft'),(select value from intake_state where key='payload')),'PT409');
select public.intake_assert(public.request_command('save',(select (value->>'id')::uuid from intake_state where key='draft'),0,'d0000000-0000-4000-8000-000000000002',(select value from intake_state where key='payload'))=(select value from intake_state where key='draft'),'save retry stable');
select public.intake_reject('update public.requests set organization_id=''a0000000-0000-4000-8000-000000000002''','42501');
select public.intake_reject('update public.requests set customer_id=gen_random_uuid()','42501');
select public.intake_reject('update public.requests set reference=''N365-202609-000999'',status=''SUBMITTED'',submitted_at=now()','42501');
select public.intake_reject('insert into public.audit_logs(action,entity_type) values(''forged'',''requests'')','42501');
insert into intake_state values('file',public.request_file_command('reserve',(select (value->>'id')::uuid from intake_state where key='draft'),'e0000000-0000-4000-8000-000000000001','image/png',8));
select public.intake_reject(format('select public.request_file_command(''finalize'',%L,''e0000000-0000-4000-8000-000000000001'')',(select value->>'id' from intake_state where key='draft')),'22023');
reset role;
insert into storage.objects(bucket_id,name,metadata) select 'attachments',value->>'path','{"size":8,"mimetype":"image/png"}' from intake_state where key='file';
set local role authenticated;
select public.request_file_command('finalize',(select (value->>'id')::uuid from intake_state where key='draft'),'e0000000-0000-4000-8000-000000000001');
select public.intake_assert((select count(*)=1 from storage.objects),'ready private file read');
reset role;
-- Storage completes uploads using its privileged connection but retains the end-user identity.
-- Even that completion cannot replace a finalized image after a competing upload wins.
select public.intake_reject($q$update storage.objects set metadata='{"size":8,"mimetype":"image/png"}' where bucket_id='attachments'$q$,'42501');
set local role authenticated;
update intake_state set value=public.request_command('submit',(value->>'id')::uuid,3,gen_random_uuid()) where key='draft';
select public.intake_assert((select value->>'status'='SUBMITTED' and value->>'reference' ~ '^N365-[0-9]{6}-[0-9]{6,}$' from intake_state where key='draft'),'reference and state');
select public.intake_assert(public.request_command('submit',(select (value->>'id')::uuid from intake_state where key='draft'),0,gen_random_uuid())=(select value from intake_state where key='draft'),'submit retry stable');
select public.intake_reject(format('select public.request_command(''save'',%L,4,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft'),(select value from intake_state where key='payload')),'55000');
select public.intake_reject(format('select public.request_command(''cancel'',%L,4,gen_random_uuid())',(select value->>'id' from intake_state where key='draft')),'55000');
select public.intake_reject(format('select public.request_file_command(''remove'',%L,''e0000000-0000-4000-8000-000000000001'')',(select value->>'id' from intake_state where key='draft')),'55000');
reset role;
select public.intake_assert((select count(*)=1 from public.audit_logs where action='request.submitted' and entity_id=(select (value->>'id')::uuid from intake_state where key='draft')),'one submission audit');
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.onboard_customer('Fixture B','+966500000002','en');
select public.intake_assert((select count(*)=0 from public.requests),'customer isolation');
select public.intake_assert((select count(*)=0 from public.request_attachments),'attachment isolation');
select public.intake_assert((select count(*)=0 from storage.objects),'file isolation');
select public.intake_reject(format('select public.request_command(''save'',%L,4,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft'),(select value from intake_state where key='payload')),'42501');
insert into intake_state values('draft_b',public.request_command('create',null,0,gen_random_uuid(),jsonb_build_object('market_id',md5('a0000000-0000-4000-8000-000000000001SA')::uuid)));
select public.intake_reject(format('select public.request_file_command(''finalize'',%L,''e0000000-0000-4000-8000-000000000001'')',(select value->>'id' from intake_state where key='draft_b')),'42501');
select public.request_command('cancel',(select (value->>'id')::uuid from intake_state where key='draft_b'),0,gen_random_uuid());
select public.intake_reject(format('select public.request_command(''save'',%L,1,gen_random_uuid(),%L)',(select value->>'id' from intake_state where key='draft_b'),(select value from intake_state where key='payload')),'55000');
reset role;
update private.customer_enrollment set organization_id='a0000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.onboard_customer('Fixture C','+966500000003','ar');
select public.intake_assert((select count(*)=0 from public.requests),'tenant isolation');
select public.intake_reject(format('select public.request_command(''submit'',%L,0,gen_random_uuid())',(select value->>'id' from intake_state where key='draft')),'42501');
reset role;
update public.organization_memberships set status='suspended' where profile_id='b0000000-0000-4000-8000-000000000001';
update private.customer_enrollment set organization_id='a0000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.intake_assert((select count(*)=0 from public.requests),'suspended reads denied');
select public.intake_assert((select count(*)=0 from storage.objects),'suspended file denied');
select public.intake_reject($q$select public.onboard_customer('Fixture A','+966500000001','ar')$q$,'42501');
select public.intake_reject($q$select public.request_command('create',null,0,gen_random_uuid(),jsonb_build_object('market_id',md5('a0000000-0000-4000-8000-000000000001SA')::uuid))$q$,'42501');
reset role;
rollback;
-- Supabase TAP report
begin;
select plan(1);
select pass('Customer onboarding, request writes, submission, attachments and negative authorization assertions completed');
select * from finish();
rollback;
