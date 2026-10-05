-- A client uses Web Crypto to retain a 256-bit capability in memory across network retries.
-- Only its verifier is persisted. Grant rotation/revocation also invalidate creation replay.
drop function public.start_guest_request(text);
create function public.start_guest_request(p_country text,p_creation_token text default null) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare policy private.guest_policy; market public.markets; customer_id uuid; r public.requests;
 secret text; grant_id uuid; prior private.guest_access_grants;
begin
 if p_country is null or p_country not in ('SA','EG') then raise exception 'Select a country' using errcode='22023'; end if;
 select p.* into policy from private.guest_policy p join private.customer_enrollment e using(organization_id) where p.enabled;
 if not found then raise exception 'Guest requests unavailable' using errcode='55000'; end if;
 select * into market from public.markets where organization_id=policy.organization_id and country_code=p_country and active;
 if not found then raise exception 'Market unavailable' using errcode='55000'; end if;
 if p_creation_token is not null then
  if p_creation_token !~ '^g1_[0-9a-f]{64}$' then raise exception 'Invalid creation capability' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_creation_token,72));
  select * into prior from private.guest_access_grants where verifier=sha256(convert_to(p_creation_token,'UTF8')) for update;
  if found then
   if prior.revoked_at is not null or prior.expires_at<=clock_timestamp() or prior.organization_id<>policy.organization_id
   then raise exception 'Creation capability unavailable' using errcode='42501'; end if;
   select * into r from public.requests where id=prior.request_id;
   if r.market_id<>market.id then raise exception 'Creation country changed' using errcode='22023'; end if;
   return jsonb_build_object('token',p_creation_token,'request',private.request_result(r));
  end if;
 end if;
 -- Global tenant budget cannot be evaded by forged IP/fingerprint headers.
 perform private.consume_guest_budget(policy.organization_id,'create',policy.organization_id,policy.creations_per_hour,true);
 insert into public.customers(organization_id,identity_kind) values(policy.organization_id,'GUEST') returning id into customer_id;
 r=private.initialize_customer_request(customer_id,market.id,gen_random_uuid());
 -- Three cryptographically random v4 UUIDs provide >256 bits of entropy before SHA-256.
 secret=coalesce(p_creation_token,'g1_'||encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex'));
 insert into private.guest_access_grants(organization_id,customer_id,request_id,verifier,expires_at)
 values(policy.organization_id,customer_id,r.id,sha256(convert_to(secret,'UTF8')),clock_timestamp()+make_interval(days=>policy.lifetime_days))
 returning id into grant_id;
 insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata)
 values(policy.organization_id,'guest.grant_issued','requests',r.id,jsonb_build_object('grant_id',grant_id));
 return jsonb_build_object('token',secret,'request',private.request_result(r));
end $$;
revoke all on function public.start_guest_request(text,text) from public;
grant execute on function public.start_guest_request(text,text) to anon,authenticated;

