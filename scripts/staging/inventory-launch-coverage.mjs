// Read-only catalogue inventory. Project guard is shared with all Staging tooling.
import { stagingProject, query } from './supabase.mjs';
const ref = stagingProject();
const rows = query(
  ref,
  `select m.country_code,c.code,c.name_ar,c.name_en,
 count(a.id) filter(where a.active)::int active_service_coverage_rows,
 array_agg(distinct s.code) filter(where a.active) active_services
 from public.market_cities c join public.markets m on m.id=c.market_id and m.organization_id=c.organization_id
 join private.customer_enrollment e on e.organization_id=m.organization_id
 left join public.service_areas a on a.city_id=c.id and a.market_id=c.market_id and a.organization_id=c.organization_id
 left join public.services s on s.id=a.service_id
 group by m.country_code,c.code,c.name_ar,c.name_en order by m.country_code,c.code`,
);
console.log(JSON.stringify({ environment: 'Staging', readOnly: true, cities: rows }, null, 2));
