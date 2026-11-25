-- Keep legacy receipts and the reviewed-order ledger. Guest transfers are verified against the
-- actual receiving account after consent and without requiring an uploaded receipt.
alter table private.store_orders drop constraint store_orders_guest_payment_method_check;
alter table private.store_orders add constraint store_orders_guest_payment_method_check
  check (guest_payment_method in ('CASH','BANK_TRANSFER','VODAFONE_CASH','INSTAPAY'));
alter table private.manual_collection_receipts drop constraint collection_domain_target;
alter table private.manual_collection_receipts add constraint collection_domain_target check(
  (domain='TRANSPORT' and transport_payment_id is not null and attempt_id is not null and store_payment_id is null and store_proof_id is null) or
  (domain='STORE' and transport_payment_id is null and attempt_id is null and store_payment_id is not null and currency='EGP'
    and (channel in ('VODAFONE_CASH','INSTAPAY') or (channel='BANK' and store_proof_id is null))));

create function private.store_guest_transfer_channel(method text) returns text
language sql immutable strict set search_path='' as $$
  select case method when 'BANK_TRANSFER' then 'BANK' when 'VODAFONE_CASH' then 'VODAFONE_CASH' when 'INSTAPAY' then 'INSTAPAY' end
$$;
revoke all on function private.store_guest_transfer_channel(text) from public, anon, authenticated;

create or replace function public.store_guest_checkout_v1(p_request uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  scope private.store_policy_versions;
  listing private.store_product_market_listings;
  price private.store_market_prices;
  offer private.store_supplier_offers;
  agreement private.store_supplier_agreements;
  contract private.store_checkout_contracts;
  prior private.store_orders;
  order_id uuid := gen_random_uuid();
  customer uuid;
  reference text := 'S-' || replace(order_id::text,'-','');
  intent_hash text;
  line jsonb;
  lines jsonb := '[]';
  ids uuid[] := '{}';
  qty integer;
  goods numeric := 0;
  cost numeric := 0;
  tax numeric;
  region text := p_payload->>'governorate';
  method text := p_payload->>'payment_method';
  phone text := p_payload->>'phone';
begin
  if p_request is null or p_payload is null or octet_length(p_payload::text)>20000 or
     not private.store_keys(p_payload,array['items','full_name','phone','governorate','area','address','payment_method'],array['notes'])
     or not private.store_text(p_payload->'full_name',120) or length(btrim(p_payload->>'full_name'))<2
     or not private.store_text(p_payload->'area',100) or length(btrim(p_payload->>'area'))<1
     or not private.store_text(p_payload->'address',500) or length(btrim(p_payload->>'address'))<3
     or not private.store_text(p_payload->'phone',16) or phone !~ '^\+?[0-9]{8,15}$'
     or region is null or region not in ('CAIRO','GIZA')
     or method is null or method not in ('CASH','BANK_TRANSFER','VODAFONE_CASH','INSTAPAY')
     or (p_payload?'notes' and not private.store_text(p_payload->'notes',500))
  then raise exception 'Invalid guest checkout' using errcode='22023'; end if;
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 30
  then raise exception 'Invalid guest cart' using errcode='22023'; end if;

  intent_hash := encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('store:guest:'||p_request::text,0));
  select * into prior from private.store_orders where guest_request_id=p_request;
  if found then
    if prior.guest_intent_hash<>intent_hash then raise exception 'Request changed' using errcode='P4091'; end if;
    return jsonb_build_object('reference',prior.reference);
  end if;

  scope := private.store_scope();
  perform pg_advisory_xact_lock(hashtextextended('naql365:store:catalog:v1:'||scope.organization_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(scope.organization_id::text,34));
  scope := private.store_scope();
  -- Separate subjects inside the existing rate-budget registry isolate checkout from transport.
  -- A fixed organization-wide ceiling cannot be evaded using spoofed IPs or phone numbers.
  perform private.consume_guest_budget(scope.organization_id,'create',md5('store:guest:all')::uuid,120,true);
  perform private.consume_guest_budget(scope.organization_id,'create',md5('store:guest:phone:'||ltrim(phone,'+'))::uuid,5,true);

  for line in select value from jsonb_array_elements(p_payload->'items') loop
    if not private.store_keys(line,array['listing_id','quantity','unit_price']) or
       jsonb_typeof(line->'listing_id') is distinct from 'string' or
       jsonb_typeof(line->'quantity') is distinct from 'number' or (line->>'quantity') !~ '^[1-9][0-9]?$' or
       jsonb_typeof(line->'unit_price') is distinct from 'number'
    then raise exception 'Invalid cart line' using errcode='22023'; end if;
    select * into listing from private.store_product_market_listings
      where id=(line->>'listing_id')::uuid and organization_id=scope.organization_id and market_id=scope.market_id;
    if listing.id is null or not private.store_listing_eligible(scope.organization_id, listing.id)
    then raise exception 'Item unavailable' using errcode='PT409'; end if;
    if listing.id=any(ids) then raise exception 'Duplicate listing' using errcode='22023'; end if;
    ids := array_append(ids,listing.id);
    select * into strict price from private.store_market_prices where id=listing.selected_price_id;
    if (line->>'unit_price')::numeric*100 <> price.amount_minor
    then raise exception 'Price changed' using errcode='PT409'; end if;
    select * into strict offer from private.store_supplier_offers where id=listing.selected_offer_id;
    select * into strict agreement from private.store_supplier_agreements where id=offer.agreement_id;
    if contract.id is null then
      select c.* into contract from private.store_checkout_contracts c
      where c.organization_id=scope.organization_id and c.market_id=scope.market_id and c.currency='EGP'
        and c.status='APPROVED' and c.supplier_id=offer.supplier_id and c.agreement_id=offer.agreement_id
        and c.effective_from<=statement_timestamp() and (c.effective_until is null or c.effective_until>statement_timestamp())
        and exists(select 1 from unnest(c.regions) r where upper(btrim(r)) in
          (region,case region when 'CAIRO' then 'القاهرة' when 'GIZA' then 'الجيزة' end))
      order by c.version desc limit 1;
      if contract.id is null or (method='CASH' and not contract.cod_release)
        or (method<>'CASH' and not exists(select 1 from public.bank_accounts b where b.id=any(contract.destination_ids)
             and b.organization_id=scope.organization_id and b.market_id=scope.market_id and b.active
             and b.currency='EGP' and b.destination_type=private.store_guest_transfer_channel(method)))
      then raise exception 'Checkout authority unavailable' using errcode='PT409'; end if;
    elsif contract.supplier_id<>offer.supplier_id or contract.agreement_id<>offer.agreement_id then
      raise exception 'Single fulfillment agreement required' using errcode='PT409';
    end if;
    qty := (line->>'quantity')::integer;
    goods := goods+price.amount_minor::numeric*qty;
    cost := cost+offer.unit_cost_minor::numeric*qty;
    lines := lines || jsonb_build_array(jsonb_build_object(
      'listing',listing.id,'price',price.id,'offer',offer.id,'quantity',qty,'amount',price.amount_minor,
      'cost',offer.unit_cost_minor,'content',listing.published_content,'commercial',jsonb_build_object(
        'priceVersion',price.version,'offerVersion',offer.version,'listingRevision',listing.revision,
        'agreement',to_jsonb(agreement),'policies',(select jsonb_agg(to_jsonb(p) order by p.id)
          from private.store_policy_versions p where p.id=any(array[listing.identity_policy_id,listing.delivery_policy_id,
          listing.returns_policy_id,price.presentation_policy_id])))));
  end loop;
  tax := round(goods*contract.tax_bps/(case contract.tax_mode when 'ADDITIVE' then 10000 else 10000+contract.tax_bps end));
  if greatest(goods,cost,goods+tax)>9007199254740991 then raise exception 'Amount exceeds limit' using errcode='22003'; end if;

  if auth.uid() is not null then
    select id into customer from public.customers
      where organization_id=scope.organization_id and profile_id=auth.uid() and identity_kind='ACCOUNT';
    if customer is not null then
      perform private.store_purchase_actor(scope.organization_id,scope.market_id,null,customer);
    end if;
  end if;
  if customer is null then
    insert into public.customers(organization_id,identity_kind)
      values(scope.organization_id,'GUEST') returning id into customer;
  end if;
  insert into private.store_orders(id,organization_id,market_id,currency,customer_id,supplier_id,contract_id,reference,
    guest_request_id,guest_intent_hash,guest_payment_method,address,contract_snapshot,subtotal_minor,tax_minor,supplier_entitlement_minor)
  values(order_id,scope.organization_id,scope.market_id,'EGP',customer,contract.supplier_id,contract.id,reference,
    p_request,intent_hash,method,jsonb_strip_nulls(jsonb_build_object('name',p_payload->>'full_name','phone',phone,
    'region',region,'area',p_payload->>'area','line',p_payload->>'address','notes',p_payload->>'notes')),
    to_jsonb(contract),goods,tax,cost);
  for line in select value from jsonb_array_elements(lines) loop
    insert into private.store_order_items(organization_id,order_id,listing_id,offer_id,price_id,quantity,unit_price_minor,
      unit_entitlement_minor,product_snapshot,commercial_snapshot)
    values(scope.organization_id,order_id,(line->>'listing')::uuid,(line->>'offer')::uuid,(line->>'price')::uuid,
      (line->>'quantity')::integer,(line->>'amount')::bigint,(line->>'cost')::bigint,line->'content',line->'commercial');
  end loop;
  insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata)
    values(scope.organization_id,'store.guest_order_placed','store_orders',order_id,'{}');
  return jsonb_build_object('reference',reference);
exception when others then
  -- PostgREST exposes DETAIL directly to callers; never return a rejected private row.
  if sqlstate in ('22023','PT409','PT429','P4091','42501') then
    raise exception 'Guest checkout rejected' using errcode=sqlstate;
  elsif sqlstate in ('22P02','23514','22003','23502') then
    raise exception 'Invalid guest checkout' using errcode='22023';
  end if;
  raise exception 'Guest checkout unavailable' using errcode='XX000';
end $$;

create or replace function public.store_purchase_command_v1(p_country text,p_action text,p_mutation uuid,p_revision bigint,p_target uuid default null,p_payload jsonb default '{}')
 returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions; o private.store_orders; cart private.store_carts; pay private.store_payments; proof private.store_payment_proofs;
 c private.store_checkout_contracts; l private.store_product_market_listings; price private.store_market_prices; offer private.store_supplier_offers; agreement private.store_supplier_agreements;
 bank public.bank_accounts; op private.store_money_operations; entry private.store_money_entries;
 cid uuid; intent jsonb; prior private.store_purchase_receipts; result jsonb; item jsonb; lines jsonb='[]'; ids uuid[]='{}';
 total numeric=0; entitlement numeric=0; tax numeric=0; qty integer; target uuid; perm text; ref text; normalized text; state text; balance bigint; reserved bigint; failure_code text;
begin
 if p_country is distinct from 'EG' or auth.uid() is null then raise exception 'Store access denied' using errcode='42501'; end if;
 if p_action is null or p_mutation is null or p_revision is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>24000 then raise exception 'Invalid Store command' using errcode='22023'; end if;
 if p_action in ('cart','checkout','media','contract_draft','contract_approve','contract_revoke') then s=private.store_scope();
 else
  select * into o from private.store_orders where id=p_target;
  if o.id is null then raise exception 'Store order unavailable' using errcode='42501'; end if;
  s.organization_id=o.organization_id;s.market_id=o.market_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,33));
 perform pg_advisory_xact_lock(hashtextextended('naql365:store:catalog:v1:'||s.organization_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(s.organization_id::text,34));
 if p_action in ('cart','checkout','media','contract_draft','contract_approve','contract_revoke') then s=private.store_scope(); end if;
 if p_action in ('cart','checkout') then
  select id into cid from public.customers where organization_id=s.organization_id and profile_id=auth.uid() and identity_kind='ACCOUNT';
  perform private.store_purchase_actor(s.organization_id,s.market_id,null,cid);
 elsif p_action in ('reserve_proof','submit_proof','discard_proof','request_cancel','request_return') then
  select * into o from private.store_orders where id=p_target and organization_id=s.organization_id and market_id=s.market_id;
  if o.id is null then raise exception 'Store access denied' using errcode='42501'; end if;
  perform private.store_purchase_actor(o.organization_id,o.market_id,null,o.customer_id);

 else
  perm=case when p_action in ('contract_draft','contract_approve','contract_revoke') then 'store.catalog.policy.manage'
   when p_action='media' then 'store.catalog.publish' when p_action in ('quote_delivery','confirm_total','accept','cancel','return') then 'store.orders.manage'
   when p_action in ('send','prepare','dispatch','deliver','exception','recover','report_cash') then 'store.fulfillment.manage'
   when p_action in ('verify_bank','confirm_transfer','reject_proof','confirm_cash') then 'store.payments.verify'
   when p_action in ('money_request','money_unknown','money_verify','money_failed') then 'store.settlements.manage' else null end;
  if perm is null then raise exception 'Invalid Store action' using errcode='22023'; end if;
  perform private.store_purchase_actor(s.organization_id,s.market_id,perm);
  if perm in ('store.payments.verify','store.settlements.manage') and not private.has_permission(s.organization_id,'finance.verify') then raise exception 'Finance authority required' using errcode='42501'; end if;
  if perm='store.settlements.manage' and not private.has_permission(s.organization_id,'store.supplier_cost.read') then raise exception 'Store cost authority required' using errcode='42501'; end if;
  if p_action='contract_approve' and not private.has_permission(s.organization_id,'store.catalog.policy.approve') then raise exception 'Store approval required' using errcode='42501'; end if;
 end if;
 intent=jsonb_build_object('country',p_country,'action',p_action,'target',p_target,'revision',p_revision,'payload',p_payload);
 select * into prior from private.store_purchase_receipts where actor_id=auth.uid() and mutation_id=p_mutation;
 if found then if prior.intent<>intent or prior.organization_id<>s.organization_id then raise exception 'Mutation identity reused' using errcode='22023'; end if; return prior.result; end if;
 if p_action='cart' then
  if not private.store_keys(p_payload,array['items']) or jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items')>30 then raise exception 'Invalid cart' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
   if not private.store_keys(item,array['listingId','revision','quantity']) or (item->>'quantity') !~ '^[1-9][0-9]{0,2}$' or (item->>'revision') !~ '^[1-9][0-9]{0,14}$' then raise exception 'Invalid cart item' using errcode='22023'; end if;
   if (item->>'listingId')::uuid=any(ids) then raise exception 'Duplicate cart item' using errcode='22023'; end if;
   ids=array_append(ids,(item->>'listingId')::uuid);
   select * into l from private.store_product_market_listings where id=(item->>'listingId')::uuid and organization_id=s.organization_id and market_id=s.market_id;
   if l.id is null or not private.store_listing_eligible(s.organization_id,l.id) or l.revision<>(item->>'revision')::bigint then raise exception 'Store product changed' using errcode='PT409'; end if;
  end loop;
  select * into cart from private.store_carts where organization_id=s.organization_id and market_id=s.market_id and customer_id=cid for update;
  if cart.id is null then
   if p_revision<>0 then raise exception 'Cart changed' using errcode='PT409'; end if;
   insert into private.store_carts(organization_id,market_id,customer_id,items) values(s.organization_id,s.market_id,cid,p_payload->'items') returning * into cart;
  else
   if cart.revision<>p_revision then raise exception 'Cart changed' using errcode='PT409'; end if;
   update private.store_carts set items=p_payload->'items',revision=revision+1,checked_out_order_id=null,updated_at=now() where id=cart.id returning * into cart;
  end if;
  result=jsonb_build_object('id',cart.id,'revision',cart.revision);
 elsif p_action='checkout' then
  raise exception 'Use reviewed delivery checkout' using errcode='PT409';
 elsif p_action='media' then
  if not private.store_keys(p_payload,array['media']) or jsonb_typeof(p_payload->'media')<>'array' or jsonb_array_length(p_payload->'media')>5 then raise exception 'Invalid approved media' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_payload->'media') loop
   if not private.store_keys(item,array['src','altAr','altEn']) or (item->>'src') !~ '^/store-assets/[A-Za-z0-9_-]+\.(png|jpg|webp)$' or not private.store_text(item->'altAr',200) or not private.store_text(item->'altEn',200) then raise exception 'Approved local image required' using errcode='22023'; end if;
  end loop;
  update private.store_product_market_listings set approved_media=p_payload->'media',revision=revision+1 where id=p_target and organization_id=s.organization_id and market_id=s.market_id and revision=p_revision returning * into l;
  if l.id is null then raise exception 'Store listing changed' using errcode='PT409'; end if;
  result=jsonb_build_object('id',l.id,'revision',l.revision);
 elsif p_action in ('contract_draft','contract_approve','contract_revoke') then
  if p_action='contract_draft' then
   if p_revision<>0 or not private.store_keys(p_payload,array['supplierId','agreementId','version','regions','deliveryMinor','supplierDeliveryMinor','taxMode','taxBps','taxRecipient','taxDelivery','codRelease','recognition','cancellationBeforeHandoff','returnsAllowed','refundRule','destinationIds','termsAr','termsEn','legalReference','evidenceReference','effectiveFrom','effectiveUntil']) then raise exception 'Complete approved terms required' using errcode='22023'; end if;
   insert into private.store_checkout_contracts(organization_id,market_id,currency,supplier_id,agreement_id,version,status,regions,delivery_minor,supplier_delivery_minor,tax_mode,tax_bps,tax_recipient,tax_delivery,cod_release,recognition,cancellation_before_handoff,returns_allowed,refund_rule,destination_ids,terms_ar,terms_en,legal_reference,evidence_reference,created_by,effective_from,effective_until)
   values(s.organization_id,s.market_id,'EGP',(p_payload->>'supplierId')::uuid,(p_payload->>'agreementId')::uuid,(p_payload->>'version')::integer,'DRAFT',array(select jsonb_array_elements_text(p_payload->'regions')),(p_payload->>'deliveryMinor')::bigint,(p_payload->>'supplierDeliveryMinor')::bigint,p_payload->>'taxMode',(p_payload->>'taxBps')::integer,p_payload->>'taxRecipient',(p_payload->>'taxDelivery')::boolean,(p_payload->>'codRelease')::boolean,p_payload->>'recognition',(p_payload->>'cancellationBeforeHandoff')::boolean,(p_payload->>'returnsAllowed')::boolean,p_payload->>'refundRule',array(select jsonb_array_elements_text(p_payload->'destinationIds'))::uuid[],p_payload->>'termsAr',p_payload->>'termsEn',p_payload->>'legalReference',p_payload->>'evidenceReference',auth.uid(),(p_payload->>'effectiveFrom')::timestamptz,(p_payload->>'effectiveUntil')::timestamptz) returning * into c;
  else
   if p_payload<>'{}'::jsonb then raise exception 'Invalid contract action' using errcode='22023'; end if;
   select * into c from private.store_checkout_contracts where id=p_target and organization_id=s.organization_id and market_id=s.market_id for update;
   if c.id is null or c.revision<>p_revision then raise exception 'Contract changed' using errcode='PT409'; end if;
   if p_action='contract_approve' then
    if c.status<>'DRAFT' or c.created_by=auth.uid() then raise exception 'Independent contract approver required' using errcode='42501'; end if;
    if not exists(select 1 from private.store_supplier_agreements where id=c.agreement_id and status='APPROVED' and effective_from<=now() and (effective_until is null or effective_until>now())) then raise exception 'Approved agreement required' using errcode='PT409'; end if;
    if exists(select 1 from unnest(c.destination_ids) d where not exists(select 1 from public.bank_accounts b where b.id=d and b.organization_id=c.organization_id and b.market_id=c.market_id and b.currency='EGP' and b.active and b.destination_type in ('BANK','VODAFONE_CASH','INSTAPAY'))) then raise exception 'Approved Store receiving destinations required' using errcode='PT409'; end if;
    update private.store_checkout_contracts set status='APPROVED',approved_by=auth.uid(),approved_at=now(),revision=revision+1 where id=c.id returning * into c;
   else update private.store_checkout_contracts set status='REVOKED' where id=c.id returning * into c; end if;
  end if;
  result=jsonb_build_object('id',c.id,'revision',c.revision,'status',c.status);
 else
  -- Order commands share the same organization lock as Transport receipt claims.
  select * into o from private.store_orders where id=p_target and organization_id=s.organization_id and market_id=s.market_id for update;
  if o.id is null then raise exception 'Store order unavailable' using errcode='42501'; end if;
  select * into pay from private.store_payments where order_id=o.id for update;
  if o.revision<>p_revision then raise exception 'Store order changed' using errcode='PT409'; end if;

  if p_action in ('quote_delivery','confirm_total','verify_bank') and o.guest_request_id is null then
   raise exception 'Guest order required' using errcode='PT409';
  end if;
  if o.guest_request_id is not null and o.order_state='PLACED' and p_action not in ('quote_delivery','confirm_total','cancel') then
   raise exception 'Customer confirmation required' using errcode='PT409';
  end if;
  if p_action in ('quote_delivery','confirm_total') then
   if o.order_state<>'PLACED' or o.fulfillment_state<>'AWAITING_RELEASE' or pay.id is not null then
    raise exception 'Confirmed commercial snapshot is immutable' using errcode='PT409';
   end if;
   select * into c from private.store_checkout_contracts where id=o.contract_id and organization_id=o.organization_id and market_id=o.market_id
    and status='APPROVED' and effective_from<=now() and (effective_until is null or effective_until>now()) for share;
   if c.id is null or exists(select 1 from private.store_order_items i join private.store_product_market_listings listing_row on listing_row.id=i.listing_id
     where i.order_id=o.id and (not private.store_listing_eligible(o.organization_id,listing_row.id)
       or listing_row.selected_offer_id is distinct from i.offer_id or listing_row.selected_price_id is distinct from i.price_id)) then
    raise exception 'Review current commercial availability' using errcode='PT409'; end if;
   if p_action='quote_delivery' then
    if not private.store_keys(p_payload,array['deliveryMinor'])
      or jsonb_typeof(p_payload->'deliveryMinor') is distinct from 'number'
      or p_payload->>'deliveryMinor' !~ '^(0|[1-9][0-9]{0,8})$'
      or (p_payload->>'deliveryMinor')::bigint not between c.supplier_delivery_minor and 100000000 then
     raise exception 'Invalid delivery fee' using errcode='22023';
    end if;
    balance=(p_payload->>'deliveryMinor')::bigint;
    total=o.subtotal_minor::numeric+case when c.tax_delivery then balance else 0 end;
    tax=round(total*c.tax_bps/case when c.tax_mode='ADDITIVE' then 10000 else 10000+c.tax_bps end);
    total=o.subtotal_minor::numeric+balance+case when c.tax_mode='ADDITIVE' then tax else 0 end;
    select sum(unit_entitlement_minor::numeric*quantity)+c.supplier_delivery_minor+
      case when c.tax_recipient='SUPPLIER' then tax else 0 end into entitlement
      from private.store_order_items where order_id=o.id;
    if entitlement is null or entitlement>total-(case when c.tax_recipient='NAQL365' then tax else 0 end) then
     raise exception 'Invalid commercial allocation' using errcode='22023';
    end if;
    update private.store_orders set delivery_minor=balance,tax_minor=tax,total_minor=total,supplier_entitlement_minor=entitlement where id=o.id;
   else
    if not private.store_keys(p_payload,array['evidenceReference','totalMinor'])
      or not private.store_text(p_payload->'evidenceReference',200)
      or jsonb_typeof(p_payload->'totalMinor') is distinct from 'number'
      or (p_payload->>'totalMinor')::numeric is distinct from o.total_minor::numeric
      or o.total_minor is null then raise exception 'Confirmed total and contact evidence required' using errcode='PT409'; end if;
    if private.store_guest_transfer_channel(o.guest_payment_method) is not null then
     select * into bank from public.bank_accounts where id=any(c.destination_ids) and organization_id=o.organization_id
      and market_id=o.market_id and currency='EGP' and active and destination_type=private.store_guest_transfer_channel(o.guest_payment_method) order by id limit 1 for share;
     if bank.id is null then raise exception 'Approved receiving account unavailable' using errcode='PT409'; end if;
    elsif o.guest_payment_method is distinct from 'CASH' or not c.cod_release then
     raise exception 'Collection method unavailable' using errcode='PT409';
    end if;
    insert into private.store_payments(organization_id,market_id,order_id,currency,amount_minor,method,collector,destination_id,destination_snapshot,status)
     values(o.organization_id,o.market_id,o.id,'EGP',o.total_minor,o.guest_payment_method,
      case when bank.id is null then 'SUPPLIER' else 'NAQL365' end,bank.id,
      case when bank.id is not null then jsonb_build_object('channel',bank.destination_type,'beneficiaryAr',bank.beneficiary_ar,'beneficiaryEn',bank.beneficiary_en,
       'accountNumber',bank.account_number,'bankAr',bank.bank_name_ar,'bankEn',bank.bank_name_en) end,
      case when bank.id is null then 'CASH_DUE' else 'PENDING' end);
    update private.store_orders set order_state='ACCEPTED' where id=o.id;
   end if;
  elsif p_action='verify_bank' then
   if pay.id is null or private.store_guest_transfer_channel(pay.method) is null or pay.status<>'PENDING' or o.order_state<>'ACCEPTED' then
    raise exception 'Approved unpaid transfer required' using errcode='PT409'; end if;
   if not private.store_keys(p_payload,array['reference','amountMinor','evidenceReference'])
      or not private.store_text(p_payload->'evidenceReference',200)
      or jsonb_typeof(p_payload->'reference') is distinct from 'string'
      or btrim(p_payload->>'reference') !~ '^[A-Za-z0-9][A-Za-z0-9 ./_-]{5,119}$'
      or jsonb_typeof(p_payload->'amountMinor') is distinct from 'number'
      or (p_payload->>'amountMinor')::numeric is distinct from pay.amount_minor::numeric then
    raise exception 'Exact verified collection and reference required' using errcode='22023'; end if;
   normalized=upper(regexp_replace(p_payload->>'reference','[^A-Za-z0-9]','','g'));
   if length(normalized)<6 then raise exception 'Invalid receipt' using errcode='22023'; end if;
   if exists(select 1 from public.bank_transfer_attempts h where h.state='CONFIRMED' and coalesce(h.bank_snapshot->>'destinationType','BANK')=private.store_guest_transfer_channel(pay.method)
     and upper(regexp_replace(h.bank_reference,'[^A-Za-z0-9]','','g'))=normalized) then raise exception 'Receipt already credited' using errcode='23505'; end if;
   insert into private.manual_collection_receipts(organization_id,market_id,domain,channel,external_identity,store_payment_id,amount_minor,currency,verified_by)
    values(o.organization_id,o.market_id,'STORE',private.store_guest_transfer_channel(pay.method),normalized,pay.id,pay.amount_minor,'EGP',auth.uid());
   update private.store_payments set status='VERIFIED',verified_at=now(),revision=revision+1 where id=pay.id;
   insert into private.store_money_entries(organization_id,order_id,kind,amount_minor,holder,evidence_reference,actor_id)
    values(o.organization_id,o.id,'COLLECTION',pay.amount_minor,'NAQL365',p_payload->>'evidenceReference',auth.uid());
   perform private.store_recognize(o.id);
  elsif p_action in ('reserve_proof','submit_proof','discard_proof') then
   if o.order_state in ('CANCELLED','RETURNED') or pay.method='CASH' or pay.status not in ('PENDING','REJECTED') then raise exception 'Store proof unavailable' using errcode='PT409'; end if;
   if p_action='reserve_proof' then
    if not private.store_keys(p_payload,array['fileId','mime','size','sha256']) then raise exception 'Invalid Store proof' using errcode='22023'; end if;
    target=(p_payload->>'fileId')::uuid;
    insert into private.store_payment_proofs(id,organization_id,payment_id,object_path,mime,size_bytes,content_sha256,status)
     values(target,o.organization_id,pay.id,o.organization_id::text||'/'||pay.id::text||'/'||target::text,p_payload->>'mime',(p_payload->>'size')::integer,p_payload->>'sha256','RESERVED') returning * into proof;
    result=jsonb_build_object('proofId',proof.id,'path',proof.object_path);
   elsif p_action='discard_proof' then
    if not private.store_keys(p_payload,array['proofId']) then raise exception 'Invalid Store proof' using errcode='22023'; end if;
    update private.store_payment_proofs set status='ABANDONED' where id=(p_payload->>'proofId')::uuid and payment_id=pay.id and status='RESERVED' returning * into proof;
    if proof.id is null then raise exception 'Incomplete proof unavailable' using errcode='PT409'; end if;
   else
    if not private.store_keys(p_payload,array['proofId'],array['customerReference']) then raise exception 'Invalid Store proof' using errcode='22023'; end if;
    select * into proof from private.store_payment_proofs where id=(p_payload->>'proofId')::uuid and payment_id=pay.id and status='RESERVED';
    if proof.id is null or not exists(select 1 from storage.objects where bucket_id='store-proofs' and name=proof.object_path and metadata->>'mimetype'=proof.mime and coalesce(metadata->>'size',metadata->>'contentLength')::bigint=proof.size_bytes) then raise exception 'Store upload not confirmed' using errcode='PT409'; end if;
    update private.store_payment_proofs set status='SUBMITTED',submitted_at=now(),customer_reference=nullif(btrim(p_payload->>'customerReference'),'') where id=proof.id;
    update private.store_payments set status='UNDER_REVIEW',revision=revision+1 where id=pay.id;
   end if;
  elsif p_action in ('confirm_transfer','reject_proof','confirm_cash') then
   if o.order_state in ('CANCELLED','RETURNED') or pay.status in ('VERIFIED','REFUNDED','CANCELLED') then raise exception 'Store collection unavailable' using errcode='PT409'; end if;
   if not private.store_keys(p_payload,array['evidenceReference'],case when p_action='confirm_transfer' then array['reference'] else '{}'::text[] end) or not private.store_text(p_payload->'evidenceReference',200) then raise exception 'Verified evidence required' using errcode='22023'; end if;
   if p_action='confirm_cash' then
    if pay.method<>'CASH' or o.fulfillment_state<>'DELIVERED' or not exists(select 1 from private.store_purchase_events where order_id=o.id and action='report_cash') then raise exception 'Delivered supplier collection evidence required' using errcode='PT409'; end if;
   else
    select * into proof from private.store_payment_proofs where payment_id=pay.id and status='SUBMITTED';
    if pay.method='CASH' or pay.status<>'UNDER_REVIEW' or proof.id is null then raise exception 'Submitted Store proof required' using errcode='PT409'; end if;
    if p_action='confirm_transfer' then
     ref=p_payload->>'reference';
     if jsonb_typeof(p_payload->'reference') is distinct from 'string' or length(coalesce(ref,''))>120 or btrim(ref) !~ '^[A-Za-z0-9][A-Za-z0-9 ./_-]{5,119}$' then raise exception 'Invalid verified reference' using errcode='22023'; end if;
     normalized=upper(regexp_replace(ref,'[^A-Za-z0-9]','','g'));
     if length(normalized)<6 then raise exception 'Invalid verified reference' using errcode='22023'; end if;
     if exists(select 1 from public.bank_transfer_attempts h where h.state='CONFIRMED' and coalesce(h.bank_snapshot->>'destinationType','BANK')=pay.method and upper(regexp_replace(h.bank_reference,'[^A-Za-z0-9]','','g'))=normalized) then raise exception 'Verified receipt already claimed' using errcode='23505'; end if;
     insert into private.manual_collection_receipts(organization_id,market_id,domain,channel,external_identity,store_payment_id,store_proof_id,amount_minor,currency,verified_by)
      values(o.organization_id,o.market_id,'STORE',pay.method,normalized,pay.id,proof.id,pay.amount_minor,'EGP',auth.uid());
    end if;
    update private.store_payment_proofs set status=case when p_action='reject_proof' then 'REJECTED' else 'VERIFIED' end where id=proof.id;
   end if;
   update private.store_payments set status=case when p_action='reject_proof' then 'REJECTED' else 'VERIFIED' end,verified_at=case when p_action<>'reject_proof' then now() end,revision=revision+1 where id=pay.id;
   if p_action<>'reject_proof' then
    insert into private.store_money_entries(organization_id,order_id,kind,amount_minor,holder,evidence_reference,actor_id)
     values(o.organization_id,o.id,'COLLECTION',pay.amount_minor,pay.collector,p_payload->>'evidenceReference',auth.uid());
    perform private.store_recognize(o.id);
   end if;
  elsif p_action in ('money_request','money_unknown','money_verify','money_failed') then
   if p_action='money_request' then
    if not private.store_keys(p_payload,array['kind','amountMinor','reference'],array['reversesId']) then raise exception 'Invalid money operation' using errcode='22023'; end if;
    if pay.status not in ('VERIFIED','REFUNDED') then raise exception 'Verified collection required' using errcode='PT409'; end if;
    if exists(select 1 from private.store_money_operations x where x.order_id=o.id and x.kind=p_payload->>'kind' and x.state in ('PENDING','UNKNOWN')) then raise exception 'Resolve existing external outcome first' using errcode='PT409'; end if;
    if p_payload->>'kind'='REFUND' and o.order_state not in ('CANCELLED','RETURNED') then raise exception 'Approved cancellation or return required' using errcode='PT409'; end if;
    if p_payload->>'kind'='REVERSAL' then
     select * into entry from private.store_money_entries where id=(p_payload->>'reversesId')::uuid and order_id=o.id and kind in ('SETTLEMENT','REFUND');
     if entry.id is null or (p_payload->>'amountMinor')::bigint<>entry.amount_minor or exists(select 1 from private.store_money_operations where reverses_id=entry.id and state<>'FAILED') then raise exception 'Reversal unavailable' using errcode='PT409'; end if;
    elsif p_payload?'reversesId' then raise exception 'Invalid reversal target' using errcode='22023'; end if;
    if p_payload->>'kind'='SETTLEMENT' then
     select coalesce(sum(amount_minor),0) into balance from private.store_money_entries where order_id=o.id and kind in ('SUPPLIER_PAYABLE','NAQL_RECEIVABLE');
     if balance=0 or o.order_state in ('CANCELLED','RETURNED') then raise exception 'No payable settlement obligation' using errcode='PT409'; end if;
    else balance=pay.amount_minor; end if;
    select coalesce(sum(amount_minor),0) into reserved from private.store_money_operations x where x.order_id=o.id and x.kind=p_payload->>'kind' and x.state<>'FAILED'
     and not exists(select 1 from private.store_money_entries r where r.kind='REVERSAL' and r.reverses_id in (select id from private.store_money_entries where operation_id=x.id));
    if p_payload->>'kind'<>'REVERSAL' and (p_payload->>'amountMinor')::bigint>balance-reserved then raise exception 'Financial balance exceeded or outcome unresolved' using errcode='PT409'; end if;
    -- A refund and supplier settlement cannot race or leave unreversed settlement behind.
    if p_payload->>'kind'='REFUND' and exists(select 1 from private.store_money_operations x where x.order_id=o.id and x.kind='SETTLEMENT' and x.state<>'FAILED' and not exists(select 1 from private.store_money_entries r join private.store_money_entries e on e.id=r.reverses_id where e.operation_id=x.id and r.kind='REVERSAL')) then raise exception 'Resolve or reverse settlement before refund' using errcode='PT409'; end if;
    insert into private.store_money_operations(organization_id,order_id,kind,amount_minor,reference,state,reverses_id) values(o.organization_id,o.id,p_payload->>'kind',(p_payload->>'amountMinor')::bigint,p_payload->>'reference','PENDING',(p_payload->>'reversesId')::uuid) returning * into op;
   else
    if not private.store_keys(p_payload,array['operationId','evidenceReference']) or not private.store_text(p_payload->'evidenceReference',200) then raise exception 'Verified external outcome evidence required' using errcode='22023'; end if;
    select * into op from private.store_money_operations where id=(p_payload->>'operationId')::uuid and order_id=o.id for update;
    if op.id is null or op.state not in ('PENDING','UNKNOWN') then raise exception 'Money operation already resolved' using errcode='PT409'; end if;
    if p_action='money_verify' and op.kind='SETTLEMENT' and o.order_state in ('CANCELLED','RETURNED') then raise exception 'Cancelled obligation requires reconciliation' using errcode='PT409'; end if;
    update private.store_money_operations set state=case p_action when 'money_unknown' then 'UNKNOWN' when 'money_failed' then 'FAILED' else 'VERIFIED' end where id=op.id;
    if p_action='money_verify' then
     insert into private.store_money_entries(organization_id,order_id,kind,amount_minor,holder,operation_id,reverses_id,evidence_reference,actor_id)
     values(o.organization_id,o.id,op.kind,op.amount_minor,case when op.kind='REFUND' then 'CUSTOMER' when pay.method='CASH' then 'NAQL365' else 'SUPPLIER' end,op.id,op.reverses_id,p_payload->>'evidenceReference',auth.uid());
     if op.kind in ('REFUND','REVERSAL') then
      select coalesce(sum(e.amount_minor),0) into balance from private.store_money_entries e where e.order_id=o.id and e.kind='REFUND' and not exists(select 1 from private.store_money_entries r where r.reverses_id=e.id);
      update private.store_payments set status=case when balance=pay.amount_minor then 'REFUNDED' else 'VERIFIED' end,revision=revision+1 where id=pay.id;
     end if;
    end if;
   end if;
   result=jsonb_build_object('operationId',op.id);
  else
   if not private.store_keys(p_payload,'{}'::text[],array['reason','amountMinor','evidenceReference']) then raise exception 'Invalid fulfillment action' using errcode='22023'; end if;
   state=o.fulfillment_state;
   if p_action in ('send','prepare','dispatch','deliver','exception','recover','report_cash') and o.order_state<>'ACCEPTED' then raise exception 'Accepted Store order required' using errcode='PT409'; end if;
   if p_action in ('request_cancel','request_return','exception','recover','cancel','return','report_cash') and not private.store_text(p_payload->'reason',500) then raise exception 'Reason required' using errcode='22023'; end if;
   case p_action
    when 'accept' then if o.order_state<>'PLACED' then raise exception 'Order changed' using errcode='PT409'; end if; update private.store_orders set order_state='ACCEPTED' where id=o.id;
    when 'send' then
     if o.order_state<>'ACCEPTED' or state<>'AWAITING_RELEASE' or (pay.method<>'CASH' and pay.status<>'VERIFIED') or (pay.method='CASH' and o.contract_snapshot->'cod_release'<>'true'::jsonb) then raise exception 'Order not cleared for supplier' using errcode='PT409'; end if;
     if not exists(select 1 from private.store_suppliers where id=o.supplier_id and organization_id=o.organization_id and status='ACTIVE') or not exists(select 1 from private.store_supplier_agreements where id=(o.contract_snapshot->>'agreement_id')::uuid and organization_id=o.organization_id and status='APPROVED') then raise exception 'Supplier release unavailable' using errcode='PT409'; end if;
     state='SENT_TO_SUPPLIER';
    when 'prepare' then if state<>'SENT_TO_SUPPLIER' then raise exception 'Invalid fulfillment transition' using errcode='PT409'; end if; state='PREPARING';
    when 'dispatch' then if state<>'PREPARING' then raise exception 'Invalid fulfillment transition' using errcode='PT409'; end if; state='OUT_FOR_DELIVERY';
    when 'deliver' then if state<>'OUT_FOR_DELIVERY' then raise exception 'Invalid fulfillment transition' using errcode='PT409'; end if; state='DELIVERED';
    when 'exception' then if state not in ('AWAITING_RELEASE','SENT_TO_SUPPLIER','PREPARING','OUT_FOR_DELIVERY') then raise exception 'Invalid fulfillment transition' using errcode='PT409'; end if; state='EXCEPTION';
    when 'recover' then if state<>'EXCEPTION' then raise exception 'No delivery exception' using errcode='PT409'; end if; state='AWAITING_RELEASE';
    when 'request_cancel' then if state not in ('AWAITING_RELEASE','EXCEPTION') or o.order_state in ('CANCELLED','RETURNED') then raise exception 'Cancellation unavailable' using errcode='PT409'; end if;
    when 'request_return' then if state<>'DELIVERED' or o.contract_snapshot->'returns_allowed'<>'true'::jsonb then raise exception 'Return unavailable' using errcode='PT409'; end if;
    when 'cancel' then
     if state not in ('AWAITING_RELEASE','EXCEPTION') or (state='AWAITING_RELEASE' and o.contract_snapshot->'cancellation_before_handoff'<>'true'::jsonb) then raise exception 'Approved cancellation policy required' using errcode='PT409'; end if;
     update private.store_orders set order_state='CANCELLED' where id=o.id; state='CANCELLED';
     if pay.status not in ('VERIFIED','REFUNDED') then update private.store_payments set status='CANCELLED',revision=revision+1 where id=pay.id; end if;
    when 'return' then if state<>'DELIVERED' or o.contract_snapshot->'returns_allowed'<>'true'::jsonb then raise exception 'Approved return policy required' using errcode='PT409'; end if; update private.store_orders set order_state='RETURNED' where id=o.id; state='RETURNED';
     if pay.status not in ('VERIFIED','REFUNDED') then update private.store_payments set status='CANCELLED',revision=revision+1 where id=pay.id; end if;
    when 'report_cash' then if pay.method<>'CASH' or state<>'DELIVERED' or (p_payload->>'amountMinor')::bigint is distinct from pay.amount_minor or not private.store_text(p_payload->'evidenceReference',200) then raise exception 'Exact supplier cash report required' using errcode='22023'; end if;
    else raise exception 'Invalid Store action' using errcode='22023';
   end case;
   update private.store_orders set fulfillment_state=state where id=o.id;
   if p_action in ('cancel','return') then
    if o.contract_snapshot->>'refund_rule' is distinct from 'FULL_REVERSAL' then raise exception 'Approved financial cancellation rule required' using errcode='PT409'; end if;
    insert into private.store_money_entries(organization_id,order_id,kind,amount_minor,holder,reverses_id,evidence_reference,actor_id)
     select organization_id,order_id,'OBLIGATION_REVERSAL',amount_minor,holder,id,'APPROVED-FULL-REVERSAL:'||o.contract_id::text,auth.uid()
     from private.store_money_entries e where e.order_id=o.id and e.kind in ('SUPPLIER_PAYABLE','NAQL_RECEIVABLE') and not exists(select 1 from private.store_money_entries r where r.reverses_id=e.id);
   end if;
   perform private.store_recognize(o.id);
  end if;
  update private.store_orders set revision=revision+1 where id=o.id returning * into o;
  result=coalesce(result,'{}')||jsonb_build_object('id',o.id,'revision',o.revision);
 end if;
 insert into private.store_purchase_receipts(actor_id,mutation_id,organization_id,intent,result) values(auth.uid(),p_mutation,s.organization_id,intent,result);
 insert into private.store_purchase_events(organization_id,order_id,actor_id,mutation_id,action,detail) values(s.organization_id,o.id,auth.uid(),p_mutation,p_action,
  case when p_action in ('quote_delivery','confirm_total','verify_bank') then p_payload||jsonb_build_object('totalMinor',o.total_minor,'deliveryMinor',o.delivery_minor) when p_action in ('request_cancel','request_return','exception','recover','report_cash','money_verify','money_failed','money_unknown') then p_payload else '{}'::jsonb end);
 return result;
exception when others then
 get stacked diagnostics failure_code=returned_sqlstate;
 -- PostgREST exposes database DETAIL: never return a failed private commercial row.
 if failure_code in ('42501','PT409','23505','40001','55000','22023') then raise exception 'Store request rejected' using errcode=failure_code;
 elsif failure_code in ('23514','23503','23502','22003','22P02','22007','22008') then raise exception 'Invalid Store input' using errcode='22023';
 else raise exception 'Store command unavailable' using errcode='XX000'; end if;
end $$;
