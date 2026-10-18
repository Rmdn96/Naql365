begin;
create function public.support_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Support assertion: %',label;end if;end $$;
insert into public.organizations(id,name) values('a1000000-0000-4000-8000-000000000001','Support fixture'),('a1000000-0000-4000-8000-000000000002','Other fixture');
insert into auth.users(id) select ('a2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,7) n;
insert into public.organization_memberships(organization_id,profile_id,member_type) select 'a1000000-0000-4000-8000-000000000001',id,case when right(id::text,1)='5' then 'customer' when right(id::text,1)='6' then 'driver' else 'staff' end from auth.users where id::text like 'a2000000%';
insert into public.user_roles(organization_id,profile_id,role_id) select m.organization_id,m.profile_id,r.id from public.organization_memberships m join public.roles r on r.code=case right(m.profile_id::text,1) when '1' then 'CUSTOMER_SERVICE' when '2' then 'SALES' when '3' then 'CUSTOMER_SERVICE' when '4' then 'FINANCE' when '5' then 'CUSTOMER' when '6' then 'DRIVER' else 'CUSTOMER_SERVICE' end where m.organization_id='a1000000-0000-4000-8000-000000000001';
-- Isolate a role with support only, without changing any accepted role grants.
insert into public.roles(id,code,member_type) values('a3000000-0000-4000-8000-000000000001','TEST_SUPPORT_ONLY','staff');
insert into public.role_permissions(role_id,permission_id) select 'a3000000-0000-4000-8000-000000000001',id from public.permissions where code='support.read';
update public.user_roles set role_id='a3000000-0000-4000-8000-000000000001' where profile_id='a2000000-0000-4000-8000-000000000003';
update public.organization_memberships set status='suspended' where profile_id='a2000000-0000-4000-8000-000000000007';
insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values
('a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','SA','اختبار','Test',true,'SAR','Asia/Riyadh','+966'),
('a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','SA','آخر','Other',true,'SAR','Asia/Riyadh','+966');
insert into public.customers(id,organization_id,profile_id) values('a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000005');
insert into public.requests(id,organization_id,customer_id,market_id,status,reference,submitted_at,contact_name,contact_email,created_at) select ('a6000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a1000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','SUBMITTED','N365-202610-'||lpad(n::text,6,'0'),now(),'Synthetic support customer','support@example.invalid','2026-10-12T00:00:00Z' from generate_series(1,3) n;
select public.support_assert(not has_function_privilege('anon','public.support_request_queue(uuid,uuid,timestamptz,uuid,integer)','EXECUTE'),'anon denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000001',true);
do $$ declare first_page jsonb; second_page jsonb; begin
first_page=public.support_request_queue('a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',null,null,2);
perform public.support_assert(jsonb_array_length(first_page->'items')=2,'both permissions allowed');
perform public.support_assert(first_page->'items'->0->>'reference'='N365-202610-000003','stable UUID tie ordering');
second_page=public.support_request_queue('a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',(first_page->'nextCursor'->>'createdAt')::timestamptz,(first_page->'nextCursor'->>'id')::uuid,2);
perform public.support_assert(jsonb_array_length(second_page->'items')=1 and second_page->'nextCursor'='null'::jsonb,'keyset no duplicates');
perform public.support_assert((select array_agg(k order by k)=array['contactEmail','contactName','contactPhone','createdAt','deliveryCity','journey','pickupCity','reference','serviceAr','serviceEn','updatedAt'] from jsonb_object_keys(first_page->'items'->0) k),'exact field whitelist');
begin perform public.support_request_queue('a1000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002');raise exception 'foreign org allowed';exception when insufficient_privilege then null;end;
begin perform public.support_request_queue('a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002');raise exception 'foreign market allowed';exception when invalid_parameter_value then null;end;
begin perform public.support_request_queue('a1000000-0000-4000-8000-000000000001',null);raise exception 'null market allowed';exception when invalid_parameter_value then null;end;
begin perform public.support_request_queue('a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',null,null,31);raise exception 'unbounded page allowed';exception when invalid_parameter_value then null;end;
begin perform public.support_request_queue('a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001',now(),null);raise exception 'partial cursor allowed';exception when invalid_parameter_value then null;end;
end $$;
-- Missing support, missing requests, unauthorized staff, customer, driver and suspension.
do $$ declare n integer;begin for n in 2..7 loop
perform set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
begin perform public.support_request_queue('a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001');raise exception 'unauthorized identity allowed: %',n;exception when insufficient_privilege then null;end;
end loop;end $$;
reset role;
select public.support_assert(not exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id join public.permissions p on p.id=rp.permission_id where r.code='CUSTOMER_SERVICE' and p.code in ('pricing.calculate','quotes.manage','operations.manage','dispatch.manage','finance.verify','guest.links.manage')),'support grants unchanged');
rollback;
-- Supabase TAP report
begin;
select plan(1);
select pass('Support projection permission, tenant, field whitelist and keyset assertions passed');
select * from finish();
rollback;
