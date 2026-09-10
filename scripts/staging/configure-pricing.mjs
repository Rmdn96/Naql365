import { stagingProject, query } from './supabase.mjs';
const ref = stagingProject();
if (!process.argv.includes('--apply'))
  throw new Error('Pass --apply to configure verified Staging pricing');
const org = query(ref, 'select organization_id from private.customer_enrollment where singleton')[0]
  ?.organization_id;
if (!org || !/^[a-f0-9-]{36}$/.test(org)) throw new Error('Configure Staging intake first');
query(
  ref,
  `begin;
 insert into public.pricing_settings(organization_id,vat_rate_bps) values('${org}',1500)
 on conflict(organization_id) do update set vat_rate_bps=excluded.vat_rate_bps;
 insert into public.vehicle_pricing_classes(organization_id,code,name_ar,name_en,active) values
 ('${org}','small','شاحنة صغيرة','Small truck',true),('${org}','medium','شاحنة متوسطة','Medium truck',true),('${org}','large','شاحنة كبيرة','Large truck',true)
 on conflict(organization_id,code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,active=excluded.active;
 insert into public.pricing_rules(organization_id,code,version,component_code,selector_code,calculation_method,amount_minor,active,label_ar,label_en) values
 ('${org}','service-furniture',1,'SERVICE','furniture','FIXED',10000,true,'الخدمة الأساسية','Base service'),
 ('${org}','service-goods',1,'SERVICE','goods','FIXED',9000,true,'الخدمة الأساسية','Base service'),
 ('${org}','service-within-city',1,'SERVICE','within-city','FIXED',8000,true,'الخدمة الأساسية','Base service'),
 ('${org}','service-intercity',1,'SERVICE','intercity','FIXED',12000,true,'الخدمة الأساسية','Base service'),
 ('${org}','service-business',1,'SERVICE','business','FIXED',11000,true,'الخدمة الأساسية','Base service'),
 ('${org}','distance',1,'DISTANCE',null,'PER_KM',250,true,'المسافة','Distance'),
 ('${org}','vehicle-small',1,'VEHICLE','small','FIXED',3000,true,'المركبة المقدرة','Estimated vehicle'),
 ('${org}','vehicle-medium',1,'VEHICLE','medium','FIXED',6000,true,'المركبة المقدرة','Estimated vehicle'),
 ('${org}','vehicle-large',1,'VEHICLE','large','FIXED',9000,true,'المركبة المقدرة','Estimated vehicle'),
 ('${org}','workers',1,'WORKERS',null,'PER_UNIT',1000,true,'العمال المقدرون','Estimated workers'),
 ('${org}','loading',1,'LOADING',null,'FIXED',1500,true,'التحميل','Loading'),
 ('${org}','unloading',1,'UNLOADING',null,'FIXED',1500,true,'التنزيل','Unloading'),
 ('${org}','packing',1,'PACKING',null,'FIXED',2500,true,'التغليف','Packing'),
 ('${org}','disassembly',1,'DISASSEMBLY',null,'FIXED',2000,true,'الفك','Disassembly'),
 ('${org}','assembly',1,'ASSEMBLY',null,'FIXED',2000,true,'التركيب','Assembly'),
 ('${org}','floor-access',1,'FLOOR_ACCESS',null,'PER_UNIT',200,true,'الوصول للطوابق','Floor access'),
 ('${org}','elevator',1,'ELEVATOR',null,'FIXED',0,true,'توفر المصعد','Elevator access'),
 ('${org}','within-city',1,'WITHIN_CITY',null,'FIXED',500,true,'نقل داخل المدينة','Within-city transport'),
 ('${org}','intercity',1,'INTERCITY',null,'FIXED',10000,true,'نقل بين المدن','Intercity transport')
 on conflict(organization_id,code,version) do update set component_code=excluded.component_code,selector_code=excluded.selector_code,calculation_method=excluded.calculation_method,amount_minor=excluded.amount_minor,active=excluded.active,label_ar=excluded.label_ar,label_en=excluded.label_en;
 commit;`,
);
console.log(
  JSON.stringify({
    configured: true,
    environment: 'Staging',
    source: 'repository-managed acceptance catalogue',
    productionChanged: false,
  }),
);
