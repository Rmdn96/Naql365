-- Customer link replacement is an explicit privileged capability, never a lookup
-- of an existing plaintext secret. No permissions are granted to customer/driver.
insert into public.permissions(code) values('guest.links.manage');
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('SUPER_ADMIN','SALES','OPERATIONS') and p.code='guest.links.manage';

create function public.manage_guest_link(p_request uuid,p_action text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare r public.requests; g private.guest_access_grants; policy private.guest_policy;
 secret text; created_grant uuid;
begin
 select * into r from public.requests where id=p_request;
 if not found or not private.has_permission(r.organization_id,'guest.links.manage')
 then raise exception 'Guest link management denied' using errcode='42501'; end if;
 if p_action is null or p_action not in ('inspect','replace','revoke')
 then raise exception 'Invalid link command' using errcode='22023'; end if;
 if not exists(select 1 from public.customers c where c.id=r.customer_id and c.organization_id=r.organization_id and c.identity_kind='GUEST')
 then return jsonb_build_object('guest',false); end if;
 if p_action='inspect' then
  select * into g from private.guest_access_grants where request_id=r.id and revoked_at is null;
  return jsonb_build_object('guest',true,'active',g.id is not null and g.expires_at>clock_timestamp(),'expiresAt',g.expires_at);
 end if;
 -- Serialize competing staff replacements, then use the same grant-first lock
 -- order as guest mutations. A queued guest command rechecks revoked_at.
 perform pg_advisory_xact_lock(hashtextextended(r.id::text,71));
 select * into g from private.guest_access_grants where request_id=r.id and revoked_at is null for update;
 select * into r from public.requests where id=p_request for update;
 if not private.has_permission(r.organization_id,'guest.links.manage')
 then raise exception 'Guest link management denied' using errcode='42501'; end if;
 if g.id is not null then update private.guest_access_grants set revoked_at=clock_timestamp() where id=g.id; end if;
 if p_action='replace' then
  select * into policy from private.guest_policy where organization_id=r.organization_id and enabled;
  if not found then raise exception 'Guest links unavailable' using errcode='55000'; end if;
  secret='g1_'||encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex');
  insert into private.guest_access_grants(organization_id,customer_id,request_id,verifier,expires_at)
   values(r.organization_id,r.customer_id,r.id,sha256(convert_to(secret,'UTF8')),clock_timestamp()+make_interval(days=>policy.lifetime_days)) returning id into created_grant;
 end if;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(r.organization_id,auth.uid(),case when p_action='replace' then 'guest.link_replaced' else 'guest.link_revoked' end,'requests',r.id,
 jsonb_build_object('revoked_grant_id',g.id,'new_grant_id',created_grant));
 return jsonb_build_object('guest',true,'token',secret,'active',p_action='replace');
end $$;
revoke all on function public.manage_guest_link(uuid,text) from public,anon,authenticated;
grant execute on function public.manage_guest_link(uuid,text) to authenticated;
