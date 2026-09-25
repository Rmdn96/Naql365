create function private.payment_bank_snapshot(b public.bank_accounts) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',b.id,'revision',b.revision,'currency',b.currency,'bankNameAr',b.bank_name_ar,'bankNameEn',b.bank_name_en,'beneficiaryAr',b.beneficiary_ar,'beneficiaryEn',b.beneficiary_en,'iban',b.iban,'accountNumber',b.account_number,'bic',b.bic,'instructionsAr',b.instructions_ar,'instructionsEn',b.instructions_en)
$$;
create function private.payment_event(p public.payments,p_code text,p_mutation uuid,p_attempt uuid default null,p_reference text default null,p_note text default null) returns void language plpgsql set search_path='' as $$
begin
 insert into public.payment_transactions(organization_id,payment_id,provider,provider_event_id,event_code,actor_id,amount_minor,currency,attempt_id,reference,note)
 values(p.organization_id,p.id,'INTERNAL_MANUAL',auth.uid()::text||':'||p_mutation::text,p_code,auth.uid(),p.amount_minor,p.currency,p_attempt,p_reference,p_note);
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(p.organization_id,auth.uid(),p_code,'payments',p.id,jsonb_build_object('market_id',p.market_id,'state',p.status,'method',p.method,'attempt_id',p_attempt));
end $$;
create function private.issue_payment_receipt(p public.payments) returns void language plpgsql set search_path='' as $$
begin
 if p.status<>'PAID' then raise exception 'Received payment required' using errcode='55000'; end if;
 insert into public.invoices(organization_id,order_id,payment_id,customer_id,market_id,currency,reference,kind,status,subtotal_minor,tax_amount_minor,total_minor,tax_code,tax_rate_bps,tax_label_ar,tax_label_en,issued_at,issued_by)
 select o.organization_id,o.id,p.id,o.customer_id,o.market_id,o.currency,'R-'||o.reference,'PAYMENT_RECEIPT','ISSUED',o.subtotal_minor,o.vat_amount_minor,o.total_minor,o.tax_code,o.tax_rate_bps,o.tax_label_ar,o.tax_label_en,p.paid_at,p.confirmed_by
 from public.orders o where o.id=p.order_id;
end $$;

create function public.payment_command(p_order uuid,p_action text,p_mutation uuid,p_revision integer,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders;p public.payments;a public.bank_transfer_attempts;b public.bank_accounts;f public.file_objects;
 prior private.payment_mutations;intent jsonb;result jsonb;customer_action boolean;chosen text;event_code text;why text;confirmed bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_mutation is null or p_order is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 then raise exception 'Invalid payment command' using errcode='22023'; end if;
 select * into o from public.orders where id=p_order;
 if not found then raise exception 'Order unavailable' using errcode='42501'; end if;
 -- Same order as operations_command: actor replay lock before shared organization lock.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_mutation::text,33));
 perform pg_advisory_xact_lock(hashtextextended(o.organization_id::text,34));
 select * into o from public.orders where id=p_order for update;
 customer_action=p_action in ('choose','reserve','submit','remove','finish_remove');
 if customer_action then
  if not private.owns_customer(o.organization_id,o.customer_id) or not private.has_permission(o.organization_id,'account.access') then raise exception 'Customer payment access denied' using errcode='42501'; end if;
 else
  if p_action not in ('confirm_transfer','reject_transfer','confirm_cash') or not private.has_permission(o.organization_id,'finance.verify') then raise exception 'Finance permission required' using errcode='42501'; end if;
 end if;
 if o.accepted_at is null or not exists(select 1 from public.quote_versions v where v.id=o.accepted_quote_version_id and v.status='ACCEPTED') then raise exception 'Accepted Order required' using errcode='55000'; end if;
 intent=jsonb_build_object('order',p_order,'action',p_action,'revision',p_revision,'payload',p_payload);
 select * into prior from private.payment_mutations where actor_id=auth.uid() and mutation_id=p_mutation;
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
  if (p_payload-array['method'])<>'{}'::jsonb or p_payload->>'method' is null or p_payload->>'method' not in ('CASH','BANK_TRANSFER') then raise exception 'Unsupported method' using errcode='22023'; end if;
  chosen=p_payload->>'method';
  if p.method is distinct from chosen then
   if exists(select 1 from public.bank_transfer_attempts where payment_id=p.id) or (p.method is not null and exists(select 1 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id and t.started_at is not null))
   then raise exception 'Payment method frozen' using errcode='55000'; end if;
   if chosen='BANK_TRANSFER' and not exists(select 1 from public.bank_accounts where organization_id=p.organization_id and market_id=p.market_id and currency=p.currency and active and is_primary) then raise exception 'Bank instructions unavailable' using errcode='55000'; end if;
   update public.payments set method=chosen,status=case chosen when 'CASH' then 'CASH_DUE' else 'AWAITING_TRANSFER_PROOF' end,revision=revision+1 where id=p.id returning * into p;
   perform private.payment_event(p,'METHOD_SELECTED',p_mutation);
  end if;
 elsif p_action='reserve' then
  if (p_payload-array['fileId','mime','size'])<>'{}'::jsonb or p_payload->>'fileId' is null or p_payload->>'mime' is null or p_payload->>'mime' not in ('application/pdf','image/jpeg','image/png') or jsonb_typeof(p_payload->'size') is distinct from 'number' or (p_payload->>'size')::integer not between 1 and 3145728 then raise exception 'Invalid proof metadata' using errcode='22023'; end if;
  if p.method<>'BANK_TRANSFER' or p.status not in ('AWAITING_TRANSFER_PROOF','TRANSFER_REJECTED') then raise exception 'Proof unavailable' using errcode='55000'; end if;
  select * into b from public.bank_accounts where organization_id=p.organization_id and market_id=p.market_id and currency=p.currency and active and is_primary;
  if not found then raise exception 'Bank instructions unavailable' using errcode='55000'; end if;
  insert into public.file_objects(id,organization_id,owner_profile_id,bucket_id,purpose,upload_state,mime_type,size_bytes)
  values((p_payload->>'fileId')::uuid,p.organization_id,auth.uid(),'documents','TRANSFER_PROOF','pending',p_payload->>'mime',(p_payload->>'size')::integer) returning * into f;
  insert into public.bank_transfer_attempts(organization_id,market_id,payment_id,attempt_number,file_id,bank_account_id,bank_snapshot,submitted_by)
  select p.organization_id,p.market_id,p.id,coalesce(max(attempt_number),0)+1,f.id,b.id,private.payment_bank_snapshot(b),auth.uid() from public.bank_transfer_attempts where payment_id=p.id returning * into a;
  update public.payments set revision=revision+1 where id=p.id returning * into p;
 elsif p_action in ('submit','remove','finish_remove') then
  if (p_payload-array['attemptId'])<>'{}'::jsonb or p_payload->>'attemptId' is null then raise exception 'Attempt required' using errcode='22023'; end if;
  select * into a from public.bank_transfer_attempts where id=(p_payload->>'attemptId')::uuid and payment_id=p.id for update;
  if not found or a.submitted_by<>auth.uid() then raise exception 'Attempt unavailable' using errcode='42501'; end if;
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
 insert into private.payment_mutations values(auth.uid(),p_mutation,o.organization_id,intent,result,now());
 return result;
end $$;
revoke all on function private.payment_bank_snapshot(public.bank_accounts),private.payment_event(public.payments,text,uuid,uuid,text,text),private.issue_payment_receipt(public.payments),public.payment_command(uuid,text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.payment_command(uuid,text,uuid,integer,jsonb) to authenticated;

create function private.guard_payment_facts() returns trigger language plpgsql set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=new.order_id and organization_id=new.organization_id;
 if (new.market_id,new.customer_id,new.currency,new.amount_minor) is distinct from (o.market_id,o.customer_id,o.currency,o.total_minor) then raise exception 'Payment must match accepted Order' using errcode='23514'; end if;
 if tg_op='UPDATE' and ((new.organization_id,new.order_id,new.market_id,new.customer_id,new.currency,new.amount_minor) is distinct from (old.organization_id,old.order_id,old.market_id,old.customer_id,old.currency,old.amount_minor) or (old.status='PAID' and new is distinct from old)) then raise exception 'Financial facts immutable' using errcode='55000'; end if;
 return new;
end $$;
create trigger payment_facts_guard before insert or update on public.payments for each row execute function private.guard_payment_facts();
create trigger payment_transaction_immutable before update or delete on public.payment_transactions for each row when(old.event_code is not null) execute function private.protect_operational_history();
create trigger receipt_immutable before update or delete on public.invoices for each row when(old.kind is not null) execute function private.protect_operational_history();

create function private.transfer_history_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' and auth.uid() is null and current_setting('app.fixture_cleanup',true)='on' then return old; end if;
 if tg_op='DELETE' then
  if old.state<>'REMOVING' then raise exception 'Transfer evidence immutable' using errcode='55000'; end if;
  return old;
 end if;
 if (new.organization_id,new.market_id,new.payment_id,new.attempt_number,new.file_id,new.bank_account_id,new.bank_snapshot,new.submitted_by,new.created_at) is distinct from
 (old.organization_id,old.market_id,old.payment_id,old.attempt_number,old.file_id,old.bank_account_id,old.bank_snapshot,old.submitted_by,old.created_at) or old.state in ('REJECTED','CONFIRMED') then raise exception 'Transfer evidence immutable' using errcode='55000'; end if;
 if not ((old.state='RESERVED' and new.state in ('SUBMITTED','REMOVING')) or (old.state='SUBMITTED' and new.state in ('REJECTED','CONFIRMED'))) then raise exception 'Invalid transfer transition' using errcode='55000'; end if;
 return new;
end $$;
create trigger transfer_history_guard before update or delete on public.bank_transfer_attempts for each row execute function private.transfer_history_guard();
revoke all on function private.guard_payment_facts(),private.transfer_history_guard() from public,anon,authenticated;
