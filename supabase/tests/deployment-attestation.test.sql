begin;
do $$ begin
 if exists(select 1 from private.deployment_identity) then raise exception 'Marker must not be seeded'; end if;
 if (select count(*) from public.deployment_attestation()) <> 0 then raise exception 'Unprovisioned result'; end if;
 if (select pronargs from pg_proc where oid='public.deployment_attestation()'::regprocedure) <> 0 then raise exception 'Caller parameters forbidden'; end if;
 if has_table_privilege('anon','private.deployment_identity','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','private.deployment_identity','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct privilege exposed'; end if;
end $$;
insert into private.deployment_identity(protocol_version,environment,deployment_identity,configuration_revision)
values(1,'staging','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
do $$ begin
 begin
  insert into private.deployment_identity(protocol_version,environment,deployment_identity,configuration_revision)
  values(1,'staging',gen_random_uuid(),gen_random_uuid());
  raise exception 'Singleton broken';
 exception when unique_violation then null; end;
end $$;
set local role anon;
do $$ begin
 if (select to_jsonb(d) from public.deployment_attestation() d) <> '{"protocol_version":1,"environment":"staging","deployment_identity":"10000000-0000-4000-8000-000000000001","configuration_revision":"10000000-0000-4000-8000-000000000002"}'::jsonb then raise exception 'Unexpected exposure'; end if;
 begin perform * from private.deployment_identity; raise exception 'Read exposed'; exception when insufficient_privilege then null; end;
 begin delete from private.deployment_identity; raise exception 'Delete exposed'; exception when insufficient_privilege then null; end;
 begin update private.deployment_identity set environment='production'; raise exception 'Update exposed'; exception when insufficient_privilege then null; end;
 begin insert into private.deployment_identity default values; raise exception 'Insert exposed'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$ begin
 begin perform * from private.deployment_identity; raise exception 'Read exposed'; exception when insufficient_privilege then null; end;
 begin delete from private.deployment_identity; raise exception 'Delete exposed'; exception when insufficient_privilege then null; end;
 begin update private.deployment_identity set environment='production'; raise exception 'Update exposed'; exception when insufficient_privilege then null; end;
 begin insert into private.deployment_identity default values; raise exception 'Insert exposed'; exception when insufficient_privilege then null; end;
 if (select count(*) from public.deployment_attestation()) <> 1 then raise exception 'RPC unavailable'; end if;
end $$;
reset role;
rollback;
-- Supabase TAP report
begin;
select plan(1);
select pass('Deployment attestation privilege and disclosure assertions completed');
select * from finish();
rollback;
