import { stagingProject, query } from './supabase.mjs';
const ref = stagingProject();
if (!process.argv.includes('--apply'))
  throw new Error('Pass --apply to configure verified Staging pricing');
const org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
  ?.organization_id;
if (!org || !/^[a-f0-9-]{36}$/.test(org)) throw new Error('Configure Staging intake first');
const markets = query(
  ref,
  `select id,currency,country_code from public.markets where organization_id='${org}' and active`,
);
if (markets.length !== 2) throw new Error('Configure both Staging markets first');
for (const market of markets) {
  if (!/^[a-f0-9-]{36}$/.test(market.id) || !['SAR', 'EGP'].includes(market.currency))
    throw new Error('Invalid market configuration');
  query(
    ref,
    `begin;
 insert into public.pricing_settings(organization_id,market_id,currency) values('${org}','${market.id}','${market.currency}') on conflict(organization_id,market_id) do nothing;
 update public.market_tax_versions set active=false where organization_id='${org}' and market_id='${market.id}' and active;
 insert into public.market_tax_versions(organization_id,market_id,code,version,rate_bps,label_ar,label_en,active,effective_from,configuration_kind)
 values('${org}','${market.id}','staging-synthetic',1,${market.country_code === 'SA' ? 1500 : 2000},'ضريبة اختبار فقط','Synthetic test tax only',true,'2026-01-01Z','STAGING_TEST')
 on conflict(organization_id,market_id,code,version) do update set active=true;
 insert into public.vehicle_pricing_classes(organization_id,market_id,code,name_ar,name_en,active) values
 ('${org}','${market.id}','small','شاحنة صغيرة','Small truck',true),('${org}','${market.id}','medium','شاحنة متوسطة','Medium truck',true),('${org}','${market.id}','large','شاحنة كبيرة','Large truck',true)
 on conflict(organization_id,market_id,code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,active=excluded.active;
 insert into public.pricing_rules(organization_id,market_id,code,version,component_code,selector_code,calculation_method,amount_minor,active,label_ar,label_en) values
 ('${org}','${market.id}','service-furniture',1,'SERVICE','furniture','FIXED',10000,true,'الخدمة الأساسية','Base service'),
 ('${org}','${market.id}','service-goods',1,'SERVICE','goods','FIXED',9000,true,'الخدمة الأساسية','Base service'),
 ('${org}','${market.id}','service-within-city',1,'SERVICE','within-city','FIXED',8000,true,'الخدمة الأساسية','Base service'),
 ('${org}','${market.id}','service-intercity',1,'SERVICE','intercity','FIXED',12000,true,'الخدمة الأساسية','Base service'),
 ('${org}','${market.id}','service-business',1,'SERVICE','business','FIXED',11000,true,'الخدمة الأساسية','Base service'),
 ('${org}','${market.id}','distance',1,'DISTANCE',null,'PER_KM',250,true,'المسافة','Distance'),
 ('${org}','${market.id}','vehicle-small',1,'VEHICLE','small','FIXED',3000,true,'المركبة المقدرة','Estimated vehicle'),
 ('${org}','${market.id}','vehicle-medium',1,'VEHICLE','medium','FIXED',6000,true,'المركبة المقدرة','Estimated vehicle'),
 ('${org}','${market.id}','vehicle-large',1,'VEHICLE','large','FIXED',9000,true,'المركبة المقدرة','Estimated vehicle'),
 ('${org}','${market.id}','workers',1,'WORKERS',null,'PER_UNIT',1000,true,'العمال المقدرون','Estimated workers'),
 ('${org}','${market.id}','loading',1,'LOADING',null,'FIXED',1500,true,'التحميل','Loading'),
 ('${org}','${market.id}','unloading',1,'UNLOADING',null,'FIXED',1500,true,'التنزيل','Unloading'),
 ('${org}','${market.id}','packing',1,'PACKING',null,'FIXED',2500,true,'التغليف','Packing'),
 ('${org}','${market.id}','disassembly',1,'DISASSEMBLY',null,'FIXED',2000,true,'الفك','Disassembly'),
 ('${org}','${market.id}','assembly',1,'ASSEMBLY',null,'FIXED',2000,true,'التركيب','Assembly'),
 ('${org}','${market.id}','floor-access',1,'FLOOR_ACCESS',null,'PER_UNIT',200,true,'الوصول للطوابق','Floor access'),
 ('${org}','${market.id}','elevator',1,'ELEVATOR',null,'FIXED',0,true,'توفر المصعد','Elevator access'),
 ('${org}','${market.id}','within-city',1,'WITHIN_CITY',null,'FIXED',500,true,'نقل داخل المدينة','Within-city transport'),
 ('${org}','${market.id}','intercity',1,'INTERCITY',null,'FIXED',10000,true,'نقل بين المدن','Intercity transport')
 on conflict(organization_id,market_id,code,version) do update set component_code=excluded.component_code,selector_code=excluded.selector_code,calculation_method=excluded.calculation_method,amount_minor=excluded.amount_minor,active=excluded.active,label_ar=excluded.label_ar,label_en=excluded.label_en;
 commit;`,
  );
}
console.log(
  JSON.stringify({
    configured: true,
    environment: 'Staging',
    source: 'repository-managed acceptance catalogue',
    productionChanged: false,
  }),
);
