-- Expiry is a durable lifecycle transition. Returning an application-level
-- failure marker lets PostgreSQL commit the EXPIRED state before the server
-- maps the response to a validation error.
create or replace function public.respond_to_quote(
  p_quote_version_id uuid,
  p_action text,
  p_idempotency_key text,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v public.quote_versions;
  q public.quotes;
  r public.requests;
  existing public.orders;
  created public.orders;
begin
  select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
  select * into q from public.quotes where id=v.quote_id;
  select * into r from public.requests where id=q.request_id and organization_id=q.organization_id;
  if not found or not private.owns_request(q.organization_id,q.request_id) or not private.has_permission(q.organization_id,'account.access') then
    raise exception 'Quote unavailable' using errcode='42501';
  end if;
  if p_action not in ('accept','reject') or p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200 or p_reason is not null and length(p_reason)>500 then
    raise exception 'Invalid response' using errcode='22023';
  end if;
  if p_action='accept' then
    select * into existing from public.orders where organization_id=q.organization_id and accepted_quote_version_id=v.id;
    if found then
      return jsonb_build_object('quote_version_id',v.id,'status','ACCEPTED','order_id',existing.id,'order_reference',existing.reference);
    end if;
  end if;
  if p_action='reject' and v.status='REJECTED' then
    return jsonb_build_object('quote_version_id',v.id,'status',v.status);
  end if;
  if v.status in ('SENT','VIEWED') and clock_timestamp()>v.expires_at then
    update public.quote_versions set status='EXPIRED' where id=v.id returning * into v;
    perform private.commercial_event(v.organization_id,'quote.expired','quote_versions',v.id);
    return jsonb_build_object('quote_version_id',v.id,'status','EXPIRED','error_code','QUOTE_EXPIRED');
  end if;
  if v.status not in ('SENT','VIEWED') then
    raise exception 'Quote cannot be changed' using errcode='55000';
  end if;
  if p_action='reject' then
    update public.quote_versions set status='REJECTED',rejected_at=now(),rejection_reason=nullif(btrim(p_reason),'') where id=v.id returning * into v;
    perform private.commercial_event(v.organization_id,'quote.rejected','quote_versions',v.id);
    return jsonb_build_object('quote_version_id',v.id,'status',v.status);
  end if;
  update public.quote_versions set status='ACCEPTED',accepted_at=now() where id=v.id returning * into v;
  insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,currency,subtotal_minor,vat_amount_minor,total_minor,accepted_at)
  values(v.organization_id,v.quote_id,v.id,p_idempotency_key,private.next_commercial_reference('order','O'),q.request_id,r.customer_id,v.distance_km,v.distance_source,v.currency,v.final_subtotal_minor,v.vat_amount_minor,v.total_minor,v.accepted_at)
  returning * into created;
  perform private.commercial_event(v.organization_id,'quote.accepted','quote_versions',v.id,'{"analytics_event":"quote_accepted"}'::jsonb);
  perform private.commercial_event(v.organization_id,'order.created','orders',created.id,jsonb_build_object('quote_version_id',v.id));
  return jsonb_build_object('quote_version_id',v.id,'status',v.status,'order_id',created.id,'order_reference',created.reference);
end $$;

revoke all on function public.respond_to_quote(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.respond_to_quote(uuid,text,text,text) to authenticated;
