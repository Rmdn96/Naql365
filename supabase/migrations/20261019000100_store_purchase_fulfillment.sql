-- Migration 50. Private, EG/EGP, registered Customers only. No seeds or role grants.
-- Checkout requires separately approved, typed commercial authority; no business defaults.
create table private.store_checkout_contracts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 currency text not null check(currency='EGP'), supplier_id uuid not null, agreement_id uuid not null,
 version integer not null check(version>0), status text not null check(status in ('DRAFT','APPROVED','REVOKED')),
 regions text[] not null check(cardinality(regions) between 1 and 100),
 delivery_minor bigint not null check(delivery_minor between 0 and 100000000),
 supplier_delivery_minor bigint not null check(supplier_delivery_minor between 0 and delivery_minor),
 tax_mode text not null check(tax_mode in ('INCLUDED','ADDITIVE')),
 tax_bps integer not null check(tax_bps between 0 and 10000),
 tax_recipient text not null check(tax_recipient in ('NAQL365','SUPPLIER')),
 tax_delivery boolean not null,
 cod_release boolean not null, recognition text not null check(recognition in ('VERIFIED_COLLECTION','DELIVERED_AND_VERIFIED')),
 cancellation_before_handoff boolean not null, returns_allowed boolean not null,
 refund_rule text not null check(refund_rule='FULL_REVERSAL'),
 destination_ids uuid[] not null check(cardinality(destination_ids)<=30),
 terms_ar text not null check(length(terms_ar) between 1 and 4000), terms_en text not null check(length(terms_en) between 1 and 4000),
 legal_reference text not null check(length(legal_reference) between 1 and 200),
 evidence_reference text not null check(length(evidence_reference) between 1 and 200),
 created_by uuid not null references public.profiles(id) on delete restrict,
 approved_by uuid references public.profiles(id) on delete restrict, approved_at timestamptz,
 effective_from timestamptz not null, effective_until timestamptz,
 revision bigint not null default 1, created_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from),
 check(status='DRAFT' or (approved_by is not null and approved_at is not null)),
 foreign key(organization_id,market_id,currency,supplier_id,agreement_id) references private.store_supplier_agreements(organization_id,market_id,currency,supplier_id,id),
 unique(organization_id,market_id,id), unique(organization_id,market_id,supplier_id,version)
);
create table private.store_carts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 customer_id uuid not null, revision bigint not null default 1,
 items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=30),
 checked_out_order_id uuid, updated_at timestamptz not null default now(),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,market_id) references public.markets(organization_id,id),
 unique(organization_id,id), unique(organization_id,market_id,customer_id)
);
create table private.store_orders (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 currency text not null check(currency='EGP'), customer_id uuid not null, supplier_id uuid not null,
 contract_id uuid not null, cart_id uuid not null, cart_revision bigint not null,
 reference text not null unique, address jsonb not null, contract_snapshot jsonb not null,
 subtotal_minor bigint not null check(subtotal_minor between 1 and 9007199254740991),
 delivery_minor bigint not null check(delivery_minor>=0), tax_minor bigint not null check(tax_minor>=0),
 total_minor bigint not null check(total_minor between 1 and 9007199254740991),
 supplier_entitlement_minor bigint not null check(supplier_entitlement_minor between 0 and 9007199254740991),
 order_state text not null default 'PLACED' check(order_state in ('PLACED','ACCEPTED','CANCELLED','RETURNED')),
 fulfillment_state text not null default 'AWAITING_RELEASE' check(fulfillment_state in ('AWAITING_RELEASE','SENT_TO_SUPPLIER','PREPARING','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED','RETURNED')),
 revision bigint not null default 1, created_at timestamptz not null default now(),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 check(total_minor::numeric=subtotal_minor::numeric+delivery_minor+case when contract_snapshot->>'tax_mode'='ADDITIVE' then tax_minor else 0 end),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,supplier_id) references private.store_suppliers(organization_id,id),
 foreign key(organization_id,market_id,contract_id) references private.store_checkout_contracts(organization_id,market_id,id),
 foreign key(organization_id,cart_id) references private.store_carts(organization_id,id),
 unique(organization_id,market_id,id), unique(organization_id,id), unique(cart_id,cart_revision)
);
alter table private.store_carts add foreign key(organization_id,checked_out_order_id) references private.store_orders(organization_id,id);
create table private.store_order_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, order_id uuid not null,
 listing_id uuid not null, offer_id uuid not null, price_id uuid not null,
 quantity integer not null check(quantity between 1 and 999),
 unit_price_minor bigint not null check(unit_price_minor>0), unit_entitlement_minor bigint not null check(unit_entitlement_minor>=0),
 product_snapshot jsonb not null, commercial_snapshot jsonb not null,
 foreign key(organization_id,order_id) references private.store_orders(organization_id,id),
 foreign key(organization_id,listing_id) references private.store_product_market_listings(organization_id,id),
 foreign key(organization_id,offer_id) references private.store_supplier_offers(organization_id,id),
 foreign key(organization_id,price_id) references private.store_market_prices(organization_id,id),
 unique(order_id,listing_id)
);
create table private.store_payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 order_id uuid not null unique, currency text not null check(currency='EGP'), amount_minor bigint not null check(amount_minor>0),
 method text not null check(method in ('CASH','VODAFONE_CASH','INSTAPAY')),
 collector text not null check(collector in ('SUPPLIER','NAQL365')),
 destination_id uuid, destination_snapshot jsonb,
 status text not null check(status in ('CASH_DUE','PENDING','UNDER_REVIEW','REJECTED','VERIFIED','CANCELLED','REFUNDED')),
 revision bigint not null default 1, verified_at timestamptz,
 check((method='CASH' and collector='SUPPLIER' and destination_id is null and destination_snapshot is null) or
 (method<>'CASH' and collector='NAQL365' and destination_id is not null and destination_snapshot is not null)),
 foreign key(organization_id,market_id,order_id) references private.store_orders(organization_id,market_id,id),
 foreign key(organization_id,market_id,destination_id) references public.bank_accounts(organization_id,market_id,id),
 unique(organization_id,market_id,id), unique(organization_id,id)
);
create table private.store_payment_proofs (
 id uuid primary key, organization_id uuid not null, payment_id uuid not null,
 object_path text not null unique, mime text not null check(mime in ('image/png','application/pdf')), size_bytes integer not null check(size_bytes between 1 and 2097152),
 status text not null check(status in ('RESERVED','SUBMITTED','REJECTED','VERIFIED','ABANDONED')),
 content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
 customer_reference text check(customer_reference is null or (length(customer_reference) between 1 and 120 and customer_reference !~ '[[:cntrl:]]')),
 created_at timestamptz not null default now(), submitted_at timestamptz,
 foreign key(organization_id,payment_id) references private.store_payments(organization_id,id),
 unique(organization_id,payment_id,id)
);
create unique index store_one_pending_proof on private.store_payment_proofs(payment_id) where status in ('RESERVED','SUBMITTED');
create table private.store_purchase_receipts (
 actor_id uuid not null, mutation_id uuid not null, organization_id uuid not null references public.organizations(id),
 intent jsonb not null, result jsonb not null, created_at timestamptz not null default now(), primary key(actor_id,mutation_id), unique(organization_id,actor_id,mutation_id)
);
create table private.store_purchase_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, order_id uuid,
 actor_id uuid not null, mutation_id uuid not null, action text not null, detail jsonb not null default '{}', occurred_at timestamptz not null default now(),
 foreign key(organization_id,order_id) references private.store_orders(organization_id,id),
 foreign key(organization_id,actor_id,mutation_id) references private.store_purchase_receipts(organization_id,actor_id,mutation_id), unique(actor_id,mutation_id)
);
-- Immutable entries describe verified facts. Operations model UNKNOWN external outcomes.
create table private.store_money_operations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, order_id uuid not null,
 kind text not null check(kind in ('SETTLEMENT','REFUND','REVERSAL')),
 amount_minor bigint not null check(amount_minor>0), reference text not null check(length(reference) between 1 and 120),
 state text not null check(state in ('PENDING','UNKNOWN','VERIFIED','FAILED')),
 reverses_id uuid, created_at timestamptz not null default now(),
 foreign key(organization_id,order_id) references private.store_orders(organization_id,id),
 unique(organization_id,id), unique(organization_id,order_id,id), unique(organization_id,kind,reference)
);
create table private.store_money_entries (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, order_id uuid not null,
 kind text not null check(kind in ('COLLECTION','SUPPLIER_PAYABLE','NAQL_RECEIVABLE','OBLIGATION_REVERSAL','SETTLEMENT','REFUND','REVERSAL')),
 amount_minor bigint not null check(amount_minor>0), holder text not null check(holder in ('SUPPLIER','NAQL365','CUSTOMER')),
 operation_id uuid, reverses_id uuid, evidence_reference text not null check(length(evidence_reference) between 1 and 200),
 actor_id uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(),
 foreign key(organization_id,order_id) references private.store_orders(organization_id,id),
 foreign key(organization_id,order_id,operation_id) references private.store_money_operations(organization_id,order_id,id),
 unique(organization_id,id), unique(organization_id,order_id,id), unique(operation_id), unique(reverses_id)
);
alter table private.store_money_entries add foreign key(organization_id,order_id,reverses_id) references private.store_money_entries(organization_id,order_id,id);
alter table private.store_money_operations add foreign key(organization_id,order_id,reverses_id) references private.store_money_entries(organization_id,order_id,id);
create unique index store_collection_once on private.store_money_entries(order_id) where kind='COLLECTION';
create unique index store_entitlement_once on private.store_money_entries(order_id) where kind in ('SUPPLIER_PAYABLE','NAQL_RECEIVABLE');
create index store_orders_customer_page on private.store_orders(organization_id,market_id,customer_id,created_at desc,id desc);
create index store_orders_staff_page on private.store_orders(organization_id,market_id,created_at desc,id desc);
create index store_entries_order on private.store_money_entries(organization_id,order_id);
create index store_proofs_payment on private.store_payment_proofs(organization_id,payment_id,created_at desc);
create function private.store_item_scope() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from private.store_orders o
  join private.store_product_market_listings l on l.organization_id=o.organization_id and l.market_id=o.market_id and l.currency=o.currency and l.id=new.listing_id
  join private.store_supplier_offers f on f.organization_id=o.organization_id and f.market_id=o.market_id and f.currency=o.currency and f.supplier_id=o.supplier_id and f.product_id=l.product_id and f.id=new.offer_id
  join private.store_market_prices p on p.organization_id=o.organization_id and p.market_id=o.market_id and p.currency=o.currency and p.listing_id=l.id and p.id=new.price_id
  where o.id=new.order_id and o.organization_id=new.organization_id and f.unit_cost_minor=new.unit_entitlement_minor and p.amount_minor=new.unit_price_minor)
 then raise exception 'Invalid Store item scope' using errcode='23514'; end if;
 return new;
end $$;
create trigger store_order_item_scope before insert on private.store_order_items for each row execute function private.store_item_scope();
revoke all on function private.store_item_scope() from public,anon,authenticated;
-- Extend the SAME receipt registry, keeping the existing unique(channel,external_identity).
alter table private.manual_collection_receipts alter column transport_payment_id drop not null;
alter table private.manual_collection_receipts alter column attempt_id drop not null;
alter table private.manual_collection_receipts drop constraint manual_collection_receipts_domain_check;
alter table private.manual_collection_receipts add column store_payment_id uuid;
alter table private.manual_collection_receipts add column store_proof_id uuid;
alter table private.manual_collection_receipts add constraint collection_domain_target check(
 (domain='TRANSPORT' and transport_payment_id is not null and attempt_id is not null and store_payment_id is null and store_proof_id is null) or
 (domain='STORE' and transport_payment_id is null and attempt_id is null and store_payment_id is not null and store_proof_id is not null and currency='EGP' and channel in ('VODAFONE_CASH','INSTAPAY')));
alter table private.manual_collection_receipts add foreign key(organization_id,market_id,store_payment_id) references private.store_payments(organization_id,market_id,id);
alter table private.manual_collection_receipts add foreign key(organization_id,store_payment_id,store_proof_id) references private.store_payment_proofs(organization_id,payment_id,id);
create unique index collection_store_payment on private.manual_collection_receipts(store_payment_id) where store_payment_id is not null;
create unique index collection_store_proof on private.manual_collection_receipts(store_proof_id) where store_proof_id is not null;
insert into public.permissions(code) values ('store.orders.read'),('store.orders.manage'),('store.fulfillment.manage'),
 ('store.payments.read'),('store.payments.verify'),('store.settlements.manage') on conflict(code) do nothing;

create function private.store_purchase_actor(p_org uuid,p_market uuid,p_permission text default null,p_customer uuid default null)
 returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.markets where id=p_market and organization_id=p_org and country_code='EG' and currency='EGP' and active)
 or (select count(*) from public.organization_memberships where profile_id=auth.uid() and status='active')<>1 then raise exception 'Store access denied' using errcode='42501'; end if;
 if p_permission is null then
  if not exists(select 1 from public.organization_memberships m join public.customers c on c.organization_id=m.organization_id and c.profile_id=m.profile_id
    where m.organization_id=p_org and m.profile_id=auth.uid() and m.member_type='customer' and m.status='active' and c.id=p_customer)
    or not private.has_permission(p_org,'account.access') then raise exception 'Store Customer required' using errcode='42501'; end if;
 else
  if not exists(select 1 from public.organization_memberships where organization_id=p_org and profile_id=auth.uid() and member_type='staff' and status='active')
    or not private.has_permission(p_org,'portal.access') or not private.has_permission(p_org,p_permission)
    then raise exception 'Store permission required' using errcode='42501'; end if;
 end if;
end $$;

create function public.store_purchase_command_v1(p_country text,p_action text,p_mutation uuid,p_revision bigint,p_target uuid default null,p_payload jsonb default '{}')
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
   when p_action='media' then 'store.catalog.publish' when p_action in ('accept','cancel','return') then 'store.orders.manage'
   when p_action in ('send','prepare','dispatch','deliver','exception','recover','report_cash') then 'store.fulfillment.manage'
   when p_action in ('confirm_transfer','reject_proof','confirm_cash') then 'store.payments.verify'
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
  if not private.store_keys(p_payload,array['contractId','contractRevision','address','method'],array['destinationId']) or
   not private.store_keys(p_payload->'address',array['name','phone','region','line']) then raise exception 'Invalid checkout' using errcode='22023'; end if;
  if not private.store_text(p_payload->'address'->'name',120) or not private.store_text(p_payload->'address'->'phone',40) or not private.store_text(p_payload->'address'->'region',80) or not private.store_text(p_payload->'address'->'line',500) then raise exception 'Invalid delivery address' using errcode='22023'; end if;
  select * into cart from private.store_carts where organization_id=s.organization_id and market_id=s.market_id and customer_id=cid for update;
  if cart.id is null or cart.revision<>p_revision or cart.checked_out_order_id is not null or jsonb_array_length(cart.items)=0 then raise exception 'Cart changed or already checked out' using errcode='PT409'; end if;
  select * into c from private.store_checkout_contracts where id=(p_payload->>'contractId')::uuid and organization_id=s.organization_id and market_id=s.market_id and status='APPROVED' and effective_from<=now() and (effective_until is null or effective_until>now());
  if c.id is null or c.revision<>(p_payload->>'contractRevision')::bigint or not ((p_payload->'address'->>'region')=any(c.regions)) then raise exception 'Approved checkout authority unavailable' using errcode='PT409'; end if;
  if p_payload->>'method' not in ('CASH','VODAFONE_CASH','INSTAPAY') or (p_payload->>'method'='CASH' and (not c.cod_release or p_payload?'destinationId')) then raise exception 'Payment method unavailable' using errcode='PT409'; end if;
  if p_payload->>'method'<>'CASH' then
   if not ((p_payload->>'destinationId')::uuid=any(c.destination_ids)) then raise exception 'Store destination not approved by contract' using errcode='PT409'; end if;
   select * into bank from public.bank_accounts where id=(p_payload->>'destinationId')::uuid and organization_id=s.organization_id and market_id=s.market_id and currency='EGP' and active and destination_type=p_payload->>'method';
   if bank.id is null then raise exception 'Approved transfer destination unavailable' using errcode='PT409'; end if;
  end if;
  for item in select value from jsonb_array_elements(cart.items) loop
   select * into l from private.store_product_market_listings where id=(item->>'listingId')::uuid and organization_id=s.organization_id and market_id=s.market_id;
   if l.id is null or l.revision<>(item->>'revision')::bigint or not private.store_listing_eligible(s.organization_id,l.id) then raise exception 'Store product changed' using errcode='PT409'; end if;
   select * into price from private.store_market_prices where id=l.selected_price_id;
   select * into offer from private.store_supplier_offers where id=l.selected_offer_id;
   select * into agreement from private.store_supplier_agreements where id=offer.agreement_id;
   if offer.supplier_id<>c.supplier_id or offer.agreement_id<>c.agreement_id then raise exception 'One approved supplier agreement per order' using errcode='PT409'; end if;
   qty=(item->>'quantity')::integer;
   total=total+price.amount_minor::numeric*qty; entitlement=entitlement+offer.unit_cost_minor::numeric*qty;
   lines=lines||jsonb_build_array(jsonb_build_object('listing',l.id,'price',price.id,'offer',offer.id,'quantity',qty,'unitPrice',price.amount_minor,'unitEntitlement',offer.unit_cost_minor,
    'content',l.published_content,'commercial',jsonb_build_object('priceVersion',price.version,'offerVersion',offer.version,'listingRevision',l.revision,'agreement',to_jsonb(agreement),
      'policies',(select jsonb_agg(to_jsonb(x) order by x.id) from private.store_policy_versions x where x.id=any(array[l.identity_policy_id,l.delivery_policy_id,l.returns_policy_id,price.presentation_policy_id])))));
  end loop;
  tax=round(case when c.tax_mode='ADDITIVE' then (total+case when c.tax_delivery then c.delivery_minor else 0 end)*c.tax_bps/10000 else (total+case when c.tax_delivery then c.delivery_minor else 0 end)*c.tax_bps/(10000+c.tax_bps) end);
  entitlement=entitlement+c.supplier_delivery_minor+case when c.tax_recipient='SUPPLIER' then tax else 0 end;
  target=gen_random_uuid();
  insert into private.store_orders(id,organization_id,market_id,currency,customer_id,supplier_id,contract_id,cart_id,cart_revision,reference,address,contract_snapshot,subtotal_minor,delivery_minor,tax_minor,total_minor,supplier_entitlement_minor)
   values(target,s.organization_id,s.market_id,'EGP',cid,c.supplier_id,c.id,cart.id,cart.revision,'S-'||replace(target::text,'-',''),p_payload->'address',to_jsonb(c),total,c.delivery_minor,tax,total+c.delivery_minor+case when c.tax_mode='ADDITIVE' then tax else 0 end,entitlement) returning * into o;
  if o.supplier_entitlement_minor>o.total_minor-(case when c.tax_recipient='NAQL365' then o.tax_minor else 0 end) then raise exception 'Commercial allocation exceeds obligation' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(lines) loop
   insert into private.store_order_items(organization_id,order_id,listing_id,offer_id,price_id,quantity,unit_price_minor,unit_entitlement_minor,product_snapshot,commercial_snapshot)
    values(s.organization_id,o.id,(item->>'listing')::uuid,(item->>'offer')::uuid,(item->>'price')::uuid,(item->>'quantity')::integer,(item->>'unitPrice')::bigint,(item->>'unitEntitlement')::bigint,item->'content',item->'commercial');
  end loop;
  insert into private.store_payments(organization_id,market_id,order_id,currency,amount_minor,method,collector,destination_id,destination_snapshot,status)
   values(s.organization_id,s.market_id,o.id,'EGP',o.total_minor,p_payload->>'method',case when p_payload->>'method'='CASH' then 'SUPPLIER' else 'NAQL365' end,bank.id,
    case when bank.id is not null then jsonb_build_object('id',bank.id,'channel',bank.destination_type,'beneficiaryAr',bank.beneficiary_ar,'beneficiaryEn',bank.beneficiary_en,'accountNumber',bank.account_number,'bankAr',bank.bank_name_ar,'bankEn',bank.bank_name_en) else null end,
    case when p_payload->>'method'='CASH' then 'CASH_DUE' else 'PENDING' end);
  update private.store_carts set checked_out_order_id=o.id where id=cart.id;
  result=jsonb_build_object('id',o.id,'revision',o.revision);
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
    if exists(select 1 from unnest(c.destination_ids) d where not exists(select 1 from public.bank_accounts b where b.id=d and b.organization_id=c.organization_id and b.market_id=c.market_id and b.currency='EGP' and b.active and b.destination_type in ('VODAFONE_CASH','INSTAPAY'))) then raise exception 'Approved Store receiving destinations required' using errcode='PT409'; end if;
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
  if p_action in ('reserve_proof','submit_proof','discard_proof') then
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
  case when p_action in ('request_cancel','request_return','exception','recover','report_cash','money_verify','money_failed','money_unknown') then p_payload else '{}'::jsonb end);
 return result;
exception when others then
 get stacked diagnostics failure_code=returned_sqlstate;
 -- PostgREST exposes database DETAIL: never return a failed private commercial row.
 if failure_code in ('42501','PT409','23505','40001','55000','22023') then raise exception 'Store request rejected' using errcode=failure_code;
 elsif failure_code in ('23514','23503','23502','22003','22P02','22007','22008') then raise exception 'Invalid Store input' using errcode='22023';
 else raise exception 'Store command unavailable' using errcode='XX000'; end if;
end $$;
create function private.store_purchase_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or tg_table_name in ('store_order_items','store_purchase_events','store_purchase_receipts','store_money_entries') then
  raise exception 'Store immutable history' using errcode='55000'; end if;
 if tg_table_name='store_checkout_contracts' then
  if old.status<>'DRAFT' and (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
   raise exception 'Store approved contract immutable' using errcode='55000'; end if;
  if old.status<>'DRAFT' and new.status<>'REVOKED' then raise exception 'Store contract retained' using errcode='55000'; end if;
 end if;
 if tg_table_name='store_orders' and (to_jsonb(new)-array['order_state','fulfillment_state','revision']) is distinct from (to_jsonb(old)-array['order_state','fulfillment_state','revision']) then
  raise exception 'Store commercial snapshot immutable' using errcode='55000'; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['store_checkout_contracts','store_carts','store_orders','store_order_items','store_payments','store_payment_proofs','store_purchase_receipts','store_purchase_events','store_money_operations','store_money_entries'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('create trigger store_purchase_retention before update or delete on private.%I for each row execute function private.store_purchase_guard()',t);
 end loop;
end $$;

-- Recognition is server-derived from frozen terms and actual verified collection.
create function private.store_recognize(p_order uuid) returns void language plpgsql security definer set search_path='' as $$
declare o private.store_orders; p private.store_payments; amount bigint;
begin
 select * into o from private.store_orders where id=p_order;
 select * into p from private.store_payments where order_id=o.id;
 if p.status<>'VERIFIED' or o.order_state in ('CANCELLED','RETURNED') or
  (o.contract_snapshot->>'recognition'='DELIVERED_AND_VERIFIED' and o.fulfillment_state<>'DELIVERED') then return; end if;
 if exists(select 1 from private.store_money_entries where order_id=o.id and kind in ('SUPPLIER_PAYABLE','NAQL_RECEIVABLE')) then return; end if;
 amount=case when p.method='CASH' then o.total_minor-o.supplier_entitlement_minor-case when o.contract_snapshot->>'tax_recipient'='NAQL365' then o.tax_minor else 0 end else o.supplier_entitlement_minor end;
 if amount<0 then raise exception 'Store entitlement invalid' using errcode='55000'; end if;
 if amount>0 then insert into private.store_money_entries(organization_id,order_id,kind,amount_minor,holder,evidence_reference,actor_id)
 values(o.organization_id,o.id,case when p.method='CASH' then 'NAQL_RECEIVABLE' else 'SUPPLIER_PAYABLE' end,amount,
 case when p.method='CASH' then 'SUPPLIER' else 'NAQL365' end,'APPROVED-CONTRACT:'||o.contract_id::text,auth.uid()); end if;
end $$;

alter table private.store_product_market_listings add column approved_media jsonb not null default '[]'
 check(jsonb_typeof(approved_media)='array' and jsonb_array_length(approved_media)<=5);
create function public.store_shop_v1(p_country text,p_kind text default 'products',p_after text default null,p_search text default '',p_slug text default null,p_category text default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb; items jsonb; begin
 r=public.store_catalog_public_v1(p_country,p_kind,p_after,20,p_search,p_slug);
 if p_kind='products' and r->>'status'='AVAILABLE' then
  if p_category is not null and p_category !~ '^[a-z0-9][a-z0-9-]{0,99}$' then raise exception 'Invalid category' using errcode='22023'; end if;
  with candidates as (
   select p.slug,jsonb_build_object('slug',p.slug,'listingId',l.id,'revision',l.revision,'media',l.approved_media,'category',cat.slug,'content',l.published_content,'amountMinor',price.amount_minor,'currency','EGP') item
   from private.store_products p join private.store_product_market_listings l on l.product_id=p.id and l.organization_id=p.organization_id
   join private.store_categories cat on cat.id=l.published_category_id and cat.organization_id=l.organization_id
   join private.store_market_prices price on price.id=l.selected_price_id and price.organization_id=l.organization_id
   where private.store_listing_eligible(l.organization_id,l.id) and (p_slug is null or p.slug=p_slug) and (p_after is null or p.slug>p_after)
   and (p_category is null or cat.slug=p_category) and (p_search='' or position(lower(p_search) in lower((l.published_content->>'title_ar')||' '||(l.published_content->>'title_en')))>0)
   order by p.slug limit 21
  ), page as (select * from candidates order by slug limit 20)
  select jsonb_build_object('status','AVAILABLE','items',coalesce((select jsonb_agg(item order by slug) from page),'[]'),
   'nextCursor',case when (select count(*) from candidates)>20 then (select max(slug) from page) else null end) into r;
 end if;
 return r;
end $$;

create function public.store_purchase_read_v1(p_country text,p_kind text,p_target uuid default null,p_after uuid default null,p_limit integer default 20)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s private.store_policy_versions; o private.store_orders; cart private.store_carts; cid uuid; staff boolean=false; finance boolean=false; costs boolean=false; r jsonb; items jsonb; cursor uuid;
begin
 if p_country is distinct from 'EG' or auth.uid() is null then raise exception 'Store access denied' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 30 or p_kind not in ('cart','orders','order','admin','finance','reconciliation') then raise exception 'Invalid Store page' using errcode='22023'; end if;
 if p_kind='cart' then s=private.store_scope();
 else
  select organization_id into s.organization_id from public.organization_memberships where profile_id=auth.uid() and status='active';
  select id into s.market_id from public.markets where organization_id=s.organization_id and country_code='EG' and currency='EGP' and active;
 end if;
 select id into cid from public.customers where organization_id=s.organization_id and profile_id=auth.uid() and identity_kind='ACCOUNT';
 staff=p_kind in ('admin','finance','reconciliation');
 if p_kind='order' then
  select * into o from private.store_orders where id=p_target and organization_id=s.organization_id and market_id=s.market_id;
  if o.id is null then raise exception 'Store order unavailable' using errcode='42501'; end if;
  staff=cid is null or cid<>o.customer_id;
 end if;
 if staff then
  finance=p_kind in ('finance','reconciliation') or (private.has_permission(s.organization_id,'store.payments.read') and private.has_permission(s.organization_id,'finance.read'));
  perform private.store_purchase_actor(s.organization_id,s.market_id,case when p_kind='reconciliation' or (p_kind='order' and not private.has_permission(s.organization_id,'store.orders.read') and not finance and private.has_permission(s.organization_id,'store.settlements.manage') and private.has_permission(s.organization_id,'store.supplier_cost.read') and private.has_permission(s.organization_id,'finance.read')) then 'store.settlements.manage' when finance then 'store.payments.read' else 'store.orders.read' end);
  if finance and not private.has_permission(s.organization_id,'finance.read') then raise exception 'Store Finance read required' using errcode='42501'; end if;
  costs=private.has_permission(s.organization_id,'store.supplier_cost.read');
  if p_kind='reconciliation' and not costs then raise exception 'Store cost access required' using errcode='42501'; end if;
 else perform private.store_purchase_actor(s.organization_id,s.market_id,null,case when p_kind='order' then o.customer_id else cid end); end if;
 if p_kind='cart' then
  select * into cart from private.store_carts where organization_id=s.organization_id and market_id=s.market_id and customer_id=cid;
  select coalesce(jsonb_agg(jsonb_build_object('listingId',l.id,'revision',l.revision,'savedRevision',i.value->'revision','quantity',i.value->'quantity','content',l.published_content,'amountMinor',r.amount_minor,'available',private.store_listing_eligible(s.organization_id,l.id),'slug',p.slug) order by p.slug),'[]') into items
   from jsonb_array_elements(coalesce(cart.items,'[]')) i join private.store_product_market_listings l on l.id=(i.value->>'listingId')::uuid and l.organization_id=s.organization_id and l.market_id=s.market_id
   join private.store_market_prices r on r.id=l.selected_price_id join private.store_products p on p.id=l.product_id;
  return jsonb_build_object('revision',coalesce(cart.revision,0),'items',items,'checkedOutOrderId',cart.checked_out_order_id,
   'contracts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'revision',c.revision,'regions',c.regions,'deliveryMinor',c.delivery_minor,'taxMode',c.tax_mode,'taxBps',c.tax_bps,'taxDelivery',c.tax_delivery,'destinationIds',to_jsonb(c.destination_ids),'codRelease',c.cod_release,'termsAr',c.terms_ar,'termsEn',c.terms_en)) from (select * from private.store_checkout_contracts c where c.organization_id=s.organization_id and c.market_id=s.market_id and c.status='APPROVED' and c.effective_from<=now() and (c.effective_until is null or c.effective_until>now()) order by c.created_at desc,c.id limit 30) c),'[]'),
   'destinations',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'channel',b.destination_type,'labelAr',b.bank_name_ar,'labelEn',b.bank_name_en)) from (select * from public.bank_accounts b where b.organization_id=s.organization_id and b.market_id=s.market_id and b.active and b.currency='EGP' and b.destination_type in ('VODAFONE_CASH','INSTAPAY') and exists(select 1 from private.store_checkout_contracts c where c.organization_id=b.organization_id and c.market_id=b.market_id and c.status='APPROVED' and b.id=any(c.destination_ids) and c.effective_from<=now() and (c.effective_until is null or c.effective_until>now())) order by b.id limit 30) b),'[]'));
 end if;
 if p_kind='order' then
  select jsonb_build_object('id',x.id,'reference',x.reference,'revision',x.revision,'orderState',x.order_state,'fulfillmentState',x.fulfillment_state,'createdAt',x.created_at,'address',x.address,
   'subtotalMinor',x.subtotal_minor,'deliveryMinor',x.delivery_minor,'taxMinor',x.tax_minor,'totalMinor',x.total_minor,'currency','EGP',
   'termsAr',x.contract_snapshot->'terms_ar','termsEn',x.contract_snapshot->'terms_en',
   'items',coalesce((select jsonb_agg(jsonb_build_object('content',i.product_snapshot,'quantity',i.quantity,'unitPriceMinor',i.unit_price_minor) order by i.id) from private.store_order_items i where i.order_id=x.id),'[]'),
   'payment',jsonb_build_object('method',p.method,'status',p.status,'collector',p.collector,'destination',case when not staff or finance then p.destination_snapshot else null end),
   'proofs',case when not staff or finance then coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'status',f.status,'customerReference',f.customer_reference,'submittedAt',f.submitted_at) order by f.created_at desc) from (select * from private.store_payment_proofs where payment_id=p.id order by created_at desc limit 20) f),'[]') else '[]'::jsonb end,
   'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'at',e.occurred_at) order by e.occurred_at) from (select * from private.store_purchase_events where order_id=x.id order by occurred_at desc limit 50) e),'[]'),
   'moneyOperations',case when staff and costs and private.has_permission(s.organization_id,'store.settlements.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'state',m.state,'amountMinor',m.amount_minor,'reference',m.reference)) from (select * from private.store_money_operations m where m.order_id=x.id order by m.created_at desc,m.id limit 100) m),'[]') else '[]'::jsonb end,
   'entries',case when staff and costs and private.has_permission(s.organization_id,'store.settlements.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'holder',e.holder,'amountMinor',e.amount_minor,'reversesId',e.reverses_id)) from (select * from private.store_money_entries e where e.order_id=x.id order by e.created_at desc,e.id limit 100) e),'[]') else '[]'::jsonb end)
   ||case when staff and costs then jsonb_build_object('supplierEntitlementMinor',x.supplier_entitlement_minor) else '{}'::jsonb end into r
   from private.store_orders x join private.store_payments p on p.order_id=x.id where x.id=o.id;
  return r||jsonb_build_object('permissions',case when staff then jsonb_build_object('orders',private.has_permission(s.organization_id,'store.orders.manage'),'fulfillment',private.has_permission(s.organization_id,'store.fulfillment.manage'),
   'verify',private.has_permission(s.organization_id,'store.payments.verify') and private.has_permission(s.organization_id,'finance.verify'),'settle',costs and private.has_permission(s.organization_id,'store.settlements.manage') and private.has_permission(s.organization_id,'finance.verify')) else '{}'::jsonb end);
 end if;
 with candidates as (select x.*,p.method,p.status payment_status from private.store_orders x join private.store_payments p on p.order_id=x.id
  where x.organization_id=s.organization_id and x.market_id=s.market_id and (staff or x.customer_id=cid) and (p_after is null or x.id>p_after) order by x.id limit p_limit+1),
 page as (select * from candidates order by id limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'reference',reference,'orderState',order_state,'fulfillmentState',fulfillment_state,'paymentStatus',payment_status,'method',method,'totalMinor',total_minor,'currency','EGP','createdAt',created_at) order by id) from page),'[]'),
  'nextCursor',case when (select count(*) from candidates)>p_limit then (select id from page order by id desc limit 1) end) into r;
 return r;
end $$;

-- Purpose-specific bucket. No public files, generic files.read or Transport proof access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('store-proofs','store-proofs',false,2097152,array['image/png','application/pdf']);
create function private.store_proof_access(p_path text,p_write boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare f private.store_payment_proofs; p private.store_payments; o private.store_orders; begin
 select * into f from private.store_payment_proofs where object_path=p_path;
 select * into p from private.store_payments where id=f.payment_id;
 select * into o from private.store_orders where id=p.order_id;
 if f.id is null or auth.uid() is null then return false; end if;
 begin
  if exists(select 1 from public.customers where id=o.customer_id and organization_id=o.organization_id and profile_id=auth.uid()) then
   perform private.store_purchase_actor(o.organization_id,o.market_id,null,o.customer_id);
   return not p_write or (f.status='RESERVED' and f.created_at>now()-interval '20 minutes' and p.status in ('PENDING','REJECTED') and o.order_state not in ('CANCELLED','RETURNED'));
  end if;
  if p_write then return false; end if;
  perform private.store_purchase_actor(o.organization_id,o.market_id,'store.payments.read');
  return private.has_permission(o.organization_id,'finance.read') and f.status<>'RESERVED';
 exception when insufficient_privilege then return false; end;
end $$;
create function private.store_proof_upload(p_path text,p_metadata jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare f private.store_payment_proofs; begin
 select * into f from private.store_payment_proofs where object_path=p_path;
 if f.id is null then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 return storage.allow_only_operation('object.upload') and private.store_proof_access(p_path,true) and p_metadata->>'mimetype'=f.mime and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size_bytes;
end $$;
create policy store_proof_select on storage.objects for select to authenticated using(bucket_id='store-proofs' and private.store_proof_access(name));
create policy store_proof_insert on storage.objects for insert to authenticated with check(bucket_id='store-proofs' and private.store_proof_upload(name,metadata));
create function public.store_proof_path_v1(p_proof uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f private.store_payment_proofs; begin
 select * into f from private.store_payment_proofs where id=p_proof;
 if f.id is null or not private.store_proof_access(f.object_path) then raise exception 'Store evidence unavailable' using errcode='42501'; end if;
 return jsonb_build_object('path',f.object_path,'mime',f.mime);
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname in ('store_purchase_actor','store_purchase_guard','store_recognize','store_proof_access','store_proof_upload') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 end loop;
end $$;
-- Storage policies require only these non-data-returning helpers, never private relations.
grant execute on function private.store_proof_access(text,boolean),private.store_proof_upload(text,jsonb) to authenticated;
revoke all on function public.store_purchase_command_v1(text,text,uuid,bigint,uuid,jsonb),public.store_purchase_read_v1(text,text,uuid,uuid,integer),public.store_proof_path_v1(uuid),public.store_shop_v1(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.store_purchase_command_v1(text,text,uuid,bigint,uuid,jsonb),public.store_purchase_read_v1(text,text,uuid,uuid,integer),public.store_proof_path_v1(uuid) to authenticated;
grant execute on function public.store_shop_v1(text,text,text,text,text,text) to anon,authenticated;

-- Keep nullable create targets in SQL; generated clients omit default arguments.
create function public.store_catalog_ui_command_v1(p_country text,p_family text,p_operation text,p_mutation uuid,p_payload jsonb,p_target uuid default null,p_expected bigint default null)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions; begin
 if p_country is distinct from 'EG' then raise exception 'Store market denied' using errcode='42501'; end if;
 s=private.store_scope();
 if p_family='draft' then return public.store_catalog_draft_command_v1(s.organization_id,s.market_id,p_operation,p_mutation,p_target,p_expected,p_payload);
 elsif p_family='publication' then return public.store_catalog_publication_command_v1(s.organization_id,s.market_id,p_operation,p_mutation,p_target,p_expected,p_payload);
 else raise exception 'Unsupported catalog family' using errcode='22023'; end if;
end $$;
revoke all on function public.store_catalog_ui_command_v1(text,text,text,uuid,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.store_catalog_ui_command_v1(text,text,text,uuid,jsonb,uuid,bigint) to authenticated;
