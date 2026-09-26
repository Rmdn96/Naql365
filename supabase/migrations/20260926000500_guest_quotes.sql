-- Customer-safe commercial projections; staff calculations/adjustment reasons remain private.
create function public.guest_quote_visible(p_org uuid,p_quote uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quotes q where q.organization_id=p_org and q.id=p_quote
 and public.guest_request_visible(q.organization_id,q.request_id))
$$;
create function public.guest_quote_version_visible(p_org uuid,p_version uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quote_versions v where v.organization_id=p_org and v.id=p_version
 and v.status<>'DRAFT' and public.guest_quote_visible(v.organization_id,v.quote_id))
$$;
revoke all on function public.guest_quote_visible(uuid,uuid),public.guest_quote_version_visible(uuid,uuid) from public;
grant execute on function public.guest_quote_visible(uuid,uuid),public.guest_quote_version_visible(uuid,uuid) to anon;
grant select(id,reference,request_id,created_at) on public.quotes to anon;
grant select(id,version,status,currency,tax_label_ar,tax_label_en,final_subtotal_minor,vat_rate_bps,
 vat_amount_minor,total_minor,expires_at,sent_at,viewed_at,accepted_at,rejected_at,distance_km,distance_source,quote_id)
 on public.quote_versions to anon;
grant select(component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position,quote_version_id)
 on public.quote_items to anon;
grant select(id,reference,accepted_at,request_id,accepted_quote_version_id) on public.orders to anon;
-- Composite FK columns are required for PostgREST's existing nested relationship queries.
grant select(organization_id,market_id) on public.quotes,public.quote_versions,public.quote_items,public.orders to anon;
grant select(quote_id) on public.orders to anon;
create policy guest_quotes_read on public.quotes for select to anon using(public.guest_quote_visible(organization_id,id));
create policy guest_quote_versions_read on public.quote_versions for select to anon using(public.guest_quote_version_visible(organization_id,id));
create policy guest_quote_items_read on public.quote_items for select to anon using(public.guest_quote_version_visible(organization_id,quote_version_id));
create policy guest_orders_read on public.orders for select to anon using(public.guest_request_visible(organization_id,request_id));

create function public.guest_preliminary_price() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare guest private.guest_access_grants; evaluation public.pricing_evaluations;
begin
 guest=private.guest_context();
 if guest.id is null then raise exception 'Journey unavailable' using errcode='42501'; end if;
 select * into evaluation from public.pricing_evaluations where request_id=guest.request_id
 and organization_id=guest.organization_id order by calculated_at desc,id desc limit 1;
 if not found or evaluation.status='STALE' then return jsonb_build_object('state','WAITING_FOR_REVIEW'); end if;
 return jsonb_build_object('state','PRELIMINARY','subtotalMinor',evaluation.calculated_subtotal_minor,
 'currency',evaluation.currency,'calculatedAt',evaluation.calculated_at);
end $$;
revoke all on function public.guest_preliminary_price() from public;
grant execute on function public.guest_preliminary_price() to anon;

create or replace function private.commercial_event(tenant uuid,event text,entity_type text,entity uuid,details jsonb default '{}')
 returns void language plpgsql security definer set search_path='' as $$
declare guest private.guest_access_grants; request_id uuid; facts jsonb=details;
begin
 if auth.uid() is null then
  guest=private.guest_context();
  if entity_type='quote_versions' then
   select q.request_id into request_id from public.quotes q join public.quote_versions v on v.quote_id=q.id where v.id=entity and q.organization_id=tenant;
  elsif entity_type='orders' then select o.request_id into request_id from public.orders o where o.id=entity and o.organization_id=tenant;
  end if;
  if guest.organization_id=tenant and guest.request_id=request_id then facts=facts||jsonb_build_object('guest_grant_id',guest.id); end if;
 end if;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(tenant,auth.uid(),event,entity_type,entity,facts);
end $$;

create or replace function public.view_customer_quote(p_quote_version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare guest private.guest_access_grants; v public.quote_versions; q public.quotes; r public.requests;
begin
 if auth.uid() is null then guest=private.lock_guest_context(); perform private.consume_guest_budget(guest.organization_id,'mutation',guest.id,60); end if;
 select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
 select * into q from public.quotes where id=v.quote_id;
 select * into r from public.requests where id=q.request_id and organization_id=q.organization_id;
 if not found or not private.customer_request_access(q.organization_id,r.customer_id,q.request_id) or v.status='DRAFT' then raise exception 'Quote unavailable' using errcode='42501'; end if;
 if v.status in ('SENT','VIEWED') and clock_timestamp()>v.expires_at then update public.quote_versions set status='EXPIRED' where id=v.id returning * into v; perform private.commercial_event(v.organization_id,'quote.expired','quote_versions',v.id); end if;
 if v.status='SENT' then update public.quote_versions set status='VIEWED',viewed_at=now() where id=v.id returning * into v; perform private.commercial_event(v.organization_id,'quote.viewed','quote_versions',v.id,'{"analytics_event":"quote_viewed"}'::jsonb); end if;
 return private.quote_result(v);
end $$;



create or replace function public.respond_to_quote(
  p_quote_version_id uuid,
  p_action text,
  p_idempotency_key text,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  guest private.guest_access_grants;
  v public.quote_versions;
  q public.quotes;
  r public.requests;
  existing public.orders;
  created public.orders;
begin
  if auth.uid() is null then guest=private.lock_guest_context(); perform private.consume_guest_budget(guest.organization_id,'mutation',guest.id,60); end if;
  select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
  select * into q from public.quotes where id=v.quote_id;
  select * into r from public.requests where id=q.request_id and organization_id=q.organization_id;
  if not found or not private.customer_request_access(q.organization_id,r.customer_id,q.request_id) then
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
  insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,currency,subtotal_minor,vat_amount_minor,total_minor,accepted_at,tax_version_id,tax_code,tax_rate_bps,tax_label_ar,tax_label_en)
  values(v.organization_id,v.quote_id,v.id,p_idempotency_key,private.next_commercial_reference('order','O',(select timezone from public.markets where id=v.market_id)),q.request_id,r.customer_id,v.distance_km,v.distance_source,v.currency,v.final_subtotal_minor,v.vat_amount_minor,v.total_minor,v.accepted_at,v.tax_version_id,v.tax_code,v.vat_rate_bps,v.tax_label_ar,v.tax_label_en)
  returning * into created;
  perform private.commercial_event(v.organization_id,'quote.accepted','quote_versions',v.id,'{"analytics_event":"quote_accepted"}'::jsonb);
  perform private.commercial_event(v.organization_id,'order.created','orders',created.id,jsonb_build_object('quote_version_id',v.id));
  return jsonb_build_object('quote_version_id',v.id,'status',v.status,'order_id',created.id,'order_reference',created.reference);
end $$;


revoke all on function public.view_customer_quote(uuid),public.respond_to_quote(uuid,text,text,text) from public;
grant execute on function public.view_customer_quote(uuid),public.respond_to_quote(uuid,text,text,text) to anon,authenticated;
