-- An unauthenticated order uses a GUEST customer, never an Auth account or membership.
-- Its delivery fee and final total are unknown until a staff quote is recorded.
alter table private.store_orders
  add column guest_request_id uuid unique,
  add column guest_intent_hash text,
  add column guest_payment_method text check (guest_payment_method in ('CASH','BANK_TRANSFER')),
  alter column cart_id drop not null,
  alter column cart_revision drop not null,
  alter column delivery_minor drop not null,
  alter column total_minor drop not null,
  add constraint store_order_checkout_shape check (
    (guest_request_id is null and guest_intent_hash is null and guest_payment_method is null
     and cart_id is not null and cart_revision is not null and delivery_minor is not null and total_minor is not null)
    or (guest_request_id is not null and guest_intent_hash is not null and guest_payment_method is not null
        and cart_id is null and cart_revision is null and ((delivery_minor is null) = (total_minor is null)))
  );

-- Narrow, write-only RPC. An exact replay returns only the non-secret human reference.
create function public.store_guest_checkout_v1(p_request uuid, p_payload jsonb)
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
     or method is null or method not in ('CASH','BANK_TRANSFER')
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
        or (method='BANK_TRANSFER' and not exists(select 1 from public.bank_accounts b where b.id=any(contract.destination_ids)
             and b.organization_id=scope.organization_id and b.market_id=scope.market_id and b.active
             and b.currency='EGP' and b.destination_type='BANK'))
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
revoke all on function public.store_guest_checkout_v1(uuid,jsonb) from public;
grant execute on function public.store_guest_checkout_v1(uuid,jsonb) to anon,authenticated;
