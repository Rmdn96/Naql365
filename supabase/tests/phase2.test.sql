-- Shared Phase 2 executable assertions. Fixtures are rolled back.
begin;
create function public.phase2_assert(condition boolean,label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Phase 2 assertion failed: %',label; end if; end $$;

insert into auth.users(id,email,email_confirmed_at) values
 ('11000000-0000-4000-8000-000000000001','sales-a@example.invalid',now()),
 ('11000000-0000-4000-8000-000000000002','customer-a@example.invalid',now()),
 ('11000000-0000-4000-8000-000000000003','customer-b@example.invalid',now()),
 ('11000000-0000-4000-8000-000000000004','staff-no-pricing@example.invalid',now()),
 ('11000000-0000-4000-8000-000000000005','sales-b@example.invalid',now());
insert into public.organizations(id,name) values
 ('21000000-0000-4000-8000-000000000001','Phase 2 A'),
 ('21000000-0000-4000-8000-000000000002','Phase 2 B');
insert into public.organization_memberships(organization_id,profile_id,member_type) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','staff'),
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','customer'),
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003','customer'),
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000004','staff'),
 ('21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000005','staff');
insert into public.user_roles(organization_id,profile_id,role_id)
 select m.organization_id,m.profile_id,r.id from public.organization_memberships m join public.roles r on r.code=case
  when m.profile_id='11000000-0000-4000-8000-000000000001' then 'SALES'
  when m.profile_id='11000000-0000-4000-8000-000000000005' then 'SALES'
  when m.member_type='customer' then 'CUSTOMER' else 'OPERATIONS' end;
insert into public.customers(id,organization_id,profile_id) values
 ('31000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002'),
 ('31000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003');
insert into public.services(id,organization_id,code,name_ar,name_en,active,property_required) values
 ('41000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','furniture','نقل أثاث','Furniture',true,true);
insert into public.additional_services(id,organization_id,code,name_ar,name_en,active) values
 ('42000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','loading','تحميل','Loading',true);
insert into public.requests(id,organization_id,customer_id,status,revision,service_id,reference,submitted_at,contact_name,contact_phone,contact_email) values
 ('51000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','SUBMITTED',2,'41000000-0000-4000-8000-000000000001','N365-202609-900001',now(),'Customer A','+966500000001','customer-a@example.invalid'),
 ('51000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000002','SUBMITTED',1,'41000000-0000-4000-8000-000000000001','N365-202609-900002',now(),'Customer B','+966500000002','customer-b@example.invalid'),
 ('51000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','SUBMITTED',1,'41000000-0000-4000-8000-000000000001','N365-202609-900003',now(),'Customer A','+966500000001','customer-a@example.invalid'),
 ('51000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','SUBMITTED',1,'41000000-0000-4000-8000-000000000001','N365-202609-900004',now(),'Customer A','+966500000001','customer-a@example.invalid');
insert into public.request_locations(request_id,organization_id,kind,city,district,address,floor,elevator) values
 ('51000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','pickup','Riyadh','A','Pickup',2,false),
 ('51000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','delivery','Riyadh','B','Delivery',3,true),
 ('51000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','pickup','Riyadh','C','Pickup',0,true),
 ('51000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','delivery','Jeddah','D','Delivery',0,true),
 ('51000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001','pickup','Riyadh','E','Pickup',0,true),
 ('51000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001','delivery','Riyadh','F','Delivery',0,true),
 ('51000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000001','pickup','Riyadh','G','Pickup',0,true),
 ('51000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000001','delivery','Riyadh','H','Delivery',0,true);
insert into public.request_additional_services(request_id,organization_id,additional_service_id) values
 ('51000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001');
insert into public.vehicle_pricing_classes(id,organization_id,code,name_ar,name_en,active) values
 ('61000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','small','شاحنة صغيرة','Small truck',true),
 ('61000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','other','أخرى','Other',true);
insert into public.pricing_settings(organization_id,vat_rate_bps) values ('21000000-0000-4000-8000-000000000001',1500);
insert into public.pricing_rules(organization_id,code,version,component_code,selector_code,calculation_method,amount_minor,active,label_ar,label_en) values
 ('21000000-0000-4000-8000-000000000001','service-furniture',1,'SERVICE','furniture','FIXED',10000,true,'الخدمة الأساسية','Base service'),
 ('21000000-0000-4000-8000-000000000001','distance',1,'DISTANCE',null,'PER_KM',250,true,'المسافة','Distance'),
 ('21000000-0000-4000-8000-000000000001','vehicle-small',1,'VEHICLE','small','FIXED',5000,true,'المركبة','Vehicle'),
 ('21000000-0000-4000-8000-000000000001','workers',1,'WORKERS',null,'PER_UNIT',1000,true,'العمال','Workers'),
 ('21000000-0000-4000-8000-000000000001','loading',1,'LOADING',null,'FIXED',1500,true,'التحميل','Loading'),
 ('21000000-0000-4000-8000-000000000001','floor',1,'FLOOR_ACCESS',null,'PER_UNIT',200,true,'الطوابق','Floor access'),
 ('21000000-0000-4000-8000-000000000001','elevator',1,'ELEVATOR',null,'FIXED',300,true,'المصعد','Elevator'),
 ('21000000-0000-4000-8000-000000000001','within-city',1,'WITHIN_CITY',null,'FIXED',500,true,'داخل المدينة','Within city'),
 ('21000000-0000-4000-8000-000000000001','intercity',1,'INTERCITY',null,'FIXED',4000,true,'بين المدن','Intercity');

set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.calculate_preliminary_price('51000000-0000-4000-8000-000000000001',12.5,null,'61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000001'); raise exception 'customer set distance'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin perform public.calculate_preliminary_price('51000000-0000-4000-8000-000000000001',12.5,null,'61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000002'); raise exception 'unauthorized staff set distance'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
do $$ begin
 begin perform public.calculate_preliminary_price('51000000-0000-4000-8000-000000000001',0,null,'61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000003'); raise exception 'zero distance'; exception when invalid_parameter_value then null; end;
 begin perform public.calculate_preliminary_price('51000000-0000-4000-8000-000000000001',12.5,null,'61000000-0000-4000-8000-000000000002',2,'69000000-0000-4000-8000-000000000004'); raise exception 'cross-tenant vehicle'; exception when invalid_parameter_value then null; end;
end $$;
select public.calculate_preliminary_price('51000000-0000-4000-8000-000000000001',12.500,'safe route reference','61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000005');
select public.phase2_assert((select calculated_subtotal_minor=22825 from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000005'),'exact preliminary subtotal');
select public.phase2_assert((select source_type='MANUAL_VERIFIED' and distance_km=12.500 and verified_by='11000000-0000-4000-8000-000000000001' from public.distance_snapshots where request_id='51000000-0000-4000-8000-000000000001'),'distance provenance');
select public.create_quote_draft((select id from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000005'),175,'Approved commercial adjustment',172800,'71000000-0000-4000-8000-000000000001');
select public.phase2_assert((select d.calculated_subtotal_minor=22825 and d.manual_adjustment_minor=175 and v.final_subtotal_minor=23000 and v.vat_amount_minor=3450 and v.total_minor=26450 from public.quote_versions v join public.quote_pricing_details d on d.quote_version_id=v.id where v.id='71000000-0000-4000-8000-000000000001'),'adjustment VAT and total snapshots');
select public.calculate_preliminary_price('51000000-0000-4000-8000-000000000001',15.000,'corrected road route','61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000006');
do $$ begin
 begin perform public.send_quote('71000000-0000-4000-8000-000000000001'); raise exception 'stale draft sent'; exception when object_not_in_prerequisite_state then null; end;
end $$;
select public.create_quote_draft((select id from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000006'),0,null,172800,'71000000-0000-4000-8000-000000000002');
select public.send_quote('71000000-0000-4000-8000-000000000002');
select public.phase2_assert((select reference ~ '^Q-N365-[0-9]{6}-[0-9]{6,}$' from public.quotes where request_id='51000000-0000-4000-8000-000000000001'),'trusted quote reference');
reset role;
do $$ begin
 begin update public.distance_snapshots set distance_km=1 where request_id='51000000-0000-4000-8000-000000000001'; raise exception 'distance snapshot changed'; exception when object_not_in_prerequisite_state then null; end;
 begin update public.quote_versions set total_minor=1 where id='71000000-0000-4000-8000-000000000002'; raise exception 'sent terms changed'; exception when object_not_in_prerequisite_state then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
select public.phase2_assert((select count(*)=0 from public.quote_versions),'other customer cannot read quote');
select public.phase2_assert((select count(*)=0 from public.quote_pricing_details),'customer cannot read internal pricing or adjustment reason');
do $$ begin
 begin perform public.respond_to_quote('71000000-0000-4000-8000-000000000002','accept','other-customer',null); raise exception 'other customer accepted quote'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select public.view_customer_quote('71000000-0000-4000-8000-000000000002');
select public.respond_to_quote('71000000-0000-4000-8000-000000000002','accept','accept-once',null);
select public.respond_to_quote('71000000-0000-4000-8000-000000000002','accept','accept-replay',null);
select public.phase2_assert((select count(*)=1 from public.orders where accepted_quote_version_id='71000000-0000-4000-8000-000000000002'),'replayed acceptance creates one order');
select public.phase2_assert((select o.total_minor=v.total_minor and o.request_id=q.request_id and o.customer_id=r.customer_id from public.orders o join public.quote_versions v on v.id=o.accepted_quote_version_id join public.quotes q on q.id=v.quote_id join public.requests r on r.id=q.request_id),'order inherits accepted snapshot');
do $$ begin
 begin update public.quote_versions set total_minor=2; raise exception 'customer changed price'; exception when insufficient_privilege then null; end;
 begin insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key) values('21000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','forged'); raise exception 'customer created order'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.calculate_preliminary_price('51000000-0000-4000-8000-000000000002',950.000,null,'61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000012');
select public.create_quote_draft((select id from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000012'),0,null,1,'71000000-0000-4000-8000-000000000012');
select public.send_quote('71000000-0000-4000-8000-000000000012');
select pg_sleep(1.05);
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin perform public.respond_to_quote('71000000-0000-4000-8000-000000000012','accept','expired-accept',null); raise exception 'expired quote accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;
select public.phase2_assert((select count(*)=0 from public.orders where accepted_quote_version_id='71000000-0000-4000-8000-000000000012'),'expired quote creates no order');

select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.calculate_preliminary_price('51000000-0000-4000-8000-000000000003',22.000,null,'61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000013');
select public.create_quote_draft((select id from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000013'),0,null,172800,'71000000-0000-4000-8000-000000000013');
select public.send_quote('71000000-0000-4000-8000-000000000013');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select public.respond_to_quote('71000000-0000-4000-8000-000000000013','reject','reject-once','Schedule changed');
select public.respond_to_quote('71000000-0000-4000-8000-000000000013','reject','reject-replay','Schedule changed');
do $$ begin
 begin perform public.respond_to_quote('71000000-0000-4000-8000-000000000013','accept','reject-then-accept',null); raise exception 'rejected quote accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;
select public.phase2_assert((select count(*)=0 from public.orders where accepted_quote_version_id='71000000-0000-4000-8000-000000000013'),'rejected quote creates no order');

select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.calculate_preliminary_price('51000000-0000-4000-8000-000000000004',30.000,null,'61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000014');
select public.create_quote_draft((select id from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000014'),0,null,172800,'71000000-0000-4000-8000-000000000014');
select public.send_quote('71000000-0000-4000-8000-000000000014');
select public.calculate_preliminary_price('51000000-0000-4000-8000-000000000004',32.000,'revision', '61000000-0000-4000-8000-000000000001',2,'69000000-0000-4000-8000-000000000015');
select public.create_quote_draft((select id from public.pricing_evaluations where mutation_id='69000000-0000-4000-8000-000000000015'),0,null,172800,'71000000-0000-4000-8000-000000000015');
select public.send_quote('71000000-0000-4000-8000-000000000015');
select public.phase2_assert((select status='SUPERSEDED' from public.quote_versions where id='71000000-0000-4000-8000-000000000014'),'old sent version superseded');
select public.phase2_assert((select status='SENT' and version=2 from public.quote_versions where id='71000000-0000-4000-8000-000000000015'),'new version remains eligible');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.respond_to_quote('71000000-0000-4000-8000-000000000014','accept','superseded-accept',null); raise exception 'superseded quote accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
update public.organization_memberships set status='suspended' where profile_id='11000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.phase2_assert((select count(*)=0 from public.quote_versions),'suspended customer loses quote access');
reset role;
rollback;
