import { randomUUID } from 'node:crypto';
import { stagingProject, query } from './supabase.mjs';
const ref = stagingProject();
if (!process.argv.includes('--apply'))
  throw new Error('Pass --apply to configure the verified Staging intake catalogue');
const existing = query(
  ref,
  'select organization_id from private.customer_enrollment where singleton',
);
const org = existing[0]?.organization_id ?? randomUUID();
if (!/^[a-f0-9-]{36}$/.test(org)) throw new Error('Invalid organization identifier');
query(
  ref,
  `begin;
 insert into public.organizations(id,name) values('${org}','Naql365 Staging') on conflict(id) do nothing;
 insert into private.customer_enrollment values(true,'${org}') on conflict(singleton) do nothing;
 insert into public.services(organization_id,code,name_ar,name_en,active,property_required) values
 ('${org}','furniture','نقل الأثاث','Furniture moving',true,true),
 ('${org}','goods','نقل البضائع','Goods transport',true,false),
 ('${org}','within-city','نقل داخل المدينة','Within-city transport',true,false),
 ('${org}','intercity','نقل بين المدن','Intercity transport',true,false),
 ('${org}','business','نقل الأعمال','Business logistics',true,false)
 on conflict(organization_id,code) do nothing;
 insert into public.additional_services(organization_id,code,name_ar,name_en,active) values
 ('${org}','packing','تغليف','Packing',true),('${org}','loading','تحميل','Loading',true),
 ('${org}','unloading','تنزيل','Unloading',true),('${org}','disassembly','فك','Disassembly',true),('${org}','assembly','تركيب','Assembly',true)
 on conflict(organization_id,code) do nothing;
 commit;`,
);
console.log(
  JSON.stringify({
    configured: true,
    organizationId: org,
    environment: 'Staging',
    businessDataCreated: false,
  }),
);
