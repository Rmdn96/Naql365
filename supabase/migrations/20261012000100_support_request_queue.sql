-- Owner-approved migration 47: bounded read-only support projection only.
-- No grants on business tables, role changes, record updates or new lifecycle states.
create function public.support_request_queue(
 p_org uuid, p_market uuid, p_before_created timestamptz default null,
 p_before_id uuid default null, p_limit integer default 30
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists (
   select 1 from public.organization_memberships m where m.organization_id=p_org
   and m.profile_id=auth.uid() and m.status='active' and m.member_type='staff'
 ) or not private.has_permission(p_org,'support.read')
   or not private.has_permission(p_org,'requests.read') then
   raise exception 'Support access denied' using errcode='42501';
 end if;
 if p_market is null or not exists(select 1 from public.markets m
   where m.id=p_market and m.organization_id=p_org and m.active) then
   raise exception 'Invalid support market' using errcode='22023';
 end if;
 if p_limit is null or p_limit<1 or p_limit>30
   or (p_before_created is null)<>(p_before_id is null) then
   raise exception 'Invalid support page' using errcode='22023';
 end if;
 with candidates as (
   select r.id,r.created_at,r.updated_at,r.reference,r.contact_name,r.contact_phone,r.contact_email,
     s.name_ar,s.name_en,
     (select l.city from public.request_locations l where l.organization_id=p_org and l.request_id=r.id and l.kind='pickup' limit 1) pickup,
     (select l.city from public.request_locations l where l.organization_id=p_org and l.request_id=r.id and l.kind='delivery' limit 1) delivery,
     coalesce((select o.operational_status from public.orders o where o.organization_id=p_org and o.request_id=r.id and o.accepted_at is not null order by o.created_at desc,o.id desc limit 1),
       (select v.status from public.quotes q join public.quote_versions v on v.quote_id=q.id and v.organization_id=p_org where q.organization_id=p_org and q.request_id=r.id and v.status<>'DRAFT' order by v.version desc,v.id desc limit 1),r.status) journey
   from public.requests r left join public.services s on s.id=r.service_id and s.organization_id=p_org
   where r.organization_id=p_org and r.market_id=p_market and r.status='SUBMITTED'
     and (p_before_created is null or (r.created_at,r.id)<(p_before_created,p_before_id))
   order by r.created_at desc,r.id desc limit p_limit+1
 ), page as (select * from candidates order by created_at desc,id desc limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
   'reference',reference,'contactName',contact_name,'contactPhone',contact_phone,'contactEmail',contact_email,
   'serviceAr',name_ar,'serviceEn',name_en,'pickupCity',pickup,'deliveryCity',delivery,
   'journey',journey,'createdAt',created_at,'updatedAt',updated_at) order by created_at desc,id desc) from page),'[]'::jsonb),
   'nextCursor',case when (select count(*) from candidates)>p_limit then
     (select jsonb_build_object('createdAt',created_at,'id',id) from page order by created_at,id limit 1) else null end)
 into result;
 return result;
end $$;
revoke all on function public.support_request_queue(uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.support_request_queue(uuid,uuid,timestamptz,uuid,integer) to authenticated;
comment on function public.support_request_queue(uuid,uuid,timestamptz,uuid,integer) is 'Read-only support fields; active staff + support.read + requests.read. Cursor identifiers are pagination metadata, never authorization. No guest-link mutation.';
