-- Extend the existing privileged transfer configuration; no financial configuration data.
alter table public.bank_accounts add column destination_type text not null default 'BANK'
 check(destination_type in ('BANK','VODAFONE_CASH','INSTAPAY'));
create function private.guard_transfer_destination() returns trigger language plpgsql set search_path='' as $$
begin
 if new.destination_type<>'BANK' and (new.currency<>'EGP' or not exists(select 1 from public.markets m where m.id=new.market_id and m.organization_id=new.organization_id and m.country_code='EG') or new.account_number is null or new.iban is not null or new.bic is not null)
 then raise exception 'Egypt transfer destination required' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.guard_transfer_destination() from public,anon,authenticated;
create trigger transfer_destination_guard before insert or update on public.bank_accounts for each row execute function private.guard_transfer_destination();
alter table public.payments add column bank_account_id uuid,
 add constraint payment_destination_scope foreign key(organization_id,market_id,bank_account_id) references public.bank_accounts(organization_id,market_id,id),
 add constraint payment_destination_method check(bank_account_id is null or method='BANK_TRANSFER');
-- Historical payments and evidence are not rewritten. Null selection retains the legacy primary behavior.
create or replace function private.payment_bank_snapshot(b public.bank_accounts) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('destinationType',b.destination_type,'id',b.id,'revision',b.revision,'currency',b.currency,'bankNameAr',b.bank_name_ar,'bankNameEn',b.bank_name_en,'beneficiaryAr',b.beneficiary_ar,'beneficiaryEn',b.beneficiary_en,'iban',b.iban,'accountNumber',b.account_number,'bic',b.bic,'instructionsAr',b.instructions_ar,'instructionsEn',b.instructions_en)
$$;
create or replace function public.configure_bank_account(p_org uuid,p_market uuid,p_id uuid,p_revision integer,p_mutation uuid,p_details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bank_accounts;m public.markets;prior private.payment_mutations;intent jsonb;result jsonb;
begin
 if not private.has_permission(p_org,'finance.accounts.manage') then raise exception 'Bank configuration permission required' using errcode='42501'; end if;
 if p_id is null or p_mutation is null or p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>8192 or
 (p_details-array['bankNameAr','bankNameEn','beneficiaryAr','beneficiaryEn','iban','accountNumber','bic','instructionsAr','instructionsEn','active','primary','destinationType'])<>'{}'::jsonb then raise exception 'Invalid account configuration' using errcode='22023'; end if;
 if not private.text_fields(p_details,array['bankNameAr','bankNameEn','beneficiaryAr','beneficiaryEn','iban','accountNumber','bic','instructionsAr','instructionsEn']) then raise exception 'Invalid account text' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,33));
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,34));
 select * into m from public.markets where id=p_market and organization_id=p_org and active;
 if not found then raise exception 'Active Market required' using errcode='42501'; end if;
 intent=jsonb_build_object('bankId',p_id,'market',p_market,'revision',p_revision,'details',p_details);
 select * into prior from private.payment_mutations where actor_id=auth.uid() and mutation_id=p_mutation;
 if found then if prior.organization_id<>p_org or prior.intent<>intent then raise exception 'Mutation identity reused' using errcode='22023'; end if;return prior.result;end if;
 select * into b from public.bank_accounts where id=p_id for update;
 if found then
  if b.organization_id<>p_org or b.market_id<>p_market then raise exception 'Bank account scope mismatch' using errcode='42501'; end if;
  if b.revision is distinct from p_revision then raise exception 'Bank account changed' using errcode='40001'; end if;
 else
  if p_revision is distinct from 0 then raise exception 'Bank account revision invalid' using errcode='40001'; end if;
 end if;
 if jsonb_typeof(p_details->'active') is distinct from 'boolean' or jsonb_typeof(p_details->'primary') is distinct from 'boolean' then raise exception 'Account flags required' using errcode='22023'; end if;
 insert into public.bank_accounts(id,organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,iban,account_number,bic,instructions_ar,instructions_en,active,is_primary,created_by,destination_type)
 values(p_id,p_org,p_market,m.currency,p_details->>'bankNameAr',p_details->>'bankNameEn',p_details->>'beneficiaryAr',p_details->>'beneficiaryEn',nullif(p_details->>'iban',''),nullif(p_details->>'accountNumber',''),nullif(p_details->>'bic',''),coalesce(p_details->>'instructionsAr',''),coalesce(p_details->>'instructionsEn',''),(p_details->>'active')::boolean,(p_details->>'primary')::boolean,auth.uid(),coalesce(p_details->>'destinationType','BANK'))
 on conflict(id) do update set destination_type=excluded.destination_type,bank_name_ar=excluded.bank_name_ar,bank_name_en=excluded.bank_name_en,beneficiary_ar=excluded.beneficiary_ar,beneficiary_en=excluded.beneficiary_en,iban=excluded.iban,account_number=excluded.account_number,bic=excluded.bic,instructions_ar=excluded.instructions_ar,instructions_en=excluded.instructions_en,active=excluded.active,is_primary=excluded.is_primary,revision=bank_accounts.revision+1 returning * into b;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p_org,auth.uid(),'BANK_ACCOUNT_CONFIGURED','bank_accounts',b.id,jsonb_build_object('market_id',p_market,'revision',b.revision,'active',b.active));
 result=jsonb_build_object('id',b.id,'revision',b.revision);
 insert into private.payment_mutations values(auth.uid(),p_mutation,p_org,intent,result,now());return result;
end $$;
revoke all on function public.configure_bank_account(uuid,uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.configure_bank_account(uuid,uuid,uuid,integer,uuid,jsonb) to authenticated;

create or replace function public.payment_command(p_order uuid,p_action text,p_mutation uuid,p_revision integer,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare guest private.guest_access_grants; actor uuid=auth.uid(); o public.orders;p public.payments;a public.bank_transfer_attempts;b public.bank_accounts;f public.file_objects;
 prior private.payment_mutations;intent jsonb;result jsonb;customer_action boolean;chosen text;event_code text;why text;confirmed bigint;
begin
 if auth.uid() is null then
  guest=private.lock_guest_context(); actor=guest.id;
  perform private.consume_guest_budget(guest.organization_id,case when p_action='reserve' then 'upload' else 'mutation' end,guest.id,60,p_action='reserve');
 end if;
 if p_mutation is null or p_order is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 then raise exception 'Invalid payment command' using errcode='22023'; end if;
 select * into o from public.orders where id=p_order;
 if not found then raise exception 'Order unavailable' using errcode='42501'; end if;
 -- Same order as operations_command: actor replay lock before shared organization lock.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_mutation::text,33));
 perform pg_advisory_xact_lock(hashtextextended(o.organization_id::text,34));
 select * into o from public.orders where id=p_order for update;
 customer_action=p_action in ('choose','reserve','submit','remove','finish_remove');
 if customer_action then
  if not private.customer_request_access(o.organization_id,o.customer_id,o.request_id) then raise exception 'Customer payment access denied' using errcode='42501'; end if;
 else
  if p_action not in ('confirm_transfer','reject_transfer','confirm_cash') or not private.has_permission(o.organization_id,'finance.verify') then raise exception 'Finance permission required' using errcode='42501'; end if;
 end if;
 if o.accepted_at is null or not exists(select 1 from public.quote_versions v where v.id=o.accepted_quote_version_id and v.status='ACCEPTED') then raise exception 'Accepted Order required' using errcode='55000'; end if;
 intent=jsonb_build_object('order',p_order,'action',p_action,'revision',p_revision,'payload',p_payload);
 select * into prior from private.payment_mutations where actor_id=actor and mutation_id=p_mutation;
 if found then
  if prior.intent<>intent or prior.organization_id<>o.organization_id then raise exception 'Mutation identity reused' using errcode='22023'; end if;
  return prior.result;
 end if;
 select * into p from public.payments where order_id=o.id and organization_id=o.organization_id for update;
 if not found then
  if p_action<>'choose' or p_revision is distinct from 0 then raise exception 'Select payment method first' using errcode='55000'; end if;
  insert into public.payments(organization_id,order_id,market_id,customer_id,currency,amount_minor) values(o.organization_id,o.id,o.market_id,o.customer_id,o.currency,o.total_minor) returning * into p;
 end if;
 if p_revision is distinct from p.revision then raise exception 'Payment changed' using errcode='40001'; end if;
 if p.status='PAID' then raise exception 'Payment already confirmed' using errcode='55000'; end if;
 if p_action='choose' then
  if (p_payload-array['method','destinationId'])<>'{}'::jsonb or p_payload->>'method' is null or p_payload->>'method' not in ('CASH','BANK_TRANSFER') then raise exception 'Unsupported method' using errcode='22023'; end if;
  chosen=p_payload->>'method';
  if chosen='CASH' and p_payload ? 'destinationId' then raise exception 'Cash has no transfer destination' using errcode='22023'; end if;
  if chosen='BANK_TRANSFER' then
   select * into b from public.bank_accounts where organization_id=p.organization_id and market_id=p.market_id and currency=p.currency and active
    and (case when p_payload ? 'destinationId' then id=(p_payload->>'destinationId')::uuid else is_primary end);
   if b.id is null then raise exception 'Bank instructions unavailable' using errcode='55000'; end if;
  end if;
  if p.method is distinct from chosen or p.bank_account_id is distinct from b.id then
   if exists(select 1 from public.bank_transfer_attempts where payment_id=p.id) or (p.method is not null and exists(select 1 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id and t.started_at is not null))
   then raise exception 'Payment method frozen' using errcode='55000'; end if;
   update public.payments set bank_account_id=b.id,method=chosen,status=case chosen when 'CASH' then 'CASH_DUE' else 'AWAITING_TRANSFER_PROOF' end,revision=revision+1 where id=p.id returning * into p;
   perform private.payment_event(p,'METHOD_SELECTED',p_mutation);
  end if;
 elsif p_action='reserve' then
  if (p_payload-array['fileId','mime','size'])<>'{}'::jsonb or p_payload->>'fileId' is null or p_payload->>'mime' is null or p_payload->>'mime' not in ('application/pdf','image/jpeg','image/png') or jsonb_typeof(p_payload->'size') is distinct from 'number' or (p_payload->>'size')::integer not between 1 and 3145728 then raise exception 'Invalid proof metadata' using errcode='22023'; end if;
  if p.method<>'BANK_TRANSFER' or p.status not in ('AWAITING_TRANSFER_PROOF','TRANSFER_REJECTED') then raise exception 'Proof unavailable' using errcode='55000'; end if;
  select * into b from public.bank_accounts where organization_id=p.organization_id and market_id=p.market_id and currency=p.currency and active and (case when p.bank_account_id is null then is_primary else id=p.bank_account_id end);
  if not found then raise exception 'Bank instructions unavailable' using errcode='55000'; end if;
  insert into public.file_objects(id,organization_id,owner_profile_id,guest_customer_id,bucket_id,purpose,upload_state,mime_type,size_bytes)
  values((p_payload->>'fileId')::uuid,p.organization_id,auth.uid(),case when auth.uid() is null then p.customer_id end,'documents','TRANSFER_PROOF','pending',p_payload->>'mime',(p_payload->>'size')::integer) returning * into f;
  insert into public.bank_transfer_attempts(organization_id,market_id,payment_id,attempt_number,file_id,bank_account_id,bank_snapshot,submitted_by,guest_customer_id,guest_grant_id)
  select p.organization_id,p.market_id,p.id,coalesce(max(attempt_number),0)+1,f.id,b.id,private.payment_bank_snapshot(b),auth.uid(),case when auth.uid() is null then p.customer_id end,guest.id from public.bank_transfer_attempts where payment_id=p.id returning * into a;
  update public.payments set revision=revision+1 where id=p.id returning * into p;
 elsif p_action in ('submit','remove','finish_remove') then
  if (p_payload-array['attemptId'])<>'{}'::jsonb or p_payload->>'attemptId' is null then raise exception 'Attempt required' using errcode='22023'; end if;
  select * into a from public.bank_transfer_attempts where id=(p_payload->>'attemptId')::uuid and payment_id=p.id for update;
  if not found or a.submitted_by is distinct from auth.uid() or (auth.uid() is null and a.guest_customer_id is distinct from o.customer_id) then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  select * into f from public.file_objects where id=a.file_id for update;
  if p_action='submit' then
   if a.state<>'RESERVED' or f.upload_state<>'pending' or not exists(select 1 from storage.objects where bucket_id=f.bucket_id and name=f.object_name and metadata->>'mimetype'=f.mime_type and (metadata->>'size')::bigint=f.size_bytes) then raise exception 'Upload incomplete' using errcode='55000'; end if;
   update public.file_objects set upload_state='ready' where id=f.id;
   update public.bank_transfer_attempts set state='SUBMITTED',submitted_at=now() where id=a.id returning * into a;
   update public.payments set status='UNDER_REVIEW',revision=revision+1 where id=p.id returning * into p;
   perform private.payment_event(p,'PROOF_SUBMITTED',p_mutation,a.id);
  elsif p_action='remove' then
   if a.state not in ('RESERVED','REMOVING') then raise exception 'Submitted evidence is immutable' using errcode='55000'; end if;
   if a.state='RESERVED' then
    update public.bank_transfer_attempts set state='REMOVING' where id=a.id;
    update public.file_objects set upload_state='removing' where id=f.id;
    update public.payments set revision=revision+1 where id=p.id returning * into p;
   end if;
  else
   if a.state<>'REMOVING' or exists(select 1 from storage.objects where bucket_id=f.bucket_id and name=f.object_name) then raise exception 'Remove temporary object first' using errcode='55000'; end if;
   delete from public.bank_transfer_attempts where id=a.id;
   delete from public.file_objects where id=f.id;
   update public.payments set revision=revision+1 where id=p.id returning * into p;
  end if;
 else
  if (p_payload-array['attemptId','amountMinor','currency','reason','reference','note'])<>'{}'::jsonb or length(coalesce(p_payload->>'reference',''))>120 or length(coalesce(p_payload->>'note',''))>500 then raise exception 'Invalid Finance evidence' using errcode='22023'; end if;
  if p_action='confirm_cash' then
   if p.method<>'CASH' or p.status<>'CASH_DUE' or p_payload ? 'attemptId' then raise exception 'Cash due required' using errcode='55000'; end if;
   event_code='CASH_RECEIVED';
  else
   select * into a from public.bank_transfer_attempts where id=(p_payload->>'attemptId')::uuid and payment_id=p.id for update;
   if not found or p.method<>'BANK_TRANSFER' or p.status<>'UNDER_REVIEW' or a.state<>'SUBMITTED' then raise exception 'Submitted current attempt required' using errcode='55000'; end if;
   if p_action='reject_transfer' then
    why=btrim(p_payload->>'reason');if why is null or length(why) not between 1 and 500 then raise exception 'Rejection reason required' using errcode='22023'; end if;
    update public.bank_transfer_attempts set state='REJECTED',reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=why,finance_note=p_payload->>'note',bank_reference=p_payload->>'reference' where id=a.id;
    update public.payments set status='TRANSFER_REJECTED',revision=revision+1 where id=p.id returning * into p;
    event_code='TRANSFER_REJECTED';
   else event_code='TRANSFER_CONFIRMED'; end if;
  end if;
  if p_action<>'reject_transfer' then
   if jsonb_typeof(p_payload->'amountMinor') is distinct from 'number' or (p_payload->>'amountMinor')::numeric<>p.amount_minor or p_payload->>'currency' is distinct from p.currency then raise exception 'Full accepted amount and currency required' using errcode='22023'; end if;
   if p_action='confirm_transfer' then update public.bank_transfer_attempts set state='CONFIRMED',reviewed_at=now(),reviewed_by=auth.uid(),finance_note=p_payload->>'note',bank_reference=p_payload->>'reference' where id=a.id; end if;
   update public.payments set status='PAID',paid_at=now(),confirmed_by=auth.uid(),revision=revision+1 where id=p.id returning * into p;
   perform private.issue_payment_receipt(p);
  end if;
  perform private.payment_event(p,event_code,p_mutation,a.id,p_payload->>'reference',p_payload->>'note');
 end if;
 result=jsonb_build_object('paymentId',p.id,'revision',p.revision,'method',p.method,'status',p.status,'executionAllowed',private.order_payment_cleared(o.id));
 if p_action in ('reserve','remove') then result=result||jsonb_build_object('attemptId',a.id,'fileId',f.id,'path',f.object_name); end if;
 insert into private.payment_mutations values(actor,p_mutation,o.organization_id,intent,result,now());
 return result;
end $$;

create or replace function public.payment_details(p_order uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.orders;p public.payments;b public.bank_accounts;finance boolean;attempts jsonb;receipt jsonb;
begin
 select * into o from public.orders where id=p_order;
 if not found then raise exception 'Order unavailable' using errcode='42501'; end if;
 finance=private.has_permission(o.organization_id,'finance.read');
 if not finance and not private.customer_request_access(o.organization_id,o.customer_id,o.request_id) then raise exception 'Payment access denied' using errcode='42501'; end if;
 if o.accepted_at is null then raise exception 'Accepted Order required' using errcode='55000'; end if;
 select * into p from public.payments where order_id=o.id;
 select * into b from public.bank_accounts where organization_id=o.organization_id and market_id=o.market_id and currency=o.currency and active and (case when p.bank_account_id is null then is_primary else id=p.bank_account_id end);
 select coalesce(jsonb_agg(item order by n desc),'[]') into attempts from (
  select a.attempt_number n,jsonb_build_object('id',a.id,'number',a.attempt_number,'state',a.state,'fileId',a.file_id,'mime',f.mime_type,'submittedAt',a.submitted_at,'reviewedAt',a.reviewed_at,'rejectionReason',a.rejection_reason,'bank',a.bank_snapshot)||
  case when finance then jsonb_build_object('reviewer',a.reviewed_by,'financeNote',a.finance_note,'reference',a.bank_reference) else '{}' end item
  from public.bank_transfer_attempts a join public.file_objects f on f.id=a.file_id where a.payment_id=p.id order by a.attempt_number desc limit 20
 ) rows;
 select jsonb_build_object('id',i.id,'reference',i.reference,'issuedAt',i.issued_at,'kind',i.kind) into receipt from public.invoices i where payment_id=p.id and kind='PAYMENT_RECEIPT';
 return jsonb_build_object('orderId',o.id,'organizationId',o.organization_id,'reference',o.reference,'marketId',o.market_id,'country',(select country_code from public.markets where id=o.market_id),'timezone',(select timezone from public.markets where id=o.market_id),'currency',o.currency,'subtotalMinor',o.subtotal_minor,'taxMinor',o.vat_amount_minor,'totalMinor',o.total_minor,'taxLabelAr',o.tax_label_ar,'taxLabelEn',o.tax_label_en,
 'paymentId',p.id,'revision',coalesce(p.revision,0),'method',p.method,'status',coalesce(p.status,'PENDING'),'executionAllowed',private.order_payment_cleared(o.id),
 'canSwitch',p.status is distinct from 'PAID' and not exists(select 1 from public.bank_transfer_attempts where payment_id=p.id) and (p.method is null or not exists(select 1 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id and t.started_at is not null)),
 'destinations',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'type',d.destination_type,'nameAr',d.bank_name_ar,'nameEn',d.bank_name_en) order by d.is_primary desc,d.id) from public.bank_accounts d where d.organization_id=o.organization_id and d.market_id=o.market_id and d.currency=o.currency and d.active),'[]'::jsonb),
 'transferAvailable',exists(select 1 from public.bank_accounts d where d.organization_id=o.organization_id and d.market_id=o.market_id and d.currency=o.currency and d.active),'bank',case when p.method='BANK_TRANSFER' and b.id is not null then private.payment_bank_snapshot(b) else null end,'attempts',attempts,'receipt',receipt);
end $$;

