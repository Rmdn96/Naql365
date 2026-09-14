begin;
create function public.market_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Market assertion: %',label; end if; end $$;
create function public.market_reject(command text) returns void language plpgsql as $$ begin
 begin execute command; exception when sqlstate '42501' or sqlstate '23514' or sqlstate '23503' or sqlstate '55000' or sqlstate '22023' then return; end;
 raise exception 'Unexpectedly permitted: %',command;
end $$;
insert into auth.users(id,email,email_confirmed_at) values('13500000-0000-4000-8000-000000000001','staff@market.invalid',now()),('13500000-0000-4000-8000-000000000002','customer@market.invalid',now()),('13500000-0000-4000-8000-000000000003','peer@market.invalid',now());
insert into public.organizations(id,name) values('23500000-0000-4000-8000-000000000001','Market fixture');
insert into public.organization_memberships(organization_id,profile_id,member_type) select '23500000-0000-4000-8000-000000000001',id,case when id='13500000-0000-4000-8000-000000000001' then 'staff' else 'customer' end from auth.users where id::text like '13500000%';
insert into public.user_roles(organization_id,profile_id,role_id) select m.organization_id,m.profile_id,r.id from public.organization_memberships m join public.roles r on r.code=case when m.member_type='staff' then 'SUPER_ADMIN' else 'CUSTOMER' end where m.organization_id='23500000-0000-4000-8000-000000000001';
insert into public.customers(organization_id,profile_id) select organization_id,profile_id from public.organization_memberships where member_type='customer' and organization_id='23500000-0000-4000-8000-000000000001';
insert into private.customer_enrollment values(true,'23500000-0000-4000-8000-000000000001') on conflict(singleton) do update set organization_id=excluded.organization_id;
insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values
 ('33500000-0000-4000-8000-000000000001','23500000-0000-4000-8000-000000000001','SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966'),
 ('33500000-0000-4000-8000-000000000002','23500000-0000-4000-8000-000000000001','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');
insert into public.market_regions(id,organization_id,market_id,code,name_ar,name_en,administrative_type) select id,organization_id,id,'fixture','اختبار','Test','region' from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.market_cities(id,organization_id,market_id,region_id,code,name_ar,name_en) select id,organization_id,id,id,'same-name','مدينة','Same name' from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.services(id,organization_id,code,name_ar,name_en,active) values('43500000-0000-4000-8000-000000000001','23500000-0000-4000-8000-000000000001','goods','بضائع','Goods',true);
insert into public.market_services select organization_id,id,'43500000-0000-4000-8000-000000000001',true from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.service_areas(organization_id,market_id,service_id,city_id,active) select organization_id,id,'43500000-0000-4000-8000-000000000001',id,true from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.vehicle_pricing_classes(id,organization_id,market_id,code,name_ar,name_en,active) select id,organization_id,id,'truck','شاحنة','Truck',true from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.pricing_settings(organization_id,market_id,currency) select organization_id,id,currency from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.market_tax_versions(id,organization_id,market_id,code,version,rate_bps,label_ar,label_en,active,effective_from,configuration_kind)
 select id,organization_id,id,'synthetic-only',1,case country_code when 'SA' then 1000 else 2000 end,'ضريبة اختبار','TEST TAX',true,now()-interval '1 day','STAGING_TEST' from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
insert into public.pricing_rules(organization_id,market_id,code,version,component_code,calculation_method,amount_minor,active,label_ar,label_en)
 select organization_id,id,'test-distance',1,'DISTANCE','PER_KM',case country_code when 'SA' then 100 else 200 end,true,'مسافة اختبار','TEST distance' from (select * from public.markets where organization_id::text like '23500000%') fixture_markets;
create temporary table market_results(market uuid primary key,request uuid,quote uuid,order_id uuid,job uuid,trip uuid,driver uuid,vehicle uuid);
grant all on market_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
do $$ declare m record; other uuid; req uuid; result jsonb; payload jsonb; eval uuid; q uuid; ord uuid; job uuid; trip uuid; driver uuid; vehicle uuid;
begin
 for m in select * from (select * from public.markets where organization_id::text like '23500000%') fixture_markets order by country_code loop
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
  -- Context is explicit; same identity can transact in both markets.
  result=public.create_customer_request(gen_random_uuid(),m.id); req=(result->>'id')::uuid;
  payload=jsonb_build_object('service_id','43500000-0000-4000-8000-000000000001','description','Synthetic shipment','notes','',
   'pickup',jsonb_build_object('city_id',m.id,'city','Same name','address','Test pickup'),
   'delivery',jsonb_build_object('city_id',m.id,'city','Same name','address','Test delivery'),
   'items',jsonb_build_array(jsonb_build_object('description','Box','quantity',1)), 'additional_service_ids','[]'::jsonb,
   'preferred_date',((now() at time zone m.timezone)::date+1)::text,'time_window','morning','contact_name','Fixture','contact_phone',m.phone_country_code||case when m.country_code='SA' then '500000001' else '1000000001' end,'contact_email','','contact_notes','');
  other=case when m.country_code='SA' then '33500000-0000-4000-8000-000000000002'::uuid else '33500000-0000-4000-8000-000000000001'::uuid end;
  perform public.market_reject(format('select public.request_command(''save'',%L,0,%L,%L)',req,gen_random_uuid(),jsonb_set(payload,'{delivery,city_id}',to_jsonb(other))));
  perform public.market_reject(format('select public.request_command(''save'',%L,0,%L,%L)',req,gen_random_uuid(),jsonb_set(payload,'{pickup,city_id}',to_jsonb(other))));
  perform public.request_command('save',req,0,gen_random_uuid(),payload);
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000001',true);
  update public.service_areas set active=false where market_id=m.id;
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
  perform public.market_reject(format('select public.request_command(''submit'',%L,1,%L)',req,gen_random_uuid()));
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000001',true);
  update public.service_areas set active=true where market_id=m.id;
  update public.market_services set active=false where market_id=m.id;
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
  perform public.market_reject(format('select public.request_command(''submit'',%L,1,%L)',req,gen_random_uuid()));
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000001',true);
  update public.market_services set active=true where market_id=m.id;
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
  perform public.request_command('submit',req,1,gen_random_uuid());
  perform public.market_reject(format('update public.requests set market_id=%L where id=%L',other,req));
  update public.markets set currency='USD' where id=m.id;
  perform public.market_assert(not found,'Customer market update affects zero rows');
  perform public.market_assert((select currency=m.currency from (select * from public.markets where organization_id::text like '23500000%') fixture_markets where id=m.id),'Customer cannot change currency');
  perform public.market_reject(format('select public.calculate_preliminary_price(%L,10,null,%L,1,%L)',req,m.id,gen_random_uuid()));
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000001',true);
  perform public.market_reject(format('select public.calculate_preliminary_price(%L,10,null,%L,1,%L)',req,other,gen_random_uuid()));
  update public.market_tax_versions set active=false where market_id=m.id;
  perform public.market_reject(format('select public.calculate_preliminary_price(%L,10,null,%L,1,%L)',req,m.id,gen_random_uuid()));
  update public.market_tax_versions set active=true where market_id=m.id;
  eval=(public.calculate_preliminary_price(req,10,null,m.id,1,gen_random_uuid())->>'id')::uuid;
  q=gen_random_uuid(); perform public.create_quote_draft(eval,0,null,172800,q);perform public.send_quote(q);
  perform public.market_assert((select currency=m.currency and tax_version_id=m.id and final_subtotal_minor=case m.country_code when 'SA' then 1000 else 2000 end and vat_amount_minor=case m.country_code when 'SA' then 100 else 400 end from public.quote_versions where id=q),'isolated exact currency/rules/tax');
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
  perform public.market_reject(format('update public.quote_versions set vat_rate_bps=0 where id=%L',q));
  perform public.market_reject(format('update public.quote_versions set currency=''USD'' where id=%L',q));
  ord=(public.respond_to_quote(q,'accept','market-'||q::text)->>'order_id')::uuid;
  perform public.market_assert((public.respond_to_quote(q,'accept','repeat')->>'order_id')::uuid=ord,'idempotent accepted Order');
  perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000001',true);
  job=(public.operations_command(m.organization_id,'create_job',ord,0,gen_random_uuid())->>'id')::uuid;
  trip=(public.operations_command(m.organization_id,'create_trip',job,0,gen_random_uuid())->>'id')::uuid;
  driver=(public.operations_command(m.organization_id,'create_driver',job,0,gen_random_uuid(),jsonb_build_object('marketId',m.id,'type','EXTERNAL','name','Fixture'))->>'id')::uuid;
  vehicle=(public.operations_command(m.organization_id,'create_vehicle',job,0,gen_random_uuid(),jsonb_build_object('marketId',m.id,'type','Truck','identifier','TEST-'||m.country_code))->>'id')::uuid;
  payload=jsonb_build_object('plannedStart',now()+interval '1 hour','plannedEnd',now()+interval '2 hours','stops',jsonb_build_array(jsonb_build_object('cityId',m.id,'kind','PICKUP','address','Pickup','pickups','[]'::jsonb),jsonb_build_object('cityId',m.id,'kind','DELIVERY','address','Delivery','pickups','[0]'::jsonb)));
  perform public.market_reject(format('select public.operations_command(%L,''plan'',%L,0,%L,%L)',m.organization_id,trip,gen_random_uuid(),jsonb_set(payload,'{stops,1,cityId}',to_jsonb(other))));
  perform public.operations_command(m.organization_id,'plan',trip,0,gen_random_uuid(),payload);
  insert into market_results values(m.id,req,q,ord,job,trip,driver,vehicle);
 end loop;
end $$;
-- Run under the actual authenticated customer/staff roles, not a table-owner substitute.
do $$ declare a record; b record; begin
 perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000001',true);
 for a in select * from market_results loop
  select * into b from market_results where market<>a.market;
  perform public.market_reject(format('select public.operations_command(''23500000-0000-4000-8000-000000000001'',''assign'',%L,1,%L,%L)',a.trip,gen_random_uuid(),jsonb_build_object('driverId',b.driver,'vehicleId',a.vehicle)));
  perform public.market_reject(format('select public.operations_command(''23500000-0000-4000-8000-000000000001'',''assign'',%L,1,%L,%L)',a.trip,gen_random_uuid(),jsonb_build_object('driverId',a.driver,'vehicleId',b.vehicle)));
  perform public.operations_command('23500000-0000-4000-8000-000000000001','assign',a.trip,1,gen_random_uuid(),jsonb_build_object('driverId',a.driver,'vehicleId',a.vehicle));
  perform public.market_assert((select market_id=a.market and currency=(select currency from (select * from public.markets where organization_id::text like '23500000%') fixture_markets where id=a.market) and tax_version_id=a.market from public.orders where id=a.order_id),'accepted snapshot retained');
 end loop;
 perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000002',true);
 perform public.market_assert((select count(*)=2 from public.orders),'same customer sees both markets');
 perform set_config('request.jwt.claim.sub','13500000-0000-4000-8000-000000000003',true);
 perform public.market_assert((select count(*)=0 from public.orders),'peer customer denied both markets');
end $$;
reset role;
-- Constraints/immutability remain effective for trusted writers as well.
do $$ declare a record; b record; begin
 select * into a from market_results order by market limit 1;select * into b from market_results where market<>a.market;
 insert into public.branches(id,organization_id,market_id,name) values(a.market,'23500000-0000-4000-8000-000000000001',a.market,'Test branch A'),(b.market,'23500000-0000-4000-8000-000000000001',b.market,'Test branch B');
 update public.drivers set branch_id=a.market where id=a.driver;
 update public.vehicles set branch_id=a.market where id=a.vehicle;
 perform public.market_reject(format('update public.drivers set branch_id=%L where id=%L',b.market,a.driver));
 perform public.market_reject(format('update public.vehicles set branch_id=%L where id=%L',b.market,a.vehicle));
 perform public.market_reject(format('insert into public.trips(organization_id,market_id,job_id) values(''23500000-0000-4000-8000-000000000001'',%L,%L)',b.market,a.job));
 perform public.market_reject(format('update public.quote_versions set tax_code=''tampered'' where id=%L',a.quote));
 perform public.market_reject(format('update public.quote_versions set currency=''EGP'' where id=%L',(select quote from market_results where market='33500000-0000-4000-8000-000000000001')));
end $$;
rollback;
-- Supabase TAP report
begin;
select plan(1);
select pass('Market journeys, exact currency/tax, resource/route isolation and customer boundaries completed');
select * from finish();
rollback;
