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
-- FIXTURE END. Independent connection harness reuses only the above setup.
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select public.store_purchase_assert(public.store_shop_v1('EG')->>'status'='AVAILABLE','approved catalog available');
select public.store_purchase_assert(public.store_shop_v1('SA')->>'status'='NOT_AVAILABLE','Saudi Store unavailable');
select public.store_purchase_error($q$select public.store_purchase_read_v1('SA','cart')$q$,'42501','SA purchase denied');
select public.store_purchase_error('select * from private.store_supplier_offers','42501','supplier cost denied');
select public.store_purchase_error('select * from private.store_purchase_receipts','42501','mutation results private');
do $$ declare cart jsonb; r jsonb; again jsonb; id uuid; v bigint; proof uuid; action text; method text; n integer; payload jsonb; mutation uuid; details jsonb; operation uuid; begin
 for n in 1..3 loop
  method=(array['CASH','VODAFONE_CASH','INSTAPAY'])[n];
  cart=public.store_purchase_read_v1('EG','cart');
  cart=public.store_purchase_command_v1('EG','cart',gen_random_uuid(),(cart->>'revision')::bigint,null,'{"items":[{"listingId":"98000000-0000-4000-8000-000000000003","revision":2,"quantity":2}]}');
  payload=jsonb_build_object('contractId','99000000-0000-4000-8000-000000000001','contractRevision',1,'address',jsonb_build_object('name','SYNTHETIC','phone','SYNTHETIC','region','SYNTHETIC-REGION','line','Synthetic only'),'method',method);
  if n>1 then payload=payload||jsonb_build_object('destinationId',('99000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid); end if;
  mutation=gen_random_uuid();
  r=public.store_purchase_command_v1('EG','checkout',mutation,(cart->>'revision')::bigint,null,payload);
  again=public.store_purchase_command_v1('EG','checkout',mutation,(cart->>'revision')::bigint,null,payload);
  perform public.store_purchase_assert(r=again,'durable checkout replay '||method);
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''checkout'',%L,%s,null,%L::jsonb)',gen_random_uuid(),cart->>'revision',payload),'PT409','different mutation cannot duplicate checked-out cart');
  id=(r->>'id')::uuid; v=(r->>'revision')::bigint;
  details=public.store_purchase_read_v1('EG','order',id);
  perform public.store_purchase_assert(details->>'totalMinor'='2200' and not details?'supplierEntitlementMinor' and details->'entries'='[]'::jsonb,'customer snapshot and commercial privacy '||method);
  perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
  perform public.store_purchase_error(format('select public.store_purchase_read_v1(''EG'',''order'',%L)',id),'42501','other Customer denied');
  perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
  r=public.store_purchase_command_v1('EG','accept',gen_random_uuid(),v,id);v=(r->>'revision')::bigint;
  if n>1 then
   perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''send'',%L,%s,%L)',gen_random_uuid(),v,id),'PT409','unpaid transfer cannot release');
   r=public.store_purchase_command_v1('EG','exception',gen_random_uuid(),v,id,'{"reason":"Synthetic unavailable supplier"}');v=(r->>'revision')::bigint;
   r=public.store_purchase_command_v1('EG','recover',gen_random_uuid(),v,id,'{"reason":"Synthetic issue resolved"}');v=(r->>'revision')::bigint;
   perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''send'',%L,%s,%L)',gen_random_uuid(),v,id),'PT409','exception recovery does not bypass transfer clearance');
   perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
   proof=gen_random_uuid();
   r=public.store_purchase_command_v1('EG','reserve_proof',gen_random_uuid(),v,id,jsonb_build_object('fileId',proof,'mime','image/png','size',100,'sha256',repeat('a',64)));v=(r->>'revision')::bigint;
   perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''submit_proof'',%L,%s,%L,%L)',gen_random_uuid(),v,id,jsonb_build_object('proofId',proof)),'PT409','unconfirmed upload not submitted');
   perform set_config('storage.operation','object.upload',true);
   insert into storage.objects(bucket_id,name,metadata) values('store-proofs',r->>'path','{"size":100,"mimetype":"image/png"}');
   r=public.store_purchase_command_v1('EG','submit_proof',gen_random_uuid(),v,id,jsonb_build_object('proofId',proof,'customerReference','UNVERIFIED-TEST'));v=(r->>'revision')::bigint;
   perform public.store_purchase_assert(public.store_purchase_read_v1('EG','order',id)->'payment'->>'status'='UNDER_REVIEW','proof is not money');
   perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''confirm_transfer'',%L,%s,%L,%L)',gen_random_uuid(),v,id,'{"evidenceReference":"TEST","reference":"TEST-RECEIPT"}'),'42501','Customer cannot confirm payment');
   perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
   r=public.store_purchase_command_v1('EG','confirm_transfer',gen_random_uuid(),v,id,jsonb_build_object('evidenceReference','SYNTHETIC-VERIFIED','reference','SYNTHETIC-RECEIPT-'||n));v=(r->>'revision')::bigint;
  end if;
  foreach action in array array['send','prepare','dispatch','deliver'] loop r=public.store_purchase_command_v1('EG',action,gen_random_uuid(),v,id);v=(r->>'revision')::bigint;end loop;
  if n=1 then
   perform public.store_purchase_assert(public.store_purchase_read_v1('EG','order',id)->'payment'->>'status'='CASH_DUE','delivery alone is not cash payment');
   r=public.store_purchase_command_v1('EG','report_cash',gen_random_uuid(),v,id,'{"reason":"Synthetic supplier report","amountMinor":2200,"evidenceReference":"SYNTHETIC"}');v=(r->>'revision')::bigint;
   perform public.store_purchase_assert(public.store_purchase_read_v1('EG','order',id)->'payment'->>'status'='CASH_DUE','supplier report alone is not verified collection');
   r=public.store_purchase_command_v1('EG','confirm_cash',gen_random_uuid(),v,id,'{"evidenceReference":"SYNTHETIC independent receipt check"}');v=(r->>'revision')::bigint;
  end if;
  details=public.store_purchase_read_v1('EG','order',id);
  perform public.store_purchase_assert(details->>'supplierEntitlementMinor'='1300','supplier goods plus delivery entitlement');
  perform public.store_purchase_assert(exists(select 1 from jsonb_array_elements(details->'entries') x where x->>'kind'=case when n=1 then 'NAQL_RECEIVABLE' else 'SUPPLIER_PAYABLE' end and x->>'amountMinor'=case when n=1 then '900' else '1300' end),'directional reconciliation '||method);
  r=public.store_purchase_command_v1('EG','money_request',gen_random_uuid(),v,id,jsonb_build_object('kind','SETTLEMENT','amountMinor',100,'reference','SYNTHETIC-SETTLE-'||n));v=(r->>'revision')::bigint;operation=(r->>'operationId')::uuid;
  r=public.store_purchase_command_v1('EG','money_unknown',gen_random_uuid(),v,id,jsonb_build_object('operationId',operation,'evidenceReference','Synthetic response lost'));v=(r->>'revision')::bigint;
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''money_request'',%L,%s,%L,%L)',gen_random_uuid(),v,id,jsonb_build_object('kind','SETTLEMENT','amountMinor',2200,'reference','SYNTHETIC-EXCEED-'||n)),'PT409','unknown external outcome reserves balance');
  r=public.store_purchase_command_v1('EG','money_failed',gen_random_uuid(),v,id,jsonb_build_object('operationId',operation,'evidenceReference','Synthetic verified not executed'));v=(r->>'revision')::bigint;
  r=public.store_purchase_command_v1('EG','return',gen_random_uuid(),v,id,'{"reason":"Synthetic confirmed return"}');v=(r->>'revision')::bigint;
  r=public.store_purchase_command_v1('EG','money_request',gen_random_uuid(),v,id,jsonb_build_object('kind','REFUND','amountMinor',2200,'reference','SYNTHETIC-REFUND-'||n));v=(r->>'revision')::bigint;operation=(r->>'operationId')::uuid;
  r=public.store_purchase_command_v1('EG','money_verify',gen_random_uuid(),v,id,jsonb_build_object('operationId',operation,'evidenceReference','Synthetic refund externally verified'));
  perform public.store_purchase_assert(public.store_purchase_read_v1('EG','order',id)->'payment'->>'status'='REFUNDED','verified refund distinct from return');
  perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
 end loop;
end $$;
reset role;
select public.store_purchase_assert((select count(*)=3 from private.store_orders),'exactly three independently scoped orders');
select public.store_purchase_assert((select count(*)=2 from private.manual_collection_receipts where domain='STORE'),'only transfers claim external receipts');
select public.store_purchase_assert(not exists(select 1 from public.orders where organization_id='91000000-0000-4000-8000-000000000001'),'no Transport Orders created');
select public.store_purchase_assert((select count(*)=3 from private.store_money_entries where kind='OBLIGATION_REVERSAL'),'approved returns reverse the original obligation without deleting history');
update private.store_policy_versions set status='REVOKED',revision=revision+1 where kind='STOREFRONT_SCOPE';
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select public.store_purchase_assert(jsonb_array_length(public.store_purchase_read_v1('EG','orders')->'items')=3,'Customer history survives storefront withdrawal');
reset role;
-- TAP evidence
select plan(count(*)::integer) from public.store_purchase_test_results;
select pass(label) from public.store_purchase_test_results;
select * from finish();
rollback;
