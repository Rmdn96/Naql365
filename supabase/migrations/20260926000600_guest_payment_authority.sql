-- Extend customer authority only. Finance confirmation and physical-start gates are unchanged.
alter table public.bank_transfer_attempts alter column submitted_by drop not null;
alter table public.bank_transfer_attempts add column guest_customer_id uuid;
alter table public.bank_transfer_attempts add column guest_grant_id uuid references private.guest_access_grants(id);
alter table public.bank_transfer_attempts add constraint transfer_guest_customer_fk
 foreign key(organization_id,guest_customer_id) references public.customers(organization_id,id);
alter table public.bank_transfer_attempts add constraint transfer_actor_kind
 check((submitted_by is not null and guest_customer_id is null and guest_grant_id is null)
 or (submitted_by is null and guest_customer_id is not null and guest_grant_id is not null));
create function private.guard_guest_transfer_actor() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.guest_grant_id is not null and not exists(select 1 from private.guest_access_grants g
  join public.payments p on p.organization_id=g.organization_id and p.customer_id=g.customer_id
  join public.orders o on o.id=p.order_id and o.request_id=g.request_id
  where g.id=new.guest_grant_id and g.customer_id=new.guest_customer_id and p.id=new.payment_id)
 then raise exception 'Guest evidence actor mismatch' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.guest_customer_id,new.guest_grant_id) is distinct from (old.guest_customer_id,old.guest_grant_id)
 then raise exception 'Evidence actor immutable' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.guard_guest_transfer_actor() from public,anon,authenticated;
create trigger guest_transfer_actor before insert or update on public.bank_transfer_attempts
 for each row execute function private.guard_guest_transfer_actor();

create or replace function private.payment_customer(p_payment uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.payments p join public.orders o on o.id=p.order_id
 where p.id=p_payment and private.customer_request_access(o.organization_id,o.customer_id,o.request_id))
$$;

create or replace function private.payment_event(p public.payments,p_code text,p_mutation uuid,p_attempt uuid default null,p_reference text default null,p_note text default null)
 returns void language plpgsql set search_path='' as $$
declare guest private.guest_access_grants; actor uuid=auth.uid(); facts jsonb;
begin
 if actor is null then guest=private.guest_context(); actor=guest.id; end if;
 if actor is null then raise exception 'Payment actor required' using errcode='42501'; end if;
 insert into public.payment_transactions(organization_id,payment_id,provider,provider_event_id,event_code,actor_id,amount_minor,currency,attempt_id,reference,note)
 values(p.organization_id,p.id,'INTERNAL_MANUAL',actor::text||':'||p_mutation::text,p_code,auth.uid(),p.amount_minor,p.currency,p_attempt,p_reference,p_note);
 facts=jsonb_build_object('market_id',p.market_id,'state',p.status,'method',p.method,'attempt_id',p_attempt);
 if guest.id is not null then facts=facts||jsonb_build_object('guest_grant_id',guest.id); end if;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(p.organization_id,auth.uid(),p_code,'payments',p.id,facts);
end $$;

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
 select * into b from public.bank_accounts where organization_id=o.organization_id and market_id=o.market_id and currency=o.currency and active and is_primary;
 select coalesce(jsonb_agg(item order by n desc),'[]') into attempts from (
  select a.attempt_number n,jsonb_build_object('id',a.id,'number',a.attempt_number,'state',a.state,'fileId',a.file_id,'mime',f.mime_type,'submittedAt',a.submitted_at,'reviewedAt',a.reviewed_at,'rejectionReason',a.rejection_reason,'bank',a.bank_snapshot)||
  case when finance then jsonb_build_object('reviewer',a.reviewed_by,'financeNote',a.finance_note,'reference',a.bank_reference) else '{}' end item
  from public.bank_transfer_attempts a join public.file_objects f on f.id=a.file_id where a.payment_id=p.id order by a.attempt_number desc limit 20
 ) rows;
 select jsonb_build_object('id',i.id,'reference',i.reference,'issuedAt',i.issued_at,'kind',i.kind) into receipt from public.invoices i where payment_id=p.id and kind='PAYMENT_RECEIPT';
 return jsonb_build_object('orderId',o.id,'organizationId',o.organization_id,'reference',o.reference,'marketId',o.market_id,'country',(select country_code from public.markets where id=o.market_id),'timezone',(select timezone from public.markets where id=o.market_id),'currency',o.currency,'subtotalMinor',o.subtotal_minor,'taxMinor',o.vat_amount_minor,'totalMinor',o.total_minor,'taxLabelAr',o.tax_label_ar,'taxLabelEn',o.tax_label_en,
 'paymentId',p.id,'revision',coalesce(p.revision,0),'method',p.method,'status',coalesce(p.status,'PENDING'),'executionAllowed',private.order_payment_cleared(o.id),
 'canSwitch',p.status is distinct from 'PAID' and not exists(select 1 from public.bank_transfer_attempts where payment_id=p.id) and (p.method is null or not exists(select 1 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id and t.started_at is not null)),
 'transferAvailable',b.id is not null,'bank',case when p.method='BANK_TRANSFER' and b.id is not null then private.payment_bank_snapshot(b) else null end,'attempts',attempts,'receipt',receipt);
end $$;

create or replace function private.notify_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.payments;code text;
begin
 code=case new.event_code when 'PROOF_SUBMITTED' then 'TRANSFER_PROOF_RECEIVED' when 'TRANSFER_CONFIRMED' then 'TRANSFER_CONFIRMED' when 'TRANSFER_REJECTED' then 'TRANSFER_REJECTED' when 'CASH_RECEIVED' then 'CASH_RECEIVED' end;
 if code is null then return new; end if;
 select * into p from public.payments where id=new.payment_id;
 insert into public.notifications(organization_id,recipient_profile_id,idempotency_key,market_id,payment_id,event_code,audience)
 select p.organization_id,c.profile_id,new.id::text||':'||c.profile_id::text,p.market_id,p.id,code,'CUSTOMER' from public.customers c where c.id=p.customer_id and c.profile_id is not null on conflict(organization_id,idempotency_key) do nothing;
 if code='TRANSFER_PROOF_RECEIVED' then
 insert into public.notifications(organization_id,recipient_profile_id,idempotency_key,market_id,payment_id,event_code,audience)
 select p.organization_id,m.profile_id,new.id::text||':'||m.profile_id::text,p.market_id,p.id,code,'STAFF' from public.organization_memberships m where m.organization_id=p.organization_id and m.status='active' and m.member_type='staff' and exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions perm on perm.id=rp.permission_id where ur.organization_id=m.organization_id and ur.profile_id=m.profile_id and perm.code='finance.read') on conflict(organization_id,idempotency_key) do nothing;
 end if;return new;
end $$;

revoke all on function public.payment_command(uuid,text,uuid,integer,jsonb),public.payment_details(uuid) from public;
grant execute on function public.payment_command(uuid,text,uuid,integer,jsonb),public.payment_details(uuid) to anon,authenticated;



-- Safe status-only tracking reuses the accepted customer projection.
create or replace function public.customer_order_progress(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.orders; result jsonb;
begin
 select * into o from public.orders where id=p_order_id;
 if not found or not private.customer_request_access(o.organization_id,o.customer_id,o.request_id)
 then raise exception 'Order unavailable' using errcode='42501'; end if;
 select jsonb_build_object('id',o.id,'reference',o.reference,'status',o.operational_status,'completedAt',o.operational_completed_at,'market', (select jsonb_build_object('countryCode',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,'currency',o.currency,'timezone',m.timezone) from public.markets m where m.id=o.market_id),
 'trips',coalesce((select jsonb_agg(jsonb_build_object('reference',t.reference,'status',t.status,
 'totalStops',(select count(*) from public.trip_stops s where s.trip_id=t.id),
 'completedStops',(select count(*) from public.trip_stops s where s.trip_id=t.id and s.status='COMPLETED'),
 'podCaptured',exists(select 1 from public.trip_pods p where p.trip_id=t.id and p.state='FINAL')) order by t.created_at,t.id)
 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.customer_order_progress(uuid) from public,anon,authenticated;
grant execute on function public.customer_order_progress(uuid) to anon,authenticated;


