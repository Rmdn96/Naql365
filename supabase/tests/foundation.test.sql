-- Shared executable assertions: PGlite locally and full Supabase/PostgreSQL in CI.
-- Synthetic identifiers exist only in this rollback transaction; never seed production.
begin;
create function public.test_assert(condition boolean, label text) returns void language plpgsql as $$
begin if condition is distinct from true then raise exception 'Assertion failed: %',label; end if; end $$;

insert into auth.users(id,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','{"role":"SUPER_ADMIN","organization_id":"20000000-0000-4000-8000-000000000001"}'),
 ('10000000-0000-4000-8000-000000000002','{}'),
 ('10000000-0000-4000-8000-000000000003','{}'),
 ('10000000-0000-4000-8000-000000000004','{}'),
 ('10000000-0000-4000-8000-000000000005','{}');
select public.test_assert((select count(*)=5 from public.profiles),'registration creates profiles');
select public.test_assert((select count(*)=0 from public.user_roles),'metadata cannot assign roles');
select public.test_assert((select count(*)=0 from public.organization_memberships),'metadata cannot assign tenants');
insert into public.organizations(id,name) values ('20000000-0000-4000-8000-000000000001','Test A'),('20000000-0000-4000-8000-000000000002','Test B');
insert into public.organization_memberships(organization_id,profile_id,member_type) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','customer'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','customer'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','customer'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','staff'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','staff');
insert into public.user_roles(organization_id,profile_id,role_id)
 select organization_id,profile_id,r.id from public.organization_memberships m join public.roles r on
 r.code=case when m.member_type='customer' then 'CUSTOMER' else 'SUPER_ADMIN' end;
insert into public.customers(id,organization_id,profile_id) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
insert into public.requests(id,organization_id,customer_id) select id,organization_id,id from public.customers;
insert into public.request_items(organization_id,request_id) select organization_id,id from public.requests;
insert into public.file_objects(id,organization_id,owner_profile_id,bucket_id) select id,organization_id,profile_id,'attachments' from public.customers;
insert into storage.objects(bucket_id,name) select bucket_id,object_name from public.file_objects;
insert into public.quotes(id,organization_id,request_id) select id,organization_id,id from public.requests;
insert into public.quote_versions(id,organization_id,quote_id,version) select id,organization_id,id,1 from public.quotes;
insert into public.quote_versions(id,organization_id,quote_id,version) values ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',2);
insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key) values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','test-acceptance');
insert into public.jobs(id,organization_id,order_id) select '50000000-0000-4000-8000-000000000001',organization_id,id from public.orders;
insert into public.trips(id,organization_id,job_id) values
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');
insert into public.trip_stops(id,organization_id,trip_id,position) values
 ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',0),
 ('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1);

select public.test_assert((select bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),'RLS on every application table');
select public.test_assert((select bool_and(not public) from storage.buckets where id in ('attachments','pod-files','documents')),'buckets are private');
do $$ begin
 begin insert into public.trip_events(organization_id,trip_id,stop_id,event_type) values ('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','test'); raise exception 'event linked to another trip stop'; exception when foreign_key_violation then null; end;
 begin insert into public.trip_stops(organization_id,trip_id,position) values ('20000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1); raise exception 'duplicate stop position accepted'; exception when unique_violation then null; end;
 begin insert into public.drivers(organization_id,profile_id) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'); raise exception 'customer linked as driver'; exception when check_violation then null; end;
 begin update public.organization_memberships set member_type='staff' where profile_id='10000000-0000-4000-8000-000000000001'; raise exception 'incompatible membership change accepted'; exception when check_violation then null; end;
 begin insert into public.requests(organization_id,customer_id) values ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001'); raise exception 'cross-tenant FK accepted'; exception when foreign_key_violation then null; end;
 begin insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key) values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','repeated-acceptance'); raise exception 'duplicate quote order accepted'; exception when unique_violation then null; end;
 begin insert into public.user_roles(organization_id,profile_id,role_id) select '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',id from public.roles where code='SUPER_ADMIN'; raise exception 'customer assigned staff role'; exception when check_violation then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=1 from public.profiles),'profile isolation');
select public.test_assert((select count(*)=1 from public.organizations),'tenant visibility');
select public.test_assert((select count(*)=1 from public.customers),'customer isolation');
select public.test_assert((select count(*)=1 from public.requests),'own request only');
select public.test_assert((select count(*)=1 from public.request_items),'own request items only');
select public.test_assert((select count(*)=1 from public.file_objects),'own file registry only');
select public.test_assert((select count(*)=1 from storage.objects),'own private storage only');
select public.test_assert((select count(*)=0 from public.audit_logs),'customers cannot read audit logs');
select public.test_assert((select count(*)=0 from public.quotes),'unimplemented customer quote access is denied');
select public.test_assert(public.has_permission('20000000-0000-4000-8000-000000000001','account.access'),'customer account access');
select public.test_assert(not public.has_permission('20000000-0000-4000-8000-000000000001','portal.access'),'customer denied operations');
select public.test_assert(not public.has_permission('20000000-0000-4000-8000-000000000002','account.access'),'cross-tenant permission denied');
do $$ begin
 begin insert into public.user_roles(organization_id,profile_id,role_id) select '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',id from public.roles where code='SUPER_ADMIN'; raise exception 'privilege escalation succeeded'; exception when insufficient_privilege then null; end;
 begin update public.organization_memberships set member_type='staff'; raise exception 'membership escalation succeeded'; exception when insufficient_privilege then null; end;
 begin insert into public.requests(organization_id,customer_id) values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'); raise exception 'unimplemented write succeeded'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values ('attachments','20000000-0000-4000-8000-000000000002/forged'); raise exception 'storage upload bypass'; exception when insufficient_privilege then null; end;
 begin insert into public.audit_logs(action,entity_type) values ('forged','roles'); raise exception 'audit forgery succeeded'; exception when insufficient_privilege then null; end;
 begin update public.audit_logs set action='forged'; raise exception 'audit update succeeded'; exception when insufficient_privilege then null; end;
 begin delete from public.audit_logs; raise exception 'audit deletion succeeded'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select public.test_assert((select count(*)=2 from public.requests),'staff reads own tenant');
select public.test_assert((select count(*)=2 from public.quotes),'staff permissions in database');
select public.test_assert((select count(*)=2 from storage.objects),'staff storage remains tenant scoped');
select public.test_assert(not public.has_permission('20000000-0000-4000-8000-000000000002','portal.access'),'SUPER_ADMIN is tenant scoped');
select public.test_assert((select count(*)>0 from public.audit_logs where entity_type='user_roles'),'role changes audited');
select public.test_assert((select count(*)=0 from public.audit_logs where organization_id='20000000-0000-4000-8000-000000000002'),'audit tenant isolation');
reset role;
update public.organization_memberships set status='suspended' where profile_id='10000000-0000-4000-8000-000000000004';
set local role authenticated;
select public.test_assert(not public.has_permission('20000000-0000-4000-8000-000000000001','portal.access'),'suspension takes effect without token refresh');
select public.test_assert((select count(*)=0 from public.requests),'suspended staff loses data access');
select public.test_assert((select count(*)=0 from storage.objects),'suspended staff loses file access');
reset role;
set local role anon;
do $$ begin
 begin perform * from public.requests; raise exception 'anonymous read succeeded'; exception when insufficient_privilege then null; end;
 begin perform public.has_permission('20000000-0000-4000-8000-000000000001','portal.access'); raise exception 'anonymous RPC succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;

-- Supabase TAP report
begin;
select plan(1);
select pass('All shared foundation security and relational assertions passed on Supabase');
select * from finish();
rollback;
