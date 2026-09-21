-- Financial evidence has purpose-specific access; generic files.read never suffices.
create function private.transfer_file_access(p_file uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bank_transfer_attempts a join public.payments p on p.id=a.payment_id join public.file_objects f on f.id=a.file_id
 where f.id=p_file and f.purpose='TRANSFER_PROOF' and
 ((not p_write and f.upload_state='ready' and (private.payment_customer(p.id) or private.has_permission(p.organization_id,'finance.read')))
 or (p_write and a.submitted_by=auth.uid() and private.payment_customer(p.id) and a.state='RESERVED' and f.upload_state='pending' and f.created_at>now()-interval '20 minutes')))
$$;
drop policy file_objects_read on public.file_objects;
create policy file_objects_read on public.file_objects for select to authenticated using(
 (purpose='GENERAL' and ((owner_profile_id=auth.uid() and private.is_member(organization_id)) or private.has_permission(organization_id,'files.read')))
 or (purpose='TRANSFER_PROOF' and (private.transfer_file_access(id) or private.transfer_file_access(id,true)))
);
create function private.transfer_storage_access(p_bucket text,p_path text,p_metadata jsonb default null) returns boolean language plpgsql security definer set search_path='' as $$
declare f public.file_objects;
begin
 if p_bucket<>'documents' then return false; end if;
 select * into f from public.file_objects where bucket_id=p_bucket and object_name=p_path and purpose='TRANSFER_PROOF';
 if not found then return false; end if;
 if p_metadata is null then return private.transfer_file_access(f.id); end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 return storage.allow_only_operation('object.upload') and private.transfer_file_access(f.id,true)
 and p_metadata->>'mimetype'=f.mime_type and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size_bytes;
end $$;
create function private.transfer_storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.file_objects;
begin
 if new.bucket_id<>'documents' or auth.uid() is null then return new; end if;
 select * into f from public.file_objects where bucket_id=new.bucket_id and object_name=new.name and purpose='TRANSFER_PROOF';
 if not found then raise exception 'Financial upload reservation required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 if not private.transfer_file_access(f.id,true) or new.metadata->>'mimetype' is distinct from f.mime_type or coalesce(new.metadata->>'size',new.metadata->>'contentLength')::bigint is distinct from f.size_bytes then raise exception 'Financial upload denied' using errcode='42501'; end if;
 return new;
end $$;
create function private.transfer_storage_removal(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_bucket='documents' and storage.allow_only_operation('object.delete') and exists(select 1 from public.file_objects f join public.bank_transfer_attempts a on a.file_id=f.id where f.bucket_id=p_bucket and f.object_name=p_path and f.purpose='TRANSFER_PROOF' and f.upload_state='removing' and a.state='REMOVING' and a.submitted_by=auth.uid() and private.payment_customer(a.payment_id))
$$;
create policy transfer_storage_read on storage.objects for select to authenticated using(private.transfer_storage_access(bucket_id,name) or private.transfer_storage_removal(bucket_id,name));
create policy transfer_storage_upload on storage.objects for insert to authenticated with check(private.transfer_storage_access(bucket_id,name,metadata));
create policy transfer_storage_remove on storage.objects for delete to authenticated using(private.transfer_storage_removal(bucket_id,name));
create trigger transfer_storage_guard before insert or update on storage.objects for each row execute function private.transfer_storage_guard();

create function public.payment_details(p_order uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.orders;p public.payments;b public.bank_accounts;finance boolean;attempts jsonb;receipt jsonb;
begin
 select * into o from public.orders where id=p_order;
 if not found then raise exception 'Order unavailable' using errcode='42501'; end if;
 finance=private.has_permission(o.organization_id,'finance.read');
 if not finance and not (private.owns_customer(o.organization_id,o.customer_id) and private.has_permission(o.organization_id,'account.access')) then raise exception 'Payment access denied' using errcode='42501'; end if;
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
 'bank',case when b.id is null then null else private.payment_bank_snapshot(b) end,'attempts',attempts,'receipt',receipt);
end $$;
create function public.finance_queue(p_org uuid,p_status text default null,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission(p_org,'finance.read') then raise exception 'Finance access denied' using errcode='42501'; end if;
 if p_offset is null or p_offset not between 0 and 10000 or (p_status is not null and p_status not in ('PENDING','CASH_DUE','AWAITING_TRANSFER_PROOF','UNDER_REVIEW','TRANSFER_REJECTED','PAID')) then raise exception 'Invalid queue filter' using errcode='22023'; end if;
 select coalesce(jsonb_agg(row order by created_at desc,id),'[]') into result from (
 select p.id,p.created_at,jsonb_build_object('orderId',o.id,'reference',o.reference,'customerId',o.customer_id,'marketId',o.market_id,'currency',o.currency,'amountMinor',o.total_minor,'method',p.method,'status',p.status,'createdAt',p.created_at) row
 from public.payments p join public.orders o on o.id=p.order_id where p.organization_id=p_org and (p_status is null or p.status=p_status) order by p.created_at desc,p.id limit 30 offset p_offset) q;
 return result;
end $$;
create function public.payment_clearance(p_trip uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.trips;o public.orders;p public.payments;staff boolean;
begin
 select * into t from public.trips where id=p_trip;
 if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
 staff=private.has_permission(t.organization_id,'operations.manage') or private.has_permission(t.organization_id,'dispatch.manage');
 if not staff and not private.driver_trip_access(t.id,true) then raise exception 'Trip access denied' using errcode='42501'; end if;
 select orders.* into o from public.orders orders join public.jobs j on j.order_id=orders.id where j.id=t.job_id;
 select * into p from public.payments where order_id=o.id;
 return jsonb_build_object('executionAllowed',t.started_at is not null or private.order_payment_cleared(o.id))||case when staff then jsonb_build_object('method',p.method,'status',coalesce(p.status,'PENDING')) else '{}' end;
end $$;
create function public.transfer_proof_path(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.bank_transfer_attempts;f public.file_objects;
begin
 select * into a from public.bank_transfer_attempts where id=p_attempt;
 select * into f from public.file_objects where id=a.file_id;
 if not found or not private.transfer_file_access(f.id) then raise exception 'Proof unavailable' using errcode='42501'; end if;
 return jsonb_build_object('bucket',f.bucket_id,'path',f.object_name,'mime',f.mime_type);
end $$;

-- Existing audit trigger would copy Finance notes into generic audit data. Replace it
-- with bounded evidence; detailed notes stay in Finance-protected transaction rows.
drop trigger payment_transactions_audit on public.payment_transactions;
create function private.audit_payment_transaction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata) values(new.organization_id,auth.uid(),'PAYMENT_TRANSACTION','payment_transactions',new.id,jsonb_build_object('payment_id',new.payment_id,'event',new.event_code));return new;
end $$;
create trigger payment_transactions_audit after insert on public.payment_transactions for each row execute function private.audit_payment_transaction();
revoke all on function private.transfer_file_access(uuid,boolean),private.transfer_storage_access(text,text,jsonb),private.transfer_storage_guard(),private.transfer_storage_removal(text,text),private.audit_payment_transaction(),public.payment_details(uuid),public.finance_queue(uuid,text,integer),public.payment_clearance(uuid),public.transfer_proof_path(uuid) from public,anon,authenticated;
grant execute on function public.payment_details(uuid),public.finance_queue(uuid,text,integer),public.payment_clearance(uuid),public.transfer_proof_path(uuid) to authenticated;
