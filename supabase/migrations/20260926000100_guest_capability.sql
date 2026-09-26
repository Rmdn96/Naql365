-- Phase 7: capability identity. No anonymous table grants or staff authorization changes.
alter table public.customers alter column profile_id drop not null;
alter table public.customers add column identity_kind text not null default 'ACCOUNT'
 check(identity_kind in ('ACCOUNT','GUEST'));
alter table public.customers add constraint customer_identity_relationship
 check ((identity_kind='ACCOUNT' and profile_id is not null) or
        (identity_kind='GUEST' and profile_id is null));
alter table public.requests add constraint requests_journey_identity
 unique(organization_id,customer_id,id);

create or replace function private.validate_person_membership() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='customers' then
  if tg_op='UPDATE' and (new.identity_kind,new.profile_id,new.organization_id)
   is distinct from (old.identity_kind,old.profile_id,old.organization_id)
  then raise exception 'Customer identity is immutable' using errcode='55000'; end if;
  if new.identity_kind='GUEST' and new.profile_id is null then return new; end if;
 end if;
 if tg_table_name='drivers' and new.profile_id is null then return new; end if;
 if not exists(select 1 from public.organization_memberships m where m.organization_id=new.organization_id
  and m.profile_id=new.profile_id and m.member_type=case when tg_table_name='customers' then 'customer' else 'driver' end)
 then raise exception 'Record does not match membership type' using errcode='23514'; end if;
 return new;
end $$;

create table private.guest_access_grants (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 customer_id uuid not null,
 request_id uuid not null,
 verifier bytea not null unique check(octet_length(verifier)=32),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 foreign key(organization_id,customer_id,request_id)
  references public.requests(organization_id,customer_id,id),
 check(expires_at>created_at and expires_at<=created_at+interval '90 days'),
 check(revoked_at is null or revoked_at>=created_at)
);
create unique index guest_one_current_grant on private.guest_access_grants(request_id)
 where revoked_at is null;
create index guest_grant_customer on private.guest_access_grants(organization_id,customer_id);
alter table private.guest_access_grants enable row level security;
revoke all on private.guest_access_grants from public,anon,authenticated;

create function private.validate_guest_grant() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.customers c where c.organization_id=new.organization_id
  and c.id=new.customer_id and c.identity_kind='GUEST' and c.profile_id is null)
 then raise exception 'Guest identity required' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.id,new.organization_id,new.customer_id,new.request_id,new.verifier,new.created_at,new.expires_at)
  is distinct from (old.id,old.organization_id,old.customer_id,old.request_id,old.verifier,old.created_at,old.expires_at)
 then raise exception 'Grant identity is immutable' using errcode='55000'; end if;
 if tg_op='UPDATE' and old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at
 then raise exception 'Revocation is permanent' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.validate_guest_grant() from public,anon,authenticated;
create trigger guest_grant_identity before insert or update on private.guest_access_grants
 for each row execute function private.validate_guest_grant();

-- Only shared SECURITY DEFINER commands call this helper. Headers are bearer evidence,
-- never trusted IDs/roles. Return no context for malformed/unknown/expired/revoked tokens.
create function private.guest_context() returns private.guest_access_grants
 language plpgsql stable security definer set search_path='' as $$
declare headers text; secret text; result private.guest_access_grants;
begin
 headers=current_setting('request.headers',true);
 if headers is null or octet_length(headers)>32768 then return null; end if;
 begin secret=headers::jsonb->>'x-naql365-guest';
 exception when invalid_text_representation then return null; end;
 if secret is null or secret !~ '^g1_[0-9a-f]{64}$' then return null; end if;
 select g.* into result from private.guest_access_grants g
 join public.customers c on c.organization_id=g.organization_id and c.id=g.customer_id
 where g.verifier=sha256(convert_to(secret,'UTF8')) and g.revoked_at is null
 and g.expires_at>statement_timestamp() and c.identity_kind='GUEST' and c.profile_id is null;
 return result;
end $$;
revoke all on function private.guest_context() from public,anon,authenticated;

-- Mutation and reissue use the same row lock. Recheck after waiting so a revoked
-- credential cannot execute a queued write based on an earlier read snapshot.
create function private.lock_guest_context() returns private.guest_access_grants
 language plpgsql volatile security definer set search_path='' as $$
declare context private.guest_access_grants;
begin
 context=private.guest_context();
 if context.id is null then raise exception 'Journey unavailable' using errcode='42501'; end if;
 select * into context from private.guest_access_grants where id=context.id for update;
 if context.revoked_at is not null or context.expires_at<=clock_timestamp()
 then raise exception 'Journey unavailable' using errcode='42501'; end if;
 return context;
end $$;
revoke all on function private.lock_guest_context() from public,anon,authenticated;
