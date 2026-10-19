-- Isolated synthetic transaction; no operational product, financial destination or grant.
begin;
create table public.store_purchase_test_results(label text);
grant insert,select on public.store_purchase_test_results to authenticated;
create function public.store_purchase_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Store purchase assertion: %',label; end if;
insert into public.store_purchase_test_results values(label); end $$;
create function public.store_purchase_error(statement text,expected text,label text) returns void language plpgsql as $$
declare code text; begin begin execute statement; exception when others then get stacked diagnostics code=returned_sqlstate; end;
perform public.store_purchase_assert(code=expected,label||' expected '||expected||' got '||coalesce(code,'success')); end $$;
select public.store_purchase_assert(not exists(select 1 from private.store_orders),'no orders seeded');
select public.store_purchase_assert(not exists(select 1 from public.role_permissions r join public.permissions p on p.id=r.permission_id where p.code like 'store.%'),'zero automatic Store grants');
insert into public.organizations(id,name) values('91000000-0000-4000-8000-000000000001','Synthetic purchase test'),('91000000-0000-4000-8000-000000000002','Other synthetic tenant');
insert into auth.users(id) select ('92000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,6) n;
insert into public.organization_memberships(organization_id,profile_id,member_type)
 select case n when 5 then '91000000-0000-4000-8000-000000000002'::uuid else '91000000-0000-4000-8000-000000000001'::uuid end,
 ('92000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n in (1,4,5) then 'customer' when n=6 then 'driver' else 'staff' end from generate_series(1,6) n;
insert into public.customers(id,organization_id,profile_id) values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001'),
 ('93000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000004'),
 ('93000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000005');
insert into public.roles(id,code,member_type) values('94000000-0000-4000-8000-000000000001','SYNTHETIC_STORE_PURCHASE','staff');
insert into public.role_permissions(role_id,permission_id) select '94000000-0000-4000-8000-000000000001',id from public.permissions where code like 'store.%' or code in ('portal.access','finance.read','finance.verify');
insert into public.user_roles(organization_id,profile_id,role_id)
 select m.organization_id,m.profile_id,r.id from public.organization_memberships m join public.roles r on r.code=case when m.member_type='customer' then 'CUSTOMER' when m.member_type='driver' then 'DRIVER' else 'SYNTHETIC_STORE_PURCHASE' end where m.profile_id::text like '92000000%';
insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values
 ('95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','EG','اختبار','Synthetic',true,'EGP','Africa/Cairo','+20'),
 ('95000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','SA','اختبار','Synthetic SA',true,'SAR','Asia/Riyadh','+966');
insert into private.store_policy_versions(id,organization_id,market_id,currency,kind,policy_code,version,content,evidence_ref,status,effective_from,approved_by,approved_at)
 select ('96000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP',
 (array['STOREFRONT_SCOPE','PUBLICATION_IDENTITY','RETAIL_PRESENTATION','DELIVERY_PRESENTATION','RETURNS_PRESENTATION'])[n],'synthetic',1,
 case when n=1 then '{"publication_enabled":true}'::jsonb else '{"title_ar":"اختبار","title_en":"Synthetic","body_ar":"تجريبي فقط","body_en":"Synthetic only"}'::jsonb end,
 'SYNTHETIC-TEST-NOT-LEGAL-APPROVAL','APPROVED','2026-01-01Z','92000000-0000-4000-8000-000000000002',now() from generate_series(1,5) n;
update private.store_policy_versions set scope_paused=false,revision=2 where kind='STOREFRONT_SCOPE';
insert into private.store_suppliers(id,organization_id,reference,name) values('97000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','synthetic-supplier','SYNTHETIC supplier');
insert into private.store_supplier_agreements(id,organization_id,market_id,currency,supplier_id,agreement_code,version,terms,evidence_ref,status,effective_from,approved_by,approved_at)
 values('97000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','97000000-0000-4000-8000-000000000001','test',1,'{"reference":"SYNTHETIC","summary":"Test only"}','SYNTHETIC','APPROVED','2026-01-01Z','92000000-0000-4000-8000-000000000002',now());
insert into private.store_categories(id,organization_id,slug,draft_content,public_content,status) values('98000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','synthetic-category','{"title_ar":"اختبار","title_en":"Synthetic"}','{"title_ar":"اختبار","title_en":"Synthetic"}','PUBLISHED');
insert into private.store_products(id,organization_id,category_id,sku,slug,draft_content) values('98000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','SYNTHETIC','synthetic-product','{"title_ar":"منتج تجريبي","title_en":"Synthetic product"}');
insert into private.store_product_market_listings(id,organization_id,market_id,currency,product_id) values('98000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','98000000-0000-4000-8000-000000000002');
insert into private.store_supplier_offers(id,organization_id,market_id,currency,product_id,supplier_id,agreement_id,offer_key,version,unit_cost_minor,evidence_ref,status,effective_from,approved_by,approved_at) values
 ('98000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','98000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002','test',1,600,'SYNTHETIC','APPROVED','2026-01-01Z','92000000-0000-4000-8000-000000000002',now());
insert into private.store_market_prices(id,organization_id,market_id,currency,listing_id,version,amount_minor,presentation_policy_id,status,effective_from,approved_by,approved_at) values
 ('98000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','98000000-0000-4000-8000-000000000003',1,1000,'96000000-0000-4000-8000-000000000003','APPROVED','2026-01-01Z','92000000-0000-4000-8000-000000000002',now());
update private.store_product_market_listings set status='PUBLISHED',selected_price_id='98000000-0000-4000-8000-000000000005',selected_offer_id='98000000-0000-4000-8000-000000000004',identity_policy_id='96000000-0000-4000-8000-000000000002',delivery_policy_id='96000000-0000-4000-8000-000000000004',returns_policy_id='96000000-0000-4000-8000-000000000005',published_content='{"title_ar":"منتج تجريبي","title_en":"Synthetic product"}',published_product_revision=1,published_category_id='98000000-0000-4000-8000-000000000001',revision=2;
insert into private.store_checkout_contracts(id,organization_id,market_id,currency,supplier_id,agreement_id,version,status,regions,delivery_minor,supplier_delivery_minor,tax_mode,tax_bps,tax_recipient,tax_delivery,cod_release,recognition,cancellation_before_handoff,returns_allowed,refund_rule,destination_ids,terms_ar,terms_en,legal_reference,evidence_reference,created_by,approved_by,approved_at,effective_from)
 values('99000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','97000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000002',1,'APPROVED',array['SYNTHETIC-REGION'],200,100,'ADDITIVE',0,'NAQL365',false,true,'DELIVERED_AND_VERIFIED',true,true,'FULL_REVERSAL',array['99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000003']::uuid[],'اختبار فقط','Synthetic only','SYNTHETIC-NOT-LEGAL','SYNTHETIC','92000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000003',now(),'2026-01-01Z');
insert into public.bank_accounts(id,organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,destination_type,is_primary,created_by)
 select ('99000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,'91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','اختبار','SYNTHETIC','اختبار','SYNTHETIC','TEST-ONLY-0000',case n when 1 then 'VODAFONE_CASH' else 'INSTAPAY' end,false,'92000000-0000-4000-8000-000000000002' from generate_series(1,2) n;

set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);

do $$ declare r jsonb; p uuid; l uuid; n integer; m uuid=gen_random_uuid(); ref jsonb; payload jsonb; v bigint; begin
 -- A 31st product is created through the same governed website command adapter.
 r=public.store_catalog_ui_command_v1('EG','draft','create_product',gen_random_uuid(),'{"sku":"NEW-31","slug":"new-product-31","category_id":"98000000-0000-4000-8000-000000000001","content":{"title_ar":"منتج جديد","title_en":"New product 31","specifications":[{"label_ar":"الحالة","label_en":"Condition","value_ar":"جديد","value_en":"NEW"}]}}');
 p=(r->>'id')::uuid;
 perform public.store_purchase_assert(r->>'revision'='1','new product outside initial catalog');
 r=public.store_catalog_ui_command_v1('EG','draft','save_product',gen_random_uuid(),'{"category_id":"98000000-0000-4000-8000-000000000001","content":{"title_ar":"تعديل","title_en":"Edited product 31","description_en":"Approved facts only"}}',p,1);
 perform public.store_purchase_assert(r->>'revision'='2','edit governed draft');
 perform public.store_purchase_error(format('select public.store_catalog_ui_command_v1(''EG'',''draft'',''save_product'',%L,''{"category_id":"98000000-0000-4000-8000-000000000001","content":{"title_ar":"قديم","title_en":"Stale"}}'',%L,1)',gen_random_uuid(),p),'PT409','stale product update denied');
 payload=jsonb_build_object('supplierId','97000000-0000-4000-8000-000000000001','version',1,'amountMinor',5000,'observedAt','2026-10-19Z','evidenceReference','SYNTHETIC reference only');
 ref=public.store_catalog_extension_v1('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','reference_price',m,p,2,payload);
 r=public.store_catalog_extension_v1('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','reference_price',m,p,2,payload);
 perform public.store_purchase_assert(r->>'id'=ref->>'id' and r->>'replayed'='true','reference durable replay');
 perform public.store_purchase_error(format('select public.store_catalog_extension_v1(''91000000-0000-4000-8000-000000000001'',''95000000-0000-4000-8000-000000000001'',''reference_price'',%L,%L,2,%L)',m,p,payload||'{"amountMinor":1}'),'PT409','changed reference intent conflicts');
 perform public.store_purchase_assert(jsonb_array_length(public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','products',null,'Edited product 31','ACTIVE')->'items')=1,'search and state applied on server');
 for n in 1..31 loop
 perform public.store_catalog_ui_command_v1('EG','draft','create_product',gen_random_uuid(),jsonb_build_object('sku','PAGED-'||n,'slug','paged-'||n,'category_id','98000000-0000-4000-8000-000000000001','content',jsonb_build_object('title_ar','اختبار','title_en','Paged product '||n)));
 end loop;
 r=public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','products',null,'Paged product','ACTIVE',20);
 perform public.store_purchase_assert(jsonb_array_length(r->'items')=20 and r->>'nextCursor' is not null,'catalog not limited to 30; bounded first page');
 r=public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','products',(r->>'nextCursor')::uuid,'Paged product','ACTIVE',20);
 perform public.store_purchase_assert(jsonb_array_length(r->'items')=11 and r->>'nextCursor' is null,'filtered second page is consistent');
 r=public.store_catalog_ui_command_v1('EG','draft','create_listing',gen_random_uuid(),jsonb_build_object('product_id',p));l=(r->>'id')::uuid;
 r=public.store_catalog_ui_command_v1('EG','draft','create_price',gen_random_uuid(),jsonb_build_object('listing_id',l,'version',1,'amount_minor',1200,'presentation_policy_id','96000000-0000-4000-8000-000000000003','effective_from','2026-01-01Z'));
 r=public.store_catalog_ui_command_v1('EG','draft','save_price',gen_random_uuid(),'{"amount_minor":1400,"presentation_policy_id":"96000000-0000-4000-8000-000000000003","effective_from":"2026-01-01Z"}',(r->>'id')::uuid,1);
 perform public.store_purchase_assert(r->>'revision'='2','change draft retail independently from reference');
 m=gen_random_uuid();
 perform public.store_catalog_extension_v1('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','reserve_media',gen_random_uuid(),l,1,jsonb_build_object('assetId',m,'size',100,'sha256',repeat('a',64),'rightsReference','SYNTHETIC SQL metadata fixture only'));
 perform set_config('storage.operation','object.upload',true);
 insert into storage.objects(bucket_id,name,metadata) values('store-product-media',m::text||'.webp','{"mimetype":"image/webp","size":100}');
 perform public.store_catalog_extension_v1('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','finalize_media',gen_random_uuid(),l,1,jsonb_build_object('assetId',m));
 r=public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','listings',null,'Edited product 31');
 perform public.store_purchase_assert(jsonb_array_length(r->'items'->0->'pendingMedia')=1 and jsonb_array_length(r->'items'->0->'media')=0,'ready uploaded draft discoverable by publisher without premature attachment');
 perform public.store_purchase_assert(position(m::text in public.store_shop_v1('EG')::text)=0,'unapproved media absent from public projection');

 r=public.store_catalog_ui_command_v1('EG','publication','suspend_product',gen_random_uuid(),'{"reason":"SYNTHETIC suspension"}',p,2);
 r=public.store_catalog_ui_command_v1('EG','publication','resume_product',gen_random_uuid(),'{"reason":"SYNTHETIC resume"}',p,(r->>'revision')::bigint);
 perform public.store_purchase_assert(r->>'revision'='4','pause and resume without losing history');
 -- Media paths never accept another bucket, a proof URL, or an arbitrary remote image.
 perform public.store_purchase_error(format('select public.store_catalog_extension_v1(''91000000-0000-4000-8000-000000000001'',''95000000-0000-4000-8000-000000000001'',''attach_media'',%L,%L,1,''{"media":[{"src":"https://example.invalid/image.webp","altAr":"اختبار","altEn":"Test"}]}'')',gen_random_uuid(),l),'22023','remote image rejected');
 perform public.store_purchase_error(format('select public.store_catalog_extension_v1(''91000000-0000-4000-8000-000000000001'',''95000000-0000-4000-8000-000000000001'',''attach_media'',%L,%L,1,''{"media":[{"src":"/api/store/proof/private","altAr":"اختبار","altEn":"Test"}]}'')',gen_random_uuid(),l),'22023','proof image rejected');
 perform public.store_purchase_error(format('select public.store_catalog_extension_v1(''91000000-0000-4000-8000-000000000001'',''95000000-0000-4000-8000-000000000001'',''finalize_media'',%L,%L,1,''{"assetId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'')',gen_random_uuid(),l),'PT409','unconfirmed upload never finalized');
end $$;
select public.store_purchase_error($q$select public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000001')$q$,'42501','cross organization denied');
select public.store_purchase_error($q$select public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002')$q$,'42501','SA market denied');
select public.store_purchase_error($q$select public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$,'42501','invalid market denied');
reset role;
select public.store_purchase_assert((select count(*)=1 from private.store_supplier_reference_prices),'one immutable reference after replay');
select public.store_purchase_assert((select amount_minor=1000 from private.store_market_prices where id='98000000-0000-4000-8000-000000000005'),'reference did not modify existing retail');
select public.store_purchase_assert((select unit_cost_minor=600 from private.store_supplier_offers where id='98000000-0000-4000-8000-000000000004'),'reference did not modify entitlement');
select public.store_purchase_error('update private.store_supplier_reference_prices set amount_minor=1','55000','reference history immutable');
select public.store_purchase_assert((public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','offers')->'items'->0->'comparison'->>'productDifferenceMinor')='400','approved selected retail minus entitlement is provisional product difference only');
-- Remove sensitive grants from the local synthetic role, preserving catalog access.
delete from public.role_permissions where role_id='94000000-0000-4000-8000-000000000001' and permission_id in (select id from public.permissions where code in ('store.supplier_cost.read','store.sourcing.manage','store.catalog.publish'));
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select public.store_purchase_error($q$select public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','references')$q$,'42501','catalog editor cannot read reference price');
select public.store_purchase_error($q$select public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','offers')$q$,'42501','catalog editor cannot read entitlement');
select public.store_purchase_error($q$select * from private.store_supplier_reference_prices$q$,'42501','direct reference read denied');
select public.store_purchase_error($q$select * from private.store_product_media$q$,'42501','direct media registry read denied');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select public.store_purchase_error($q$select public.store_catalog_admin_v2('91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001')$q$,'42501','Customer administration denied');
select public.store_purchase_assert(not private.store_media_access('../store-proofs/test.webp'),'traversal denied');
reset role;
select '1..'||count(*) from public.store_purchase_test_results;
select 'ok '||row_number() over()||' - '||label from public.store_purchase_test_results;
rollback;
