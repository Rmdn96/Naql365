-- Public catalogue identifiers only; no customer addresses or financial configuration.
create or replace function public.public_market_catalogue() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'country',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,
 'currency',m.currency,'timezone',m.timezone,'services',(
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nameAr',s.name_ar,'nameEn',s.name_en) order by s.code),'[]')
 from public.market_services ms join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where ms.market_id=m.id and ms.organization_id=m.organization_id and ms.active and s.active
 and exists(select 1 from public.service_areas a where a.market_id=m.id and a.service_id=s.id and a.active)
 ),'cities',(
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nameAr',c.name_ar,'nameEn',c.name_en) order by c.code),'[]')
 from public.market_cities c where c.organization_id=m.organization_id and c.market_id=m.id
 and exists(select 1 from public.service_areas a join public.market_services ms on ms.market_id=a.market_id and ms.service_id=a.service_id and ms.organization_id=a.organization_id join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where a.city_id=c.id and a.market_id=m.id and a.active and ms.active and s.active)
 )) order by m.country_code),'[]') from public.markets m
 join private.customer_enrollment e on e.organization_id=m.organization_id
 where m.active and m.country_code in ('SA','EG')
$$;
