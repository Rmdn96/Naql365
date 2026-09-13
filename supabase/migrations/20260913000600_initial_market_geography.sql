-- Administrative provisioning for initial catalogue; no client grants or service activation.
create function private.provision_initial_market_catalogue(p_organization_id uuid) returns void
language plpgsql set search_path='' as $$ begin
insert into public.markets(organization_id,country_code,name_ar,name_en,currency,timezone,phone_country_code)
values(p_organization_id,'SA','السعودية','Saudi Arabia','SAR','Asia/Riyadh','+966'),
(p_organization_id,'EG','مصر','Egypt','EGP','Africa/Cairo','+20')
on conflict(organization_id,country_code) do nothing;
-- Geographic catalogue only. This does not activate a market or any service coverage.
-- Stable codes identify catalogue records within their market; display names are not keys.
insert into public.market_regions(organization_id,market_id,code,name_ar,name_en,administrative_type)
select m.organization_id,m.id,c.code,c.ar,c.en,c.kind from (select * from public.markets where organization_id=p_organization_id) m
join (values
 ('SA','riyadh','الرياض','Riyadh','province'),
 ('SA','makkah','مكة المكرمة','Makkah','province'),
 ('EG','cairo','القاهرة','Cairo','governorate'),
 ('EG','alexandria','الإسكندرية','Alexandria','governorate')
) c(country,code,ar,en,kind) on c.country=m.country_code
on conflict(organization_id,market_id,code) do nothing;
insert into public.market_cities(organization_id,market_id,region_id,code,name_ar,name_en)
select m.organization_id,m.id,r.id,c.code,c.ar,c.en from (select * from public.markets where organization_id=p_organization_id) m
join (values
 ('SA','riyadh','riyadh','الرياض','Riyadh'),
 ('SA','makkah','jeddah','جدة','Jeddah'),
 ('EG','cairo','cairo','القاهرة','Cairo'),
 ('EG','alexandria','alexandria','الإسكندرية','Alexandria')
) c(country,region,code,ar,en) on c.country=m.country_code
join public.market_regions r on r.market_id=m.id and r.code=c.region
on conflict(organization_id,market_id,region_id,code) do nothing;

end $$;
revoke all on function private.provision_initial_market_catalogue(uuid) from public,anon,authenticated;
select private.provision_initial_market_catalogue(id) from public.organizations;
