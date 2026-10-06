-- Non-secret environment designation only; NOT business/financial certification.
create table private.deployment_identity (
 singleton boolean primary key default true check (singleton),
 protocol_version integer not null check (protocol_version = 1),
 environment text not null check (environment in ('local','staging','production')),
 deployment_identity uuid not null,
 configuration_revision uuid not null
);
alter table private.deployment_identity enable row level security;
revoke all on private.deployment_identity from public, anon, authenticated;
-- Deliberately no row: only a separately authorized privileged setup initializes it.
create function public.deployment_attestation()
returns table(protocol_version integer, environment text, deployment_identity uuid, configuration_revision uuid)
language sql stable security definer set search_path = ''
as $$
 select d.protocol_version, d.environment, d.deployment_identity, d.configuration_revision
 from private.deployment_identity as d where d.singleton = true
$$;
revoke all on function public.deployment_attestation() from public;
grant execute on function public.deployment_attestation() to anon, authenticated;
comment on function public.deployment_attestation() is 'Non-secret backend designation only; no pricing, tax, payment or operational readiness certification.';
