begin;
select plan(9);
insert into auth.users(id) values ('00aa1111-0000-4000-8000-000000000001'), ('00aa1111-0000-4000-8000-000000000002');
insert into public.organizations(id, name) values ('00aa2222-0000-4000-8000-000000000001','Synthetic commercial identity gate');
insert into public.organization_memberships(organization_id,profile_id,member_type)
 values ('00aa2222-0000-4000-8000-000000000001','00aa1111-0000-4000-8000-000000000001','staff'),
        ('00aa2222-0000-4000-8000-000000000001','00aa1111-0000-4000-8000-000000000002','staff');
insert into public.user_roles(organization_id,profile_id,role_id)
 select '00aa2222-0000-4000-8000-000000000001','00aa1111-0000-4000-8000-000000000001',id from public.roles where code='SUPER_ADMIN';

select ok(not has_function_privilege('anon','public.commercial_admin_session()','EXECUTE'),'anonymous cannot inspect admin status');
select ok(not has_function_privilege('authenticated','private.commercial_auth_token_hook(jsonb)','EXECUTE'),'ordinary authenticated callers cannot invoke Auth hook');
select lives_ok('select public.commercial_api_session_gate()','no JWT is required for public calls');
select ok(has_function_privilege('supabase_auth_admin','private.commercial_auth_token_hook(jsonb)','EXECUTE'),'Auth service can invoke the private hook');
select is(private.commercial_auth_token_hook('{"user_id":"00aa1111-0000-4000-8000-000000000001","claims":{"role":"authenticated"}}')->'claims','{"role":"authenticated"}'::jsonb,'owner claims preserved');
select is(private.commercial_auth_token_hook('{"user_id":"00aa1111-0000-4000-8000-000000000002","claims":{"role":"authenticated"}}')#>>'{error,http_code}','403','other staff cannot receive a new token');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00aa1111-0000-4000-8000-000000000001',true);
select ok(public.commercial_admin_session(),'owner has active administrative role');
select set_config('request.jwt.claim.sub','00aa1111-0000-4000-8000-000000000002',true);
select ok(not public.commercial_admin_session(),'other staff has no active administrative role');
select throws_ok('select public.commercial_api_session_gate()', '42501', 'Session unavailable', 'old non-admin bearer excluded');
reset role;
select * from finish();
rollback;
