-- Store intake, customer consent and collection use the existing order, payment and receipt ledger.
alter table private.store_payments drop constraint store_payments_method_check;
alter table private.store_payments add constraint store_payments_method_check check (method in ('CASH','VODAFONE_CASH','INSTAPAY','BANK_TRANSFER'));
alter table private.manual_collection_receipts drop constraint collection_domain_target;
alter table private.manual_collection_receipts add constraint collection_domain_target check(
 (domain='TRANSPORT' and transport_payment_id is not null and attempt_id is not null and store_payment_id is null and store_proof_id is null) or
 (domain='STORE' and transport_payment_id is null and attempt_id is null and store_payment_id is not null and currency='EGP'
   and ((channel in ('VODAFONE_CASH','INSTAPAY') and store_proof_id is not null) or (channel='BANK' and store_proof_id is null))));

create or replace function private.store_purchase_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or tg_table_name in ('store_order_items','store_purchase_events','store_purchase_receipts','store_money_entries') then
  raise exception 'Store immutable history' using errcode='55000'; end if;
 if tg_table_name='store_checkout_contracts' then
  if old.status<>'DRAFT' and (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
   raise exception 'Store approved contract immutable' using errcode='55000'; end if;
  if old.status<>'DRAFT' and new.status<>'REVOKED' then raise exception 'Store contract retained' using errcode='55000'; end if;
 end if;
 if tg_table_name='store_orders' then
  if old.guest_request_id is not null and old.order_state='PLACED' and new.order_state='PLACED'
    and (to_jsonb(new)-array['delivery_minor','tax_minor','total_minor','supplier_entitlement_minor','revision'])
      = (to_jsonb(old)-array['delivery_minor','tax_minor','total_minor','supplier_entitlement_minor','revision']) then return new; end if;
  if (to_jsonb(new)-array['order_state','fulfillment_state','revision']) is distinct from (to_jsonb(old)-array['order_state','fulfillment_state','revision']) then
  raise exception 'Store commercial snapshot immutable' using errcode='55000'; end if;
 end if;
 return new;
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
    if o.guest_payment_method='BANK_TRANSFER' then
     select * into bank from public.bank_accounts where id=any(c.destination_ids) and organization_id=o.organization_id
      and market_id=o.market_id and currency='EGP' and active and destination_type='BANK' order by id limit 1 for share;
     if bank.id is null then raise exception 'Approved bank unavailable' using errcode='PT409'; end if;
    elsif o.guest_payment_method is distinct from 'CASH' or not c.cod_release then
     raise exception 'Collection method unavailable' using errcode='PT409';
    end if;
    insert into private.store_payments(organization_id,market_id,order_id,currency,amount_minor,method,collector,destination_id,destination_snapshot,status)
     values(o.organization_id,o.market_id,o.id,'EGP',o.total_minor,o.guest_payment_method,
      case when bank.id is null then 'SUPPLIER' else 'NAQL365' end,bank.id,
      case when bank.id is not null then jsonb_build_object('channel','BANK','beneficiaryAr',bank.beneficiary_ar,'beneficiaryEn',bank.beneficiary_en,
       'accountNumber',bank.account_number,'bankAr',bank.bank_name_ar,'bankEn',bank.bank_name_en) end,
      case when bank.id is null then 'CASH_DUE' else 'PENDING' end);
    update private.store_orders set order_state='ACCEPTED' where id=o.id;
   end if;
  elsif p_action='verify_bank' then
   if pay.id is null or pay.method<>'BANK_TRANSFER' or pay.status<>'PENDING' or o.order_state<>'ACCEPTED' then
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
   if exists(select 1 from public.bank_transfer_attempts h where h.state='CONFIRMED' and coalesce(h.bank_snapshot->>'destinationType','BANK')='BANK'
     and upper(regexp_replace(h.bank_reference,'[^A-Za-z0-9]','','g'))=normalized) then raise exception 'Receipt already credited' using errcode='23505'; end if;
   insert into private.manual_collection_receipts(organization_id,market_id,domain,channel,external_identity,store_payment_id,amount_minor,currency,verified_by)
    values(o.organization_id,o.market_id,'STORE','BANK',normalized,pay.id,pay.amount_minor,'EGP',auth.uid());
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

create or replace function public.store_purchase_read_v1(p_country text,p_kind text,p_target uuid default null,p_after uuid default null,p_limit integer default 20)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s private.store_policy_versions; o private.store_orders; cart private.store_carts; cid uuid; staff boolean=false; finance boolean=false; costs boolean=false; r jsonb; items jsonb; cursor uuid;
begin
 if p_country is distinct from 'EG' or auth.uid() is null then raise exception 'Store access denied' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 30 or p_kind not in ('cart','orders','order','admin','finance','reconciliation','staff_directory') then raise exception 'Invalid Store page' using errcode='22023'; end if;
 if p_kind='cart' then s=private.store_scope();
 else
  select organization_id into s.organization_id from public.organization_memberships where profile_id=auth.uid() and status='active';
  select id into s.market_id from public.markets where organization_id=s.organization_id and country_code='EG' and currency='EGP' and active;
 end if;
 if p_kind='staff_directory' then
  perform private.store_purchase_actor(s.organization_id,s.market_id,'users.manage');
  with candidates as (
   select m.profile_id id,p.display_name,m.status
   from public.organization_memberships m join public.profiles p on p.id=m.profile_id
   where m.organization_id=s.organization_id and m.member_type='staff' and (p_after is null or m.profile_id>p_after)
   order by m.profile_id limit p_limit+1
  ), page as (select * from candidates order by id limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name,'status',x.status,
   'roles',coalesce((select jsonb_agg(ro.code order by ro.code) from public.user_roles ur join public.roles ro on ro.id=ur.role_id and ro.member_type='staff'
    where ur.organization_id=s.organization_id and ur.profile_id=x.id),'[]'::jsonb)) order by x.id) from page x),'[]'::jsonb),
   'nextCursor',case when (select count(*) from candidates)>p_limit then (select id from page order by id desc limit 1) end) into r;
  return r;
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
  select jsonb_build_object('id',x.id,'reference',x.reference,'revision',x.revision,'orderState',x.order_state,'fulfillmentState',x.fulfillment_state,'createdAt',x.created_at,'guestCheckout',x.guest_request_id is not null,'address',x.address,
   'subtotalMinor',x.subtotal_minor,'deliveryMinor',x.delivery_minor,'taxMinor',x.tax_minor,'totalMinor',x.total_minor,'currency','EGP',
   'termsAr',x.contract_snapshot->'terms_ar','termsEn',x.contract_snapshot->'terms_en',
   'items',coalesce((select jsonb_agg(jsonb_build_object('content',i.product_snapshot,'quantity',i.quantity,'unitPriceMinor',i.unit_price_minor) order by i.id) from private.store_order_items i where i.order_id=x.id),'[]'),
   'payment',jsonb_build_object('method',coalesce(p.method,x.guest_payment_method),'status',coalesce(p.status,'AWAITING_CONFIRMATION'),'collector',p.collector,'destination',case when not staff or finance then p.destination_snapshot else null end),
   'proofs',case when not staff or finance then coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'status',f.status,'customerReference',f.customer_reference,'submittedAt',f.submitted_at) order by f.created_at desc) from (select * from private.store_payment_proofs where payment_id=p.id order by created_at desc limit 20) f),'[]') else '[]'::jsonb end,
   'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'at',e.occurred_at) order by e.occurred_at) from (select * from private.store_purchase_events where order_id=x.id order by occurred_at desc limit 50) e),'[]'),
   'moneyOperations',case when staff and costs and private.has_permission(s.organization_id,'store.settlements.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'state',m.state,'amountMinor',m.amount_minor,'reference',m.reference)) from (select * from private.store_money_operations m where m.order_id=x.id order by m.created_at desc,m.id limit 100) m),'[]') else '[]'::jsonb end,
   'entries',case when staff and costs and private.has_permission(s.organization_id,'store.settlements.manage') then coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'holder',e.holder,'amountMinor',e.amount_minor,'reversesId',e.reverses_id)) from (select * from private.store_money_entries e where e.order_id=x.id order by e.created_at desc,e.id limit 100) e),'[]') else '[]'::jsonb end)
   ||case when staff and costs then jsonb_build_object('supplierEntitlementMinor',x.supplier_entitlement_minor) else '{}'::jsonb end into r
   from private.store_orders x left join private.store_payments p on p.order_id=x.id where x.id=o.id;
  return r||jsonb_build_object('permissions',case when staff then jsonb_build_object('orders',private.has_permission(s.organization_id,'store.orders.manage'),'fulfillment',private.has_permission(s.organization_id,'store.fulfillment.manage'),
   'verify',private.has_permission(s.organization_id,'store.payments.verify') and private.has_permission(s.organization_id,'finance.verify'),'settle',costs and private.has_permission(s.organization_id,'store.settlements.manage') and private.has_permission(s.organization_id,'finance.verify')) else '{}'::jsonb end);
 end if;
 with candidates as (select x.*,coalesce(p.method,x.guest_payment_method) method,coalesce(p.status,'AWAITING_CONFIRMATION') payment_status from private.store_orders x left join private.store_payments p on p.order_id=x.id
  where x.organization_id=s.organization_id and x.market_id=s.market_id and (staff or x.customer_id=cid) and (p_after is null or x.id>p_after) order by x.id limit p_limit+1),
 page as (select * from candidates order by id limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'reference',reference,'orderState',order_state,'fulfillmentState',fulfillment_state,'paymentStatus',payment_status,'method',method,'totalMinor',total_minor,'currency','EGP','createdAt',created_at) order by id) from page),'[]'),
  'nextCursor',case when (select count(*) from candidates)>p_limit then (select id from page order by id desc limit 1) end) into r;
 return r;
end $$;
