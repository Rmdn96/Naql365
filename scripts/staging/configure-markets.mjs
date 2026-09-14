// Explicit synthetic coverage activation. Geographic presence never implies commercial coverage.
import { stagingProject, query } from './supabase.mjs';
const ref = stagingProject();
if (!process.argv.includes('--apply'))
  throw new Error('Pass --apply for Staging-only market configuration');
const org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
  ?.organization_id;
if (!org || !/^[a-f0-9-]{36}$/.test(org)) throw new Error('Configure Staging intake first');
query(
  ref,
  `begin;
select private.provision_initial_market_catalogue('${org}');
update public.markets set active=true where organization_id='${org}' and country_code in ('SA','EG');
insert into public.market_services(organization_id,market_id,service_id,active)
select s.organization_id,m.id,s.id,s.active from public.services s join public.markets m on m.organization_id=s.organization_id
where s.organization_id='${org}' and m.country_code in ('SA','EG')
on conflict(organization_id,market_id,service_id) do update set active=excluded.active;
insert into public.service_areas(organization_id,market_id,service_id,city_id,active)
select s.organization_id,s.market_id,s.service_id,c.id,true from public.market_services s
join public.market_cities c on c.market_id=s.market_id
where s.organization_id='${org}' and s.active and c.code in ('riyadh','jeddah','cairo','alexandria')
on conflict(organization_id,market_id,service_id,city_id) do update set active=true;
commit;`,
);
console.log(
  JSON.stringify({
    configured: true,
    environment: 'Staging',
    coverage: 'synthetic acceptance only',
    productionChanged: false,
  }),
);
