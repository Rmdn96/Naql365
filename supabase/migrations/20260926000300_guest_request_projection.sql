-- Reuse the existing Request query adapter; anonymous SELECT is limited by capability RLS.
-- These booleans expose no grant metadata and do not grant any staff permission.
create function public.guest_request_visible(p_org uuid,p_request uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is null and exists(select 1 from private.guest_context() g
 where g.id is not null and g.organization_id=p_org and g.request_id=p_request)
$$;
create function public.guest_customer_visible(p_org uuid,p_customer uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is null and exists(select 1 from private.guest_context() g
 where g.id is not null and g.organization_id=p_org and g.customer_id=p_customer)
$$;
create function public.guest_catalogue_visible(p_org uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is null and exists(select 1 from private.guest_context() g
 where g.id is not null and g.organization_id=p_org)
$$;
create function public.guest_request_file_visible(p_org uuid,p_file uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.request_attachments a where a.organization_id=p_org and a.file_id=p_file
 and public.guest_request_visible(a.organization_id,a.request_id))
$$;
revoke all on function public.guest_request_visible(uuid,uuid),public.guest_customer_visible(uuid,uuid),
 public.guest_catalogue_visible(uuid),public.guest_request_file_visible(uuid,uuid) from public;
grant execute on function public.guest_request_visible(uuid,uuid),public.guest_customer_visible(uuid,uuid),
 public.guest_catalogue_visible(uuid),public.guest_request_file_visible(uuid,uuid) to anon;

grant select on public.requests,public.request_locations,public.request_items,
 public.request_additional_services,public.request_attachments,public.markets,public.market_cities,
 public.market_regions,public.service_areas,public.services,public.market_services,public.additional_services to anon;
grant select(id,organization_id,profile_id,identity_kind) on public.customers to anon;
grant select(id,mime_type,size_bytes,upload_state) on public.file_objects to anon;
create policy guest_customer_read on public.customers for select to anon
 using(public.guest_customer_visible(organization_id,id));
create policy guest_request_read on public.requests for select to anon
 using(public.guest_request_visible(organization_id,id));
create policy guest_locations_read on public.request_locations for select to anon
 using(public.guest_request_visible(organization_id,request_id));
create policy guest_items_read on public.request_items for select to anon
 using(public.guest_request_visible(organization_id,request_id));
create policy guest_additional_read on public.request_additional_services for select to anon
 using(public.guest_request_visible(organization_id,request_id));
create policy guest_attachments_read on public.request_attachments for select to anon
 using(public.guest_request_visible(organization_id,request_id));
create policy guest_file_metadata_read on public.file_objects for select to anon
 using(public.guest_request_file_visible(organization_id,id));
do $$ declare tab text; begin
 foreach tab in array array['markets','market_cities','market_regions','service_areas','services','market_services','additional_services'] loop
  execute format('create policy guest_catalogue_read on public.%I for select to anon using(public.guest_catalogue_visible(organization_id))',tab);
 end loop;
end $$;

-- Homepage catalogue exposes only actual active services in the enrolled launch organization.
create function public.public_market_catalogue() returns jsonb
 language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'country',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,
 'currency',m.currency,'timezone',m.timezone,'services',(
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nameAr',s.name_ar,'nameEn',s.name_en) order by s.code),'[]')
 from public.market_services ms join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where ms.market_id=m.id and ms.organization_id=m.organization_id and ms.active and s.active
 and exists(select 1 from public.service_areas a where a.market_id=m.id and a.service_id=s.id and a.active)
 )) order by m.country_code),'[]') from public.markets m
 join private.customer_enrollment e on e.organization_id=m.organization_id
 where m.active and m.country_code in ('SA','EG')
$$;
revoke all on function public.public_market_catalogue() from public;
grant execute on function public.public_market_catalogue() to anon,authenticated;
