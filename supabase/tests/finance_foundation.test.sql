-- SQL authorization and multi-Trip execution assertions; no surviving fixtures.
begin;
create function public.phase3_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Phase 3 assertion: %',label; end if; end $$;
insert into public.organizations(id,name) values('23000000-0000-4000-8000-000000000001','Phase 3 A'),('23000000-0000-4000-8000-000000000002','Phase 3 B');
-- Explicit synthetic catalogue for this rollback-only fixture; no production coverage.
insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code)
 select md5(id::text||'SA')::uuid,id,'SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966' from public.organizations where id::text like '23000000%';
insert into public.market_regions(id,organization_id,market_id,code,name_ar,name_en,administrative_type)
 select md5(id::text||'region')::uuid,organization_id,id,'fixture','منطقة اختبار','Fixture region','region' from (select * from public.markets where organization_id::text like '23000000%') fixture_markets;
insert into public.market_cities(id,organization_id,market_id,region_id,code,name_ar,name_en)
 select md5(m.id::text||c.code)::uuid,m.organization_id,m.id,r.id,c.code,c.name,c.name from (select * from public.markets where organization_id::text like '23000000%') m join public.market_regions r on r.market_id=m.id cross join (values('Riyadh','Riyadh'),('Jeddah','Jeddah')) c(code,name);

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
insert into public.requests(id,organization_id,customer_id,market_id) values ('53000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',md5(('23000000-0000-4000-8000-000000000001')::text||'SA')::uuid);
insert into public.quotes(id,organization_id,request_id) values('63000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001');
insert into public.quote_versions(id,organization_id,quote_id,version,status,sent_at,expires_at,distance_km,distance_source,distance_verified_at,currency) values ('73000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',1,'ACCEPTED',now(),now()+interval '2 days',10,'MANUAL_VERIFIED',now(),'SAR');
insert into public.orders(id,organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,accepted_at,currency) values ('83000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','phase3','O-N365-202609-930001','53000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001',10,'MANUAL_VERIFIED',now(),'SAR');

insert into auth.users(id,email) values('13000000-0000-4000-8000-000000000006','foundation-sql@example.invalid');
insert into public.organization_memberships(organization_id,profile_id,member_type) values('23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000006','staff');
insert into public.user_roles(organization_id,profile_id,role_id) select '23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000006',id from public.roles where code='FINANCE';
insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by)
 values('23000000-0000-4000-8000-000000000001','5a2de9ad-d807-497a-be94-49760622db7f','SAR','اختبار','TEST ONLY','اختبار','TEST ONLY','TEST-ONLY-0000','13000000-0000-4000-8000-000000000006');
set local role authenticated;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
do $$ declare reservation jsonb;result jsonb;mid uuid=gen_random_uuid(); begin
 perform public.payment_command('83000000-0000-4000-8000-000000000001','choose',gen_random_uuid(),0,'{"method":"BANK_TRANSFER"}');
 reservation=public.payment_command('83000000-0000-4000-8000-000000000001','reserve',gen_random_uuid(),1,jsonb_build_object('fileId',gen_random_uuid(),'mime','image/png','size',100));
 perform set_config('storage.operation','object.upload',true);
 insert into storage.objects(bucket_id,name,metadata) values('documents',reservation->>'path','{"mimetype":"image/png","size":100}');
 result=public.payment_command('83000000-0000-4000-8000-000000000001','submit',mid,2,jsonb_build_object('attemptId',reservation->>'attemptId','customerReference','UNVERIFIED-CUSTOMER-0001'));
 perform public.phase3_assert(result->>'status'='UNDER_REVIEW' and result->>'executionAllowed'='false','Proof is not funds');
 begin perform public.finance_market_queue('23000000-0000-4000-8000-000000000001','5a2de9ad-d807-497a-be94-49760622db7f'); raise exception 'Customer Finance access'; exception when insufficient_privilege then null;end;
 begin perform * from private.manual_collection_receipts;raise exception 'Private claim leak';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000006',true);
 perform public.phase3_assert(jsonb_array_length(public.finance_market_queue('23000000-0000-4000-8000-000000000001','5a2de9ad-d807-497a-be94-49760622db7f')->'items')=1,'Scoped Finance projection');
 begin perform public.finance_market_queue('23000000-0000-4000-8000-000000000002','5a2de9ad-d807-497a-be94-49760622db7f');raise exception 'Tenant leak';exception when insufficient_privilege then null;end;
 begin perform public.finance_market_queue('23000000-0000-4000-8000-000000000001',gen_random_uuid());raise exception 'Market leak';exception when insufficient_privilege then null;end;
 begin perform public.payment_command('83000000-0000-4000-8000-000000000001','confirm_transfer',gen_random_uuid(),3,jsonb_build_object('attemptId',reservation->>'attemptId','amountMinor',0,'currency','SAR'));raise exception 'Missing receipt identity accepted';exception when invalid_parameter_value then null;end;
 result=public.payment_command('83000000-0000-4000-8000-000000000001','confirm_transfer',mid,3,jsonb_build_object('attemptId',reservation->>'attemptId','amountMinor',0,'currency','SAR','reference','POSTGRES-TEST-001'));
 perform public.phase3_assert(result->>'status'='PAID','Verified receipt and payment atomically committed');
 perform public.phase3_assert(result=public.payment_command('83000000-0000-4000-8000-000000000001','confirm_transfer',mid,3,jsonb_build_object('attemptId',reservation->>'attemptId','amountMinor',0,'currency','SAR','reference','POSTGRES-TEST-001')),'Finance replay');
end $$;
reset role;
select public.phase3_assert((select count(*)=1 from private.manual_collection_receipts),'One durable receipt claim');
select public.phase3_assert((select customer_reference='UNVERIFIED-CUSTOMER-0001' from public.bank_transfer_attempts),'Customer reference independent');
rollback;
begin;
select plan(1);
select pass('Finance market access, proof separation, receipt requirement, atomicity and replay');
select * from finish();
rollback;
