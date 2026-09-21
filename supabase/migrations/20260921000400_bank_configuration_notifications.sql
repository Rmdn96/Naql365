-- RLS invokes these bounded predicates as authenticated; private schema is not exposed by PostgREST.
grant execute on function private.payment_customer(uuid),private.transfer_file_access(uuid,boolean),private.transfer_storage_access(text,text,jsonb),private.transfer_storage_removal(text,text) to authenticated;

create function public.configure_bank_account(p_org uuid,p_market uuid,p_id uuid,p_revision integer,p_mutation uuid,p_details jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bank_accounts;m public.markets;prior private.payment_mutations;intent jsonb;result jsonb;
begin
 if not private.has_permission(p_org,'finance.accounts.manage') then raise exception 'Bank configuration permission required' using errcode='42501'; end if;
 if p_id is null or p_mutation is null or p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>8192 or
 (p_details-array['bankNameAr','bankNameEn','beneficiaryAr','beneficiaryEn','iban','accountNumber','bic','instructionsAr','instructionsEn','active','primary'])<>'{}'::jsonb then raise exception 'Invalid account configuration' using errcode='22023'; end if;
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
 insert into public.bank_accounts(id,organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,iban,account_number,bic,instructions_ar,instructions_en,active,is_primary,created_by)
 values(p_id,p_org,p_market,m.currency,p_details->>'bankNameAr',p_details->>'bankNameEn',p_details->>'beneficiaryAr',p_details->>'beneficiaryEn',nullif(p_details->>'iban',''),nullif(p_details->>'accountNumber',''),nullif(p_details->>'bic',''),coalesce(p_details->>'instructionsAr',''),coalesce(p_details->>'instructionsEn',''),(p_details->>'active')::boolean,(p_details->>'primary')::boolean,auth.uid())
 on conflict(id) do update set bank_name_ar=excluded.bank_name_ar,bank_name_en=excluded.bank_name_en,beneficiary_ar=excluded.beneficiary_ar,beneficiary_en=excluded.beneficiary_en,iban=excluded.iban,account_number=excluded.account_number,bic=excluded.bic,instructions_ar=excluded.instructions_ar,instructions_en=excluded.instructions_en,active=excluded.active,is_primary=excluded.is_primary,revision=bank_accounts.revision+1 returning * into b;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata) values(p_org,auth.uid(),'BANK_ACCOUNT_CONFIGURED','bank_accounts',b.id,jsonb_build_object('market_id',p_market,'revision',b.revision,'active',b.active));
 result=jsonb_build_object('id',b.id,'revision',b.revision);
 insert into private.payment_mutations values(auth.uid(),p_mutation,p_org,intent,result,now());return result;
end $$;
revoke all on function public.configure_bank_account(uuid,uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.configure_bank_account(uuid,uuid,uuid,integer,uuid,jsonb) to authenticated;

alter table public.notifications add column payment_id uuid references public.payments(id);
alter table public.notifications drop constraint notifications_event_code_check;
alter table public.notifications add constraint notifications_event_code_check check(event_code in ('TRIP_STARTED','TRIP_COMPLETED','TRIP_REASSIGNED','ISSUE_REPORTED','TRANSFER_PROOF_RECEIVED','TRANSFER_CONFIRMED','TRANSFER_REJECTED','CASH_RECEIVED'));
alter table public.notifications drop constraint notification_execution_facts;
alter table public.notifications add constraint notification_execution_facts check(event_code is null or (market_id is not null and audience is not null and
 ((event_code in ('TRIP_STARTED','TRIP_COMPLETED','TRIP_REASSIGNED','ISSUE_REPORTED') and trip_id is not null and payment_id is null) or
 (event_code in ('TRANSFER_PROOF_RECEIVED','TRANSFER_CONFIRMED','TRANSFER_REJECTED','CASH_RECEIVED') and payment_id is not null and trip_id is null))));
drop policy notifications_self on public.notifications;
create policy notifications_self on public.notifications for select to authenticated using(recipient_profile_id=auth.uid() and private.is_member(organization_id)
 and (audience is null or (audience='CUSTOMER' and private.has_permission(organization_id,'account.access')) or (audience='STAFF' and
 ((payment_id is not null and private.has_permission(organization_id,'finance.read')) or (payment_id is null and (private.has_permission(organization_id,'operations.manage') or private.has_permission(organization_id,'dispatch.manage')))))));
create function private.notify_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.payments;code text;
begin
 code=case new.event_code when 'PROOF_SUBMITTED' then 'TRANSFER_PROOF_RECEIVED' when 'TRANSFER_CONFIRMED' then 'TRANSFER_CONFIRMED' when 'TRANSFER_REJECTED' then 'TRANSFER_REJECTED' when 'CASH_RECEIVED' then 'CASH_RECEIVED' end;
 if code is null then return new; end if;
 select * into p from public.payments where id=new.payment_id;
 insert into public.notifications(organization_id,recipient_profile_id,idempotency_key,market_id,payment_id,event_code,audience)
 select p.organization_id,c.profile_id,new.id::text||':'||c.profile_id::text,p.market_id,p.id,code,'CUSTOMER' from public.customers c where c.id=p.customer_id on conflict(organization_id,idempotency_key) do nothing;
 if code='TRANSFER_PROOF_RECEIVED' then
 insert into public.notifications(organization_id,recipient_profile_id,idempotency_key,market_id,payment_id,event_code,audience)
 select p.organization_id,m.profile_id,new.id::text||':'||m.profile_id::text,p.market_id,p.id,code,'STAFF' from public.organization_memberships m where m.organization_id=p.organization_id and m.status='active' and m.member_type='staff' and exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions perm on perm.id=rp.permission_id where ur.organization_id=m.organization_id and ur.profile_id=m.profile_id and perm.code='finance.read') on conflict(organization_id,idempotency_key) do nothing;
 end if;return new;
end $$;
create trigger notify_payment after insert on public.payment_transactions for each row execute function private.notify_payment();
revoke all on function private.notify_payment() from public,anon,authenticated;
