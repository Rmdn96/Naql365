-- LOCAL reconstruction fixtures only. Everything, including helper functions,
-- synthetic scopes, roles/grants and users, is rolled back at the end.
begin;
create table public.store_test_results(case_id text not null,label text not null);
grant insert,select on public.store_test_results to authenticated,anon;
create function public.store_test_check(case_id text,ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Catalog assertion failed: % / %',case_id,label; end if;
insert into public.store_test_results values(case_id,label); end $$;
create function public.store_test_error(case_id text,statement text,expected text,label text) returns void language plpgsql as $$
declare actual text; begin
begin execute statement; exception when others then get stacked diagnostics actual=returned_sqlstate; end;
perform public.store_test_check(case_id,actual=expected,label||' expected '||expected||' got '||coalesce(actual,'success'));
end $$;

select public.store_test_check('CF01',(select count(*)=10 from pg_tables where schemaname='private' and tablename=any(array['store_policy_versions','store_suppliers','store_supplier_agreements','store_categories','store_products','store_product_market_listings','store_supplier_offers','store_market_prices','store_events','store_command_receipts'])),'ten catalog foundation tables retained');
select public.store_test_check('CF02',not exists(select 1 from private.store_policy_versions) and not exists(select 1 from private.store_products),'no scope or product seeded');
select public.store_test_check('CF08',public.store_catalog_public_v1()->>'status'='NOT_AVAILABLE','unconfigured public unavailable');
select public.store_test_check('CF16',not exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where p.code like 'store.%'),'zero accepted-role grants');
select public.store_test_check('CF40',(select count(*)=7 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['store_catalog_draft_command_v1','store_sourcing_command_v1','store_catalog_policy_command_v1','store_catalog_publication_command_v1','store_catalog_public_v1','store_catalog_workspace_v1','store_catalog_sourcing_v1'])),'seven catalog foundation RPCs retained');
select public.store_test_check('CF18',(select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'store_%' and c.relkind='r'),'RLS all ten');
select public.store_test_check('CF19',(select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname like 'store_%' and p.proname not like 'store_test_%'),'empty search paths');

insert into public.organizations(id,name) values('61000000-0000-4000-8000-000000000001','Owned catalog test'),('61000000-0000-4000-8000-000000000002','Other catalog test');
insert into auth.users(id) select ('62000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,14) n;
insert into public.organization_memberships(organization_id,profile_id,member_type,status)
 select case when n=11 then '61000000-0000-4000-8000-000000000002'::uuid else '61000000-0000-4000-8000-000000000001'::uuid end,
 ('62000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case n when 9 then 'customer' when 10 then 'driver' else 'staff' end,case when n=13 then 'suspended' else 'active' end from generate_series(1,14) n;
insert into public.organization_memberships(organization_id,profile_id,member_type) values('61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000012','staff');
insert into public.roles(id,code,member_type) select ('63000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'TEST_STORE_'||n,'staff' from generate_series(1,7) n;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p where r.code like 'TEST_STORE_%' and
 (p.code='portal.access' or (p.code like 'store.%' and
 (r.code='TEST_STORE_1' or r.code='TEST_STORE_2' and p.code in ('store.catalog.read','store.catalog.manage')
 or r.code='TEST_STORE_3' and p.code in ('store.catalog.read','store.catalog.manage','store.catalog.publish')
 or r.code='TEST_STORE_4' and p.code in ('store.catalog.read','store.sourcing.manage')
 or r.code='TEST_STORE_5' and p.code in ('store.catalog.read','store.supplier_cost.read')
 or r.code='TEST_STORE_6' and p.code in ('store.catalog.read','store.catalog.policy.manage')
 or r.code='TEST_STORE_7' and p.code in ('store.sourcing.manage','store.supplier_cost.read'))));
insert into public.user_roles(organization_id,profile_id,role_id)
 select m.organization_id,m.profile_id,r.id from public.organization_memberships m join public.roles r on r.code=case
 when right(m.profile_id::text,2)::integer between 1 and 6 then 'TEST_STORE_'||right(m.profile_id::text,2)::integer
 when right(m.profile_id::text,2)::integer=7 then 'SALES' when right(m.profile_id::text,2)::integer=8 then 'SUPER_ADMIN'
 when right(m.profile_id::text,2)::integer=9 then 'CUSTOMER' when right(m.profile_id::text,2)::integer=10 then 'DRIVER' when right(m.profile_id::text,2)::integer=14 then 'TEST_STORE_7' else 'TEST_STORE_1' end
 where m.profile_id::text like '62000000%';
insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values
 ('64000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','EG','مصر اختبار','Egypt test',true,'EGP','Africa/Cairo','+20'),
 ('64000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','SA','اختبار','SA test',true,'SAR','Asia/Riyadh','+966'),
 ('64000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000002','EG','آخر','Other test',true,'EGP','Africa/Cairo','+20');
-- Privileged fixture provisioning is NOT a production scope/configuration API.
insert into private.store_policy_versions(id,organization_id,market_id,currency,kind,policy_code,version,content,evidence_ref,status,effective_from,approved_by,approved_at)
 values('65000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','EGP','STOREFRONT_SCOPE','owned-test',1,'{"publication_enabled":true}','SYNTHETIC-LOCAL-NOT-LEGAL-APPROVAL','APPROVED','2026-01-01Z','62000000-0000-4000-8000-000000000001',now());
update private.store_policy_versions set scope_paused=false,revision=2 where id='65000000-0000-4000-8000-000000000001';

do $$ declare f record; begin
for f in select c.oid::regclass tab from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'store_%' and c.relkind='r' loop
perform public.store_test_check('CF18',not has_table_privilege('authenticated',f.tab,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('anon',f.tab,'SELECT,INSERT,UPDATE,DELETE'),f.tab::text||' ACL');
end loop;
for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'store_%' and p.proname not in ('store_proof_access','store_proof_upload','store_media_access','store_media_upload') loop
perform public.store_test_check('CF19',not has_function_privilege('authenticated',f.sig,'EXECUTE') and not has_function_privilege('anon',f.sig,'EXECUTE'),f.sig::text||' private helper denied');
end loop;
perform public.store_test_check('CF19',(select count(*)=2 and bool_and(prorettype='boolean'::regtype) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('store_media_access','store_media_upload')),'product-media policy helpers expose booleans only');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
do $$
declare o uuid='61000000-0000-4000-8000-000000000001'; m uuid='64000000-0000-4000-8000-000000000001';
 cat uuid; cat2 uuid; product uuid; product2 uuid; listing uuid; listing2 uuid; supplier uuid; agreement uuid; offer uuid; offer2 uuid; price uuid; price2 uuid;
 policies uuid[]='{}'; kinds text[]=array['PUBLICATION_IDENTITY','RETAIL_PRESENTATION','DELIVERY_PRESENTATION','RETURNS_PRESENTATION'];
r jsonb; replay jsonb; intent jsonb; mutate uuid=gen_random_uuid(); v integer; pub jsonb; before_pub jsonb; before_events integer; unpriced uuid; parent_node uuid;
 title jsonb='{"title_ar":"منتج تجريبي","title_en":"Synthetic product"}'; n integer;
begin
perform public.store_test_error('CF04',format('select public.store_catalog_workspace_v1(%L,%L)','61000000-0000-4000-8000-000000000002',m),'42501','foreign org denied');
perform public.store_test_error('CF07',format('select public.store_catalog_workspace_v1(%L,%L)',o,'64000000-0000-4000-8000-000000000002'),'42501','SA denied');
perform public.store_test_error('CF07',format('select public.store_catalog_workspace_v1(%L,%L)',o,gen_random_uuid()),'42501','unknown market denied');
perform public.store_test_check('CF07',public.store_catalog_public_v1('SA')->>'status'='NOT_AVAILABLE','SA no Store');
perform public.store_test_error('CF18','select * from private.store_supplier_offers','42501','direct cost access denied');
perform public.store_test_error('CF18','insert into private.store_suppliers(organization_id,reference,name) values(gen_random_uuid(),''bypass'',''bypass'')','42501','direct write denied');
perform public.store_test_error('CF08',format('select public.store_catalog_policy_command_v1(%L,%L,''create_policy'',gen_random_uuid(),null,null,%L::jsonb)',o,m,'{"kind":"STOREFRONT_SCOPE","policy_code":"other","version":1,"content":{"publication_enabled":true},"effective_from":"2026-01-01Z"}'),'42501','scope creation denied to all grants');
perform public.store_test_error('CF08',format('select public.store_catalog_policy_command_v1(%L,%L,''revoke_policy'',gen_random_uuid(),''65000000-0000-4000-8000-000000000001'',2,''{"reason":"test"}'')',o,m),'42501','scope mutation denied');

for n in 1..4 loop
r=public.store_catalog_policy_command_v1(o,m,'create_policy',gen_random_uuid(),null,null,jsonb_build_object('kind',kinds[n],'policy_code','owned-policy-'||n,'version',1,'content',title||jsonb_build_object('body_ar','نص اختبار فقط','body_en','Synthetic display only'),'effective_from','2026-01-01Z','evidence_ref','LOCAL-SYNTHETIC-DECISION'));
policies=policies||array[(r->>'id')::uuid];
perform public.store_catalog_policy_command_v1(o,m,'approve_policy',gen_random_uuid(),policies[n],1,'{}');
end loop;
perform public.store_test_check('CF14',array_length(policies,1)=4,'typed non-scope policies');
intent=jsonb_build_object('slug','owned-category','content',title);
r=public.store_catalog_draft_command_v1(o,m,'create_category',mutate,null,null,intent);cat=(r->>'id')::uuid;
replay=public.store_catalog_draft_command_v1(o,m,'create_category',mutate,null,null,intent);
perform public.store_test_check('CF30',replay->>'id'=r->>'id' and replay->'replayed'='true','same key safe replay');
perform public.store_test_error('CF31',format('select public.store_catalog_draft_command_v1(%L,%L,''create_category'',%L,null,null,%L::jsonb)',o,m,mutate,intent||'{"slug":"changed"}'::jsonb),'PT409','changed intent conflict');
perform public.store_catalog_publication_command_v1(o,m,'approve_category',gen_random_uuid(),cat,1,'{"parent_revision":null}');
r=public.store_catalog_draft_command_v1(o,m,'create_category',gen_random_uuid(),null,null,jsonb_build_object('slug','owned-category-2','parent_id',cat,'content',title));cat2=(r->>'id')::uuid;
perform public.store_catalog_publication_command_v1(o,m,'approve_category',gen_random_uuid(),cat2,1,'{"parent_revision":2}');
perform public.store_test_error('CF29',format('select public.store_catalog_draft_command_v1(%L,%L,''save_category'',gen_random_uuid(),%L,2,%L::jsonb)',o,m,cat,jsonb_build_object('parent_id',cat2,'content',title)),'22023','ancestor cycle denied');
r=public.store_catalog_draft_command_v1(o,m,'create_product',gen_random_uuid(),null,null,jsonb_build_object('sku','OWNED-1','slug','owned-product-1','category_id',cat,'content',title));product=(r->>'id')::uuid;
r=public.store_catalog_draft_command_v1(o,m,'create_product',gen_random_uuid(),null,null,jsonb_build_object('sku','OWNED-2','slug','owned-product-2','category_id',cat,'content',title));product2=(r->>'id')::uuid;
r=public.store_catalog_draft_command_v1(o,m,'create_listing',gen_random_uuid(),null,null,jsonb_build_object('product_id',product));listing=(r->>'id')::uuid;
r=public.store_catalog_draft_command_v1(o,m,'create_listing',gen_random_uuid(),null,null,jsonb_build_object('product_id',product2));listing2=(r->>'id')::uuid;
r=public.store_sourcing_command_v1(o,m,'create_supplier',gen_random_uuid(),null,null,'{"reference":"OWNED-SUPPLIER","name":"Synthetic local supplier"}');supplier=(r->>'id')::uuid;
r=public.store_sourcing_command_v1(o,m,'create_agreement',gen_random_uuid(),null,null,jsonb_build_object('supplier_id',supplier,'agreement_code','TEST','version',1,'terms',jsonb_build_object('reference','LOCAL-PRIVATE','summary','PRIVATE-SUPPLIER-TERMS'),'effective_from','2026-01-01Z','evidence_ref','LOCAL-NOT-LEGAL'));
agreement=(r->>'id')::uuid;perform public.store_sourcing_command_v1(o,m,'approve_agreement',gen_random_uuid(),agreement,1,'{}');
r=public.store_sourcing_command_v1(o,m,'create_offer',gen_random_uuid(),null,null,jsonb_build_object('product_id',product,'supplier_id',supplier,'agreement_id',agreement,'offer_key','TEST','version',1,'unit_cost_minor',27183,'effective_from','2026-01-01Z','evidence_ref','PRIVATE-OFFER-EVIDENCE'));
offer=(r->>'id')::uuid;perform public.store_sourcing_command_v1(o,m,'approve_offer',gen_random_uuid(),offer,1,'{}');
r=public.store_sourcing_command_v1(o,m,'create_offer',gen_random_uuid(),null,null,jsonb_build_object('product_id',product2,'supplier_id',supplier,'agreement_id',agreement,'offer_key','TEST','version',1,'unit_cost_minor',27183,'effective_from','2026-01-01Z','evidence_ref','PRIVATE-OFFER-EVIDENCE'));
offer2=(r->>'id')::uuid;perform public.store_sourcing_command_v1(o,m,'approve_offer',gen_random_uuid(),offer2,1,'{}');
r=public.store_catalog_draft_command_v1(o,m,'create_price',gen_random_uuid(),null,null,jsonb_build_object('listing_id',listing,'version',1,'amount_minor',100000,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z'));
price=(r->>'id')::uuid;perform public.store_catalog_publication_command_v1(o,m,'approve_price',gen_random_uuid(),price,1,'{}');
r=public.store_catalog_draft_command_v1(o,m,'create_price',gen_random_uuid(),null,null,jsonb_build_object('listing_id',listing2,'version',1,'amount_minor',100000,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z'));
price2=(r->>'id')::uuid;perform public.store_catalog_publication_command_v1(o,m,'approve_price',gen_random_uuid(),price2,1,'{}');

pub=jsonb_build_object('product_revision',1,'category_revision',2,'price_id',price,'price_revision',2,'offer_id',offer,'offer_revision',2,
'identity_policy_id',policies[1],'identity_policy_revision',2,'delivery_policy_id',policies[3],'delivery_policy_revision',2,'returns_policy_id',policies[4],'returns_policy_revision',2);
perform public.store_test_error('CF05',format('select public.store_catalog_publication_command_v1(%L,%L,''publish_listing'',gen_random_uuid(),%L,1,%L::jsonb)',o,m,listing,pub||jsonb_build_object('offer_id',offer2)),'PT409','wrong-product offer denied');
perform public.store_test_error('CF06',format('select public.store_catalog_publication_command_v1(%L,%L,''publish_listing'',gen_random_uuid(),%L,1,%L::jsonb)',o,m,listing,pub||jsonb_build_object('price_id',price2)),'PT409','wrong-listing price denied');
perform public.store_test_error('CF25',format('select public.store_catalog_publication_command_v1(%L,%L,''publish_listing'',gen_random_uuid(),%L,1,%L::jsonb)',o,m,listing,pub||jsonb_build_object('identity_policy_id',policies[2])),'PT409','wrong policy kind denied');
-- Publisher has no supplier-cost grant, but can publish eligible exact versions.
perform set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000003',true);
perform public.store_catalog_publication_command_v1(o,m,'publish_listing',gen_random_uuid(),listing,1,pub);
perform public.store_test_check('CF12',jsonb_array_length(public.store_catalog_public_v1()->'items')=1,'publisher without cost grant allowed');
perform public.store_test_error('CF12',format('select public.store_catalog_sourcing_v1(%L,%L)',o,m),'42501','publisher denied costs');
perform set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
before_pub=public.store_catalog_public_v1();
perform public.store_test_check('CF20',before_pub::text !~ '27183|PRIVATE-|unitCost|agreement|supplier|evidence|selected_offer','public cost whitelist');
perform public.store_test_check('CF20',public.store_catalog_workspace_v1(o,m,'listings')::text !~ '27183|PRIVATE-|unitCost|agreement|supplier|selectedOffer','workspace whitelist');
perform public.store_test_check('CF13',public.store_catalog_sourcing_v1(o,m)::text like '%27183%','cost conjunction allowed');
perform public.store_test_check('CF37',before_pub->'items'->0->'amountMinor'='100000','approved exact retail amount');
perform public.store_test_check('CF39',before_pub->'items'->0->'media'='[]','no media workflow');

perform public.store_catalog_draft_command_v1(o,m,'save_product',gen_random_uuid(),product,1,jsonb_build_object('category_id',cat2,'content',title||'{"title_en":"Changed private draft"}'::jsonb));
perform public.store_catalog_draft_command_v1(o,m,'save_category',gen_random_uuid(),cat,2,jsonb_build_object('content',title||'{"title_en":"Changed private category"}'::jsonb));
perform public.store_test_check('CF22',public.store_catalog_public_v1()=before_pub,'draft product/category edits do not change public snapshot');
perform public.store_test_error('CF23',format('select public.store_catalog_draft_command_v1(%L,%L,''save_price'',gen_random_uuid(),%L,2,%L::jsonb)',o,m,price,jsonb_build_object('amount_minor',1,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z')),'PT409','approved price frozen');
perform public.store_test_error('CF32',format('select public.store_catalog_draft_command_v1(%L,%L,''save_product'',gen_random_uuid(),%L,1,%L::jsonb)',o,m,product,jsonb_build_object('category_id',cat,'content',title)),'PT409','stale revision denied');
perform public.store_test_error('CF24',format('select public.store_catalog_draft_command_v1(%L,%L,''create_price'',gen_random_uuid(),null,null,%L::jsonb)',o,m,jsonb_build_object('listing_id',listing,'version',2,'amount_minor',1.5,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z')),'22023','fractional money denied');
perform public.store_test_error('CF24',format('select public.store_catalog_draft_command_v1(%L,%L,''create_price'',gen_random_uuid(),null,null,%L::jsonb)',o,m,jsonb_build_object('listing_id',listing,'version',2,'amount_minor',9007199254740992,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z')),'22023','money overflow denied');
r=public.store_catalog_draft_command_v1(o,m,'create_price',gen_random_uuid(),null,null,jsonb_build_object('listing_id',listing,'version',2,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z'));unpriced=(r->>'id')::uuid;
perform public.store_test_check('CF24',exists(select 1 from jsonb_array_elements(public.store_catalog_workspace_v1(o,m,'prices')->'items') x where x->>'id'=unpriced::text and x->'amountMinor'='null'::jsonb),'missing money remains null draft');
perform public.store_test_error('CF24',format('select public.store_catalog_publication_command_v1(%L,%L,''approve_price'',gen_random_uuid(),%L,1,''{}'')',o,m,unpriced),'22023','null money cannot be approved');
perform public.store_test_error('CF24',format('select public.store_catalog_draft_command_v1(%L,%L,''create_price'',gen_random_uuid(),null,null,%L::jsonb)',o,m,jsonb_build_object('listing_id',listing,'version',3,'amount_minor',0,'presentation_policy_id',policies[2],'effective_from','2026-01-01Z')),'22023','zero retail rejected');
parent_node=cat2;
for n in 3..4 loop r=public.store_catalog_draft_command_v1(o,m,'create_category',gen_random_uuid(),null,null,jsonb_build_object('slug','depth-'||n,'parent_id',parent_node,'content',title));parent_node=(r->>'id')::uuid;end loop;
perform public.store_test_error('CF29',format('select public.store_catalog_draft_command_v1(%L,%L,''create_category'',gen_random_uuid(),null,null,%L::jsonb)',o,m,jsonb_build_object('slug','depth-5','parent_id',parent_node,'content',title)),'22023','depth greater than four denied');
perform public.store_test_error('CF38',format('select public.store_catalog_workspace_v1(%L,%L,''products'',null,51)',o,m),'22023','page bounded');
r=public.store_catalog_workspace_v1(o,m,'products',null,1);
perform public.store_test_check('CF38',jsonb_array_length(r->'items')=1 and r->>'nextCursor' is not null and jsonb_array_length(public.store_catalog_workspace_v1(o,m,'products',(r->>'nextCursor')::uuid,1)->'items')=1,'keyset advances');

perform public.store_sourcing_command_v1(o,m,'suspend_supplier',gen_random_uuid(),supplier,1,'{"reason":"Local test"}');
perform public.store_test_check('CF28',jsonb_array_length(public.store_catalog_public_v1()->'items')=0,'supplier suspension suppresses');
perform public.store_sourcing_command_v1(o,m,'resume_supplier',gen_random_uuid(),supplier,2,'{"reason":"Local test"}');
perform public.store_test_check('CF28',public.store_catalog_public_v1()=before_pub,'same selected approved dependencies restored');
perform public.store_catalog_publication_command_v1(o,m,'suspend_product',gen_random_uuid(),product,2,'{"reason":"Local test"}');
perform public.store_test_check('CF27',jsonb_array_length(public.store_catalog_public_v1()->'items')=0,'product suspension suppresses');
perform public.store_catalog_publication_command_v1(o,m,'resume_product',gen_random_uuid(),product,3,'{"reason":"Local test"}');

-- Independent omissions in permission conjunctions and canonical membership tests.
for n in 2..14 loop
perform set_config('request.jwt.claim.sub',('62000000-0000-4000-8000-'||lpad(n::text,12,'0')),true);
if n=2 then
perform public.store_test_error('CF11',format('select public.store_catalog_publication_command_v1(%L,%L,''suspend_listing'',gen_random_uuid(),%L,2,''{"reason":"test"}'')',o,m,listing),'42501','editor cannot publish');
elsif n=6 then
perform public.store_test_error('CF14',format('select public.store_catalog_policy_command_v1(%L,%L,''revoke_policy'',gen_random_uuid(),%L,2,''{"reason":"test"}'')',o,m,policies[1]),'42501','policy manage cannot approve');
elsif n in (4,5,14) then
perform public.store_test_error('CF13',format('select public.store_catalog_sourcing_v1(%L,%L)',o,m),'42501','missing sourcing conjunction');
elsif n>=7 then
perform public.store_test_error(case n when 8 then 'CF15' when 9 then 'CF09' when 10 then 'CF10' else 'CF17' end,format('select public.store_catalog_workspace_v1(%L,%L)',o,m),'42501','noncanonical/unauthorized membership '||n);
end if;
end loop;
perform set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
perform public.store_catalog_policy_command_v1(o,m,'revoke_policy',gen_random_uuid(),policies[1],2,'{"reason":"Local test revoke"}');
perform public.store_test_check('CF26',jsonb_array_length(public.store_catalog_public_v1()->'items')=0,'revoked selected policy hides, no fallback');
end $$;
reset role;
select public.store_test_error('CF05',$sql$update private.store_product_market_listings l set selected_offer_id=(select o.id from private.store_supplier_offers o where o.organization_id=l.organization_id and o.product_id<>l.product_id limit 1),revision=revision+1 where product_id=(select id from private.store_products where sku='OWNED-1')$sql$,'23503','same-product selection FK rejects raw substitution');
select public.store_test_error('CF06',$sql$update private.store_product_market_listings l set selected_price_id=(select p.id from private.store_market_prices p where p.organization_id=l.organization_id and p.listing_id<>l.id limit 1),revision=revision+1 where product_id=(select id from private.store_products where sku='OWNED-1')$sql$,'23503','same-listing price FK rejects raw substitution');
select public.store_test_error('CF23','update private.store_market_prices set amount_minor=42,revision=revision+1 where status=''APPROVED''','55000','approved price cannot be rewritten even by direct DML');
insert into private.store_policy_versions(id,organization_id,market_id,currency,kind,policy_code,version,content,evidence_ref,status,effective_from,effective_until,approved_by,approved_at)
select ('67000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','EGP','PUBLICATION_IDENTITY','interval-test-'||n,1,'{"title_ar":"اختبار","title_en":"Synthetic","body_ar":"اختبار","body_en":"Synthetic"}','LOCAL-ONLY','APPROVED',case when n=1 then '2999-01-01Z'::timestamptz else '2000-01-01Z'::timestamptz end,case when n=1 then null else '2001-01-01Z'::timestamptz end,'62000000-0000-4000-8000-000000000001',now() from generate_series(1,2) n;
select public.store_test_check('CF26',not private.store_policy_eligible('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000001','PUBLICATION_IDENTITY'),'future policy ineligible');
select public.store_test_check('CF26',not private.store_policy_eligible('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000002','PUBLICATION_IDENTITY'),'expired policy ineligible');
-- Owner-only pause is independent of canonical scope identity. Staff draft work
-- remains possible while the public Store and/or EG Market are unavailable.
update private.store_policy_versions set scope_paused=true,revision=3 where kind='STOREFRONT_SCOPE';
select public.store_test_check('CF08',public.store_catalog_public_v1()->>'status'='NOT_AVAILABLE','pause retains scope but hides Store');
update public.markets set active=false where id='64000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
select public.store_test_check('CF07',public.store_catalog_draft_command_v1('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','create_category',gen_random_uuid(),null,null,'{"slug":"paused-private-draft","content":{"title_ar":"مسودة","title_en":"Private draft"}}')->>'state'='DRAFT','draft work allowed in paused inactive EG');
select public.store_test_error('CF38','select public.store_catalog_public_v1(''EG'',''products'',null,51)','22023','public limit bounded');
select public.store_test_error('CF38','select public.store_catalog_public_v1(''EG'',''products'',null,20,repeat(''x'',121))','22023','search bounded');
select public.store_test_error('CF38',$sql$select public.store_catalog_draft_command_v1('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','create_product',gen_random_uuid(),null,null,'{"sku":"INVALID","slug":"invalid","category_id":"ffffffff-ffff-4fff-8fff-ffffffffffff","content":{"title_ar":"اختبار","title_en":"test"},"unauthorized":true}')$sql$,'22023','unknown fields denied');
reset role;
update public.markets set active=true where id='64000000-0000-4000-8000-000000000001';
insert into private.store_categories(id,organization_id,slug,draft_content) values('66000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','other-tenant','{"title_ar":"آخر","title_en":"Other"}');
set local role authenticated;
select public.store_test_error('CF04',$sql$select public.store_catalog_draft_command_v1('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','create_product',gen_random_uuid(),null,null,'{"sku":"CROSS","slug":"cross","category_id":"66000000-0000-4000-8000-000000000001","content":{"title_ar":"اختبار","title_en":"test"}}')$sql$,'22023','cross-organization FK hidden by command');
reset role;
select public.store_test_error('CF21','update private.store_events set operation=''rewritten''','55000','events append-only');
select public.store_test_error('CF23','update private.store_command_receipts set outcome=''{}''','55000','receipts immutable');
select public.store_test_check('CF18',not has_function_privilege('anon','public.store_catalog_workspace_v1(uuid,uuid,text,uuid,integer)','EXECUTE'),'anon workspace execute denied');
-- RLS is a second deny boundary even if a future accidental table ACL is added.
grant select,insert on private.store_suppliers to authenticated;
set local role authenticated;
select public.store_test_check('CF18',(select count(*)=0 from private.store_suppliers),'RLS default deny despite temporary local test ACL');
select public.store_test_error('CF18',$sql$insert into private.store_suppliers(organization_id,reference,name) values('61000000-0000-4000-8000-000000000001','RLS-BYPASS','Denied')$sql$,'42501','RLS write denied despite temporary ACL');
select public.store_test_error('CF38',$sql$select public.store_catalog_draft_command_v1('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','create_category',gen_random_uuid(),null,null,jsonb_build_object('slug','oversized','content',jsonb_build_object('title_ar',repeat('x',40000),'title_en','test')))$sql$,'22023','32KiB envelope bounded');
reset role;
revoke select,insert on private.store_suppliers from authenticated;
select public.store_test_check('CF21',not exists(select 1 from public.audit_logs where entity_type like 'store_%'),'no Store values copied into generic audit');
select public.store_test_check('CF30',(select count(*)=count(distinct command_receipt_id) from private.store_events),'one event per receipt');
select public.store_test_check('CF33',(select count(*) from private.store_events)=(select count(*) from private.store_command_receipts),'aborted commands leave no receipt/event');
select public.store_test_check('CF03',(select count(*)>=20 from pg_constraint where contype='f' and conrelid in (select oid from pg_class where relnamespace='private'::regnamespace and relname like 'store_%')),'composite FKs reconstructed');
select public.store_test_check('CF20',not exists(select 1 from private.store_events where coalesce(public_snapshot::text,'')||coalesce(previous_public_snapshot::text,'') ~ '27183|PRIVATE-'),'public history no costs');
select public.store_test_check('CF23',exists(select 1 from private.store_events where operation='publish_listing' and public_snapshot is not null),'publication fact retained');
select public.store_test_error('CF08',$sql$insert into private.store_policy_versions(organization_id,market_id,currency,kind,policy_code,version,content,status,effective_from,evidence_ref,approved_by,approved_at) values('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','EGP','STOREFRONT_SCOPE','duplicate',1,'{"publication_enabled":false}','APPROVED','2026-01-01Z','LOCAL','62000000-0000-4000-8000-000000000001',now())$sql$,'23505','duplicate global scope denied');
select public.store_test_error('CF07',$sql$insert into private.store_policy_versions(organization_id,market_id,currency,kind,policy_code,version,content,effective_from) values('61000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000002','EGP','RETAIL_PRESENTATION','bad-market',1,'{"title_ar":"اختبار","title_en":"test","body_ar":"اختبار","body_en":"test"}','2026-01-01Z')$sql$,'22023','SA context rejected by trigger');
-- TAP evidence reflects actual executed assertions, before rollback.
select plan((select count(*)::integer from public.store_test_results));
select pass(case_id||' '||label) from public.store_test_results order by case_id,label;
select * from finish();
rollback;
