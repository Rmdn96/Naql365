// Explicit, bounded Staging launch configuration. Never invoked by a schema migration.
import { stagingProject, query } from './supabase.mjs';
const ref = stagingProject();
if (!process.argv.includes('--apply'))
  throw Error('Explicit --apply required for Staging launch configuration');
const org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
  ?.organization_id;
if (!org || !/^[a-f0-9-]{36}$/.test(org)) throw Error('Staging organization unavailable');
query(
  ref,
  `begin;
insert into public.services(organization_id,code,name_ar,name_en,active,property_required) values
('${org}','household-relocation','نقل منزل','Household relocation',true,true),
('${org}','office-relocation','نقل مكتب','Office relocation',true,true)
on conflict(organization_id,code) do nothing;
insert into public.additional_services(organization_id,code,name_ar,name_en,active)
values('${org}','unpacking','فك التغليف','Unpacking',true) on conflict(organization_id,code) do nothing;
insert into public.market_services(organization_id,market_id,service_id,active)
select m.organization_id,m.id,s.id,true from public.markets m join public.services s on s.organization_id=m.organization_id
where m.organization_id='${org}' and m.country_code in ('SA','EG') and s.code in ('goods','furniture','household-relocation','office-relocation') and s.active
on conflict(organization_id,market_id,service_id) do update set active=true;
insert into public.service_areas(organization_id,market_id,service_id,city_id,active,pickup_eligible,delivery_eligible)
select ms.organization_id,ms.market_id,ms.service_id,c.id,true,c.code in ('riyadh','cairo'),true
from public.market_services ms join public.market_cities c on c.market_id=ms.market_id and c.organization_id=ms.organization_id
where ms.organization_id='${org}' and ms.active and c.code in ('riyadh','jeddah','cairo','alexandria')
on conflict(organization_id,market_id,service_id,city_id) do update set pickup_eligible=excluded.pickup_eligible,delivery_eligible=excluded.delivery_eligible;
update public.service_areas a set pickup_eligible=(c.code in ('riyadh','cairo')),delivery_eligible=true
from public.market_cities c where a.organization_id='${org}' and a.city_id=c.id and a.market_id=c.market_id and a.active;
insert into public.service_addon_applicability(organization_id,market_id,service_id,additional_service_id,active)
select ms.organization_id,ms.market_id,ms.service_id,a.id,true from public.market_services ms
join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
join public.additional_services a on a.organization_id=ms.organization_id
where ms.organization_id='${org}' and ms.active and s.code in ('goods','furniture','household-relocation','office-relocation')
and a.active and (a.code in ('packing','unpacking','loading','unloading') or (s.code<>'goods' and a.code in ('assembly','disassembly')))
on conflict(organization_id,market_id,service_id,additional_service_id) do update set active=true;
insert into public.pricing_settings(organization_id,market_id,currency,pricing_mode)
select organization_id,id,currency,'MANUAL' from public.markets where organization_id='${org}' and country_code in ('SA','EG')
on conflict(organization_id,market_id) do update set pricing_mode='MANUAL';
commit;`,
);
const modes = query(
  ref,
  `select m.country_code,s.pricing_mode from public.pricing_settings s join public.markets m on m.id=s.market_id and m.organization_id=s.organization_id where s.organization_id='${org}' order by m.country_code`,
);
if (modes.length !== 2 || modes.some((m) => m.pricing_mode !== 'MANUAL'))
  throw Error('MANUAL readback failed');
console.log(
  JSON.stringify({
    environment: 'Staging',
    modes,
    syntheticCoverageOnly: true,
    productionChanged: false,
  }),
);
