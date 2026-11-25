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
 ('95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','EG','اختبار','Synthetic',true,'EGP','Africa/Cairo','+20');
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
-- HISTORICAL ORDERS.
-- Three already-placed orders from before the guest checkout cutover. They remain
-- readable, fulfillable, refundable and reconcilable under the new commands.
do $$ declare n int; c private.store_checkout_contracts; cart uuid; oid uuid; method text; b public.bank_accounts; begin
 select * into c from private.store_checkout_contracts where id='99000000-0000-4000-8000-000000000001';
 insert into private.store_carts(organization_id,market_id,customer_id)
  values(c.organization_id,c.market_id,'93000000-0000-4000-8000-000000000001') returning id into cart;
 for n in 1..3 loop
  oid=('99100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  method=(array['CASH','VODAFONE_CASH','INSTAPAY'])[n];
  select * into b from public.bank_accounts where destination_type=method and organization_id=c.organization_id limit 1;
  insert into private.store_orders(id,organization_id,market_id,currency,customer_id,supplier_id,contract_id,cart_id,cart_revision,reference,address,contract_snapshot,
   subtotal_minor,delivery_minor,tax_minor,total_minor,supplier_entitlement_minor)
   values(oid,c.organization_id,c.market_id,'EGP','93000000-0000-4000-8000-000000000001',c.supplier_id,c.id,cart,n,'HISTORICAL-'||n,
    '{"name":"Synthetic","phone":"Synthetic","region":"SYNTHETIC-REGION","line":"Synthetic"}',to_jsonb(c),2000,200,0,2200,1300);
  insert into private.store_order_items(organization_id,order_id,listing_id,offer_id,price_id,quantity,unit_price_minor,unit_entitlement_minor,product_snapshot,commercial_snapshot)
   select c.organization_id,oid,l.id,l.selected_offer_id,l.selected_price_id,2,1000,600,l.published_content,'{}' from private.store_product_market_listings l where l.id='98000000-0000-4000-8000-000000000003';
  insert into private.store_payments(organization_id,market_id,order_id,currency,amount_minor,method,collector,destination_id,destination_snapshot,status)
   values(c.organization_id,c.market_id,oid,'EGP',2200,method,case when n=1 then 'SUPPLIER' else 'NAQL365' end,
    b.id,case when b.id is not null then jsonb_build_object('channel',method,'accountNumber',b.account_number) end,case when n=1 then 'CASH_DUE' else 'PENDING' end);
 end loop;
end $$;
-- HISTORICAL END.
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
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''checkout'',%L,1,null,''{}'')',gen_random_uuid()),'PT409','legacy checkout closed for new requests');
  id=('99100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid; v=1;
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
-- Guest intake and replay use the same financial fixture; no customer session.
insert into private.store_checkout_contracts
 select (jsonb_populate_record(null::private.store_checkout_contracts,to_jsonb(c)||
    jsonb_build_object('id',gen_random_uuid(),'version',c.version+1,'regions',array['CAIRO','الجيزة'],'tax_bps',1400))).*
 from private.store_checkout_contracts c where c.version=1;
grant insert,select on public.store_purchase_test_results to anon;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $guest$
declare
 payload jsonb := '{"full_name":"Synthetic Guest","phone":"01000000001","governorate":"CAIRO","area":"Synthetic","address":"Fixture address","payment_method":"CASH","items":[{"listing_id":"98000000-0000-4000-8000-000000000003","unit_price":10,"quantity":2}]}';
 key uuid := gen_random_uuid(); response jsonb;
begin
 perform public.store_purchase_error('select * from private.store_orders','42501','anonymous orders protected');
 perform public.store_purchase_error('select * from private.store_order_items','42501','anonymous lines protected');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,payload||'{"governorate":"ALEXANDRIA"}'),'22023','delivery restricted server side');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,payload||'{"payment_method":"VODAFONE_CASH"}'),'22023','wallet unavailable to guest');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,payload||'{"payment_method":"BANK_TRANSFER"}'),'PT409','transfer requires approved bank');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,jsonb_set(payload,'{items,0,unit_price}','1')),'PT409','price tampering refused');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,jsonb_set(payload,'{items,0,listing_id}',to_jsonb(gen_random_uuid()))),'PT409','unavailable listing refused');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,payload||'{"total":1}'),'22023','client total refused');
 response := public.store_guest_checkout_v1(key,payload);
 perform public.store_purchase_assert(response ? 'reference' and response - 'reference'='{}'::jsonb,'guest receives reference only');
 perform public.store_purchase_assert(response=public.store_guest_checkout_v1(key,payload),'same request is replay safe');
 perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',key,payload||'{"area":"changed"}'),'P4091','cannot replay changed request');
end $guest$;
reset role;
select public.store_purchase_assert((select count(*)=1 and bool_and(delivery_minor is null and total_minor is null and subtotal_minor=2000 and tax_minor=280)
 from private.store_orders where guest_request_id is not null),'one order, delivery and final amount pending');
select public.store_purchase_assert(not exists(select 1 from private.store_payments p join private.store_orders o on o.id=p.order_id where o.guest_request_id is not null),'no charge created before confirmation');
select public.store_purchase_assert((select count(*)=1 from public.customers where identity_kind='GUEST'),'guest intake creates no duplicate customer');

-- The catalog and checkout use the same publication guard.
update private.store_policy_versions set scope_paused=true, revision=revision+1 where kind='STOREFRONT_SCOPE';
set local role anon;
select public.store_purchase_error($q$select public.store_guest_checkout_v1(gen_random_uuid(),'{"full_name":"Synthetic Guest","phone":"01000000001","governorate":"CAIRO","area":"Test","address":"Fixture address","payment_method":"CASH","items":[{"listing_id":"98000000-0000-4000-8000-000000000003","unit_price":10,"quantity":1}]}')$q$,'PT409','paused storefront rejects guest orders');
select public.store_purchase_error($q$insert into private.store_orders(id) values(gen_random_uuid())$q$,'42501','anonymous direct writes forbidden');
reset role;
update private.store_policy_versions set scope_paused=false, revision=revision+1 where kind='STOREFRONT_SCOPE';
-- A bank transfer is accepted only against a real scoped BANK in the approved contract.
insert into public.bank_accounts(id,organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,destination_type,is_primary,created_by)
 values('99100000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','EGP','اختبار','Fixture','اختبار','Fixture','TEST-ONLY','BANK',false,'92000000-0000-4000-8000-000000000002');
insert into private.store_checkout_contracts
 select (jsonb_populate_record(null::private.store_checkout_contracts,to_jsonb(c)||
   jsonb_build_object('id',gen_random_uuid(),'version',3,'destination_ids',array['99100000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000003']))).*
 from private.store_checkout_contracts c where c.version=2;
set local role anon;
do $bank$
declare payload jsonb := '{"full_name":"Synthetic Guest","phone":"01000000001","governorate":"GIZA","area":"Synthetic","address":"Fixture address","payment_method":"BANK_TRANSFER","items":[{"listing_id":"98000000-0000-4000-8000-000000000003","unit_price":10,"quantity":1}]}';
begin
  for i in 1..4 loop perform public.store_guest_checkout_v1(gen_random_uuid(),payload); end loop;
  perform public.store_purchase_error(format('select public.store_guest_checkout_v1(%L,%L)',gen_random_uuid(),payload),'PT429','per phone budget applies to direct RPC');
  perform public.store_guest_checkout_v1(gen_random_uuid(),payload||'{"payment_method":"VODAFONE_CASH","phone":"01000000003"}');
  perform public.store_guest_checkout_v1(gen_random_uuid(),payload||'{"payment_method":"INSTAPAY","phone":"01000000004"}');
end $bank$;
reset role;
select public.store_purchase_assert((select count(*)=4 and bool_and(total_minor is null and delivery_minor is null)
  from private.store_orders where guest_payment_method='BANK_TRANSFER'),'Giza transfer orders await quote and receipt');
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
do $$ begin perform public.store_guest_checkout_v1(gen_random_uuid(),'{"full_name":"Account Customer","phone":"01000000002","governorate":"GIZA","area":"Test","address":"Fixture address","payment_method":"CASH","items":[{"listing_id":"98000000-0000-4000-8000-000000000003","unit_price":10,"quantity":1}]}'); end $$;
reset role;
select public.store_purchase_assert((select count(*)=1 from private.store_orders where guest_request_id is not null and customer_id='93000000-0000-4000-8000-000000000004'),'registered customer associated through session only');


-- Select one anonymous checkout for each method from the intake scenarios.
create temporary table guest_review_targets as
 select distinct on (o.guest_payment_method) o.id,o.guest_payment_method method,(o.subtotal_minor+o.tax_minor+300) expected
 from private.store_orders o join public.customers c on c.id=o.customer_id
 where o.guest_request_id is not null and c.identity_kind='GUEST' order by o.guest_payment_method,o.id;
grant select on guest_review_targets to authenticated;
set local role authenticated;
do $review$
declare t record; v bigint; r jsonb; a text; fee jsonb='{"deliveryMinor":300}'; receipt text; mutation uuid; begin
 for t in select * from guest_review_targets loop
  perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
  perform public.store_purchase_error(format('select public.store_purchase_read_v1(''EG'',''order'',%L)',t.id),'42501','guest order private');
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''quote_delivery'',%L,1,%L,%L)',gen_random_uuid(),t.id,fee),'42501','customer cannot quote delivery');
  perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
  r=public.store_purchase_read_v1('EG','order',t.id);
  perform public.store_purchase_assert(r->>'totalMinor' is null and r->'payment'->>'status'='AWAITING_CONFIRMATION','pending delivery price not zero');
  v=(r->>'revision')::bigint;
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''accept'',%L,%s,%L)',gen_random_uuid(),v,t.id),'PT409','legacy accept cannot bypass consent');
  r=public.store_purchase_command_v1('EG','quote_delivery',gen_random_uuid(),v,t.id,fee); v=(r->>'revision')::bigint;
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''confirm_total'',%L,%s,%L,%L)',gen_random_uuid(),v,t.id,'{"totalMinor":2500,"evidenceReference":"Synthetic confirmation"}'),'PT409','customer must confirm exact total');
  r=public.store_purchase_command_v1('EG','confirm_total',gen_random_uuid(),v,t.id,jsonb_build_object('totalMinor',t.expected,'evidenceReference','Synthetic phone confirmation'));v=(r->>'revision')::bigint;
  perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''quote_delivery'',%L,%s,%L,%L)',gen_random_uuid(),v,t.id,fee),'PT409','accepted order total locked');
  if t.method<>'CASH' then
   perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''send'',%L,%s,%L)',gen_random_uuid(),v,t.id),'PT409','manual transfer cannot release before collection');
   perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000004',true);
   perform public.store_purchase_error(format('select public.store_purchase_command_v1(''EG'',''verify_bank'',%L,%s,%L,%L)',gen_random_uuid(),v,t.id,jsonb_build_object('reference','SYNTHETIC-123456','amountMinor',t.expected,'evidenceReference','SYNTHETIC')),'42501','unauthorized receipt denied');
   perform set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
   mutation=gen_random_uuid();
   r=public.store_purchase_command_v1('EG','verify_bank',mutation,v,t.id,jsonb_build_object('reference','SYNTHETIC-123456','amountMinor',t.expected,'evidenceReference','SYNTHETIC'));
   perform public.store_purchase_assert(r=public.store_purchase_command_v1('EG','verify_bank',mutation,v,t.id,jsonb_build_object('reference','SYNTHETIC-123456','amountMinor',t.expected,'evidenceReference','SYNTHETIC')),'verified receipt retry applied once');
   v=(r->>'revision')::bigint;
  end if;
  foreach a in array array['send','prepare','dispatch','deliver'] loop
   r=public.store_purchase_command_v1('EG',a,gen_random_uuid(),v,t.id);v=(r->>'revision')::bigint;
  end loop;
  if t.method='CASH' then
   perform public.store_purchase_assert(public.store_purchase_read_v1('EG','order',t.id)->'payment'->>'status'='CASH_DUE','guest COD remains due after delivery');
   r=public.store_purchase_command_v1('EG','report_cash',gen_random_uuid(),v,t.id,'{"amountMinor":2580,"reason":"Synthetic collected","evidenceReference":"Synthetic receipt"}');v=(r->>'revision')::bigint;
   r=public.store_purchase_command_v1('EG','confirm_cash',gen_random_uuid(),v,t.id,'{"evidenceReference":"Synthetic independent confirmation"}');
  end if;
  perform public.store_purchase_assert(public.store_purchase_read_v1('EG','order',t.id)->'payment'->>'status'='VERIFIED','settled actual collection '||t.method);
 end loop;
end $review$;
reset role;
update private.store_policy_versions set status='REVOKED',revision=revision+1 where kind='STOREFRONT_SCOPE';
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select public.store_purchase_assert(jsonb_array_length(public.store_purchase_read_v1('EG','orders')->'items')=3,'Customer history survives storefront withdrawal');
reset role;
-- TAP evidence
select public.store_purchase_assert((select count(*)=4 from guest_review_targets),'all four checkout methods covered');
select public.store_purchase_assert((select count(distinct channel)=3 and bool_and(store_proof_id is null)
 from private.manual_collection_receipts r join guest_review_targets t on t.id=(select p.order_id from private.store_payments p where p.id=r.store_payment_id)
 where r.domain='STORE'),'all three manual channels recorded independently without uploaded evidence');
select plan(count(*)::integer) from public.store_purchase_test_results;
select pass(label) from public.store_purchase_test_results;
select * from finish();
rollback;
