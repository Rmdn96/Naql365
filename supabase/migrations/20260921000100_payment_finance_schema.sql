-- Phase 6 gap analysis 6fdd01d; owner decisions recorded in af76312 before migrations.
-- Extend the foundation entities. Never infer a selected method or received money.
alter table public.payments
 add column market_id uuid,
 add column customer_id uuid,
 add column currency text,
 add column amount_minor bigint check(amount_minor>=0),
 add column method text check(method in ('CASH','BANK_TRANSFER')),
 add column status text not null default 'PENDING' check(status in ('PENDING','CASH_DUE','AWAITING_TRANSFER_PROOF','UNDER_REVIEW','TRANSFER_REJECTED','PAID')),
 add column revision integer not null default 0 check(revision>=0),
 add column paid_at timestamptz,
 add column confirmed_by uuid references public.profiles(id),
 add constraint payment_one_order unique(organization_id,order_id),
 add constraint payment_market_identity unique(organization_id,market_id,id),
 add constraint payment_market foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 add constraint payment_customer foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 add constraint payment_state_facts check(
  (method is null and status='PENDING') or (method is not null and (
  (method='CASH' and status in ('CASH_DUE','PAID')) or
  (method='BANK_TRANSFER' and status in ('AWAITING_TRANSFER_PROOF','UNDER_REVIEW','TRANSFER_REJECTED','PAID'))))),
 add constraint payment_received_facts check((status='PAID')=(paid_at is not null and confirmed_by is not null));
-- Snapshot only identity/amount already present; a legacy row remains PENDING.
update public.payments p set market_id=o.market_id,customer_id=o.customer_id,currency=o.currency,amount_minor=o.total_minor from public.orders o where o.id=p.order_id and o.organization_id=p.organization_id;
create index payments_review_queue on public.payments(organization_id,status,created_at desc,id);

create table public.bank_accounts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,market_id uuid not null,currency text not null,
 bank_name_ar text not null check(length(btrim(bank_name_ar)) between 1 and 120),bank_name_en text not null check(length(btrim(bank_name_en)) between 1 and 120),
 beneficiary_ar text not null check(length(btrim(beneficiary_ar)) between 1 and 160),beneficiary_en text not null check(length(btrim(beneficiary_en)) between 1 and 160),
 iban text check(iban is null or iban ~ '^[A-Z]{2}[0-9A-Z]{13,32}$'),account_number text check(account_number is null or account_number ~ '^[0-9A-Za-z-]{4,40}$'),
 bic text check(bic is null or bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),instructions_ar text not null default '' check(length(instructions_ar)<=1500),instructions_en text not null default '' check(length(instructions_en)<=1500),
 active boolean not null default true,is_primary boolean not null default true,revision integer not null default 0,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(iban is not null or account_number is not null),foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),unique(organization_id,market_id,id)
);
create unique index bank_account_primary on public.bank_accounts(organization_id,market_id,currency) where active and is_primary;
create index bank_account_market on public.bank_accounts(organization_id,market_id,active);
create trigger bank_accounts_updated before update on public.bank_accounts for each row execute function private.touch_updated_at();

-- Reuse file objects with an explicit security purpose so files.read never grants proof access.
alter table public.file_objects add column purpose text not null default 'GENERAL' check(purpose in ('GENERAL','TRANSFER_PROOF'));
alter table public.file_objects drop constraint file_objects_mime_type_check;
alter table public.file_objects add constraint file_objects_mime_type_check check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf'));
update storage.buckets set allowed_mime_types=array['application/pdf','image/jpeg','image/png'] where id='documents';

create table public.bank_transfer_attempts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,market_id uuid not null,payment_id uuid not null,
 attempt_number integer not null check(attempt_number>0),file_id uuid not null unique,
 bank_account_id uuid not null,bank_snapshot jsonb not null check(jsonb_typeof(bank_snapshot)='object' and octet_length(bank_snapshot::text)<=8192),
 state text not null default 'RESERVED' check(state in ('RESERVED','SUBMITTED','REJECTED','CONFIRMED','REMOVING')),
 submitted_by uuid not null references public.profiles(id),submitted_at timestamptz,reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,
 rejection_reason text check(rejection_reason is null or length(btrim(rejection_reason)) between 1 and 500),
 finance_note text check(finance_note is null or length(finance_note)<=500),bank_reference text check(bank_reference is null or length(bank_reference)<=120),
 created_at timestamptz not null default now(),
 foreign key(organization_id,market_id,payment_id) references public.payments(organization_id,market_id,id),
 foreign key(organization_id,market_id,bank_account_id) references public.bank_accounts(organization_id,market_id,id),
 foreign key(organization_id,file_id) references public.file_objects(organization_id,id),
 unique(payment_id,attempt_number),unique(organization_id,id),
 check((state in ('SUBMITTED','REJECTED','CONFIRMED'))=(submitted_at is not null)),
 check((state in ('REJECTED','CONFIRMED'))=(reviewed_at is not null and reviewed_by is not null)),
 check(state<>'REJECTED' or rejection_reason is not null)
);
create unique index transfer_one_open_attempt on public.bank_transfer_attempts(payment_id) where state in ('RESERVED','SUBMITTED','REMOVING');
create index transfer_payment_history on public.bank_transfer_attempts(payment_id,attempt_number desc);

alter table public.payment_transactions
 add column event_code text check(event_code in ('METHOD_SELECTED','PROOF_SUBMITTED','TRANSFER_CONFIRMED','TRANSFER_REJECTED','CASH_RECEIVED')),
 add column actor_id uuid references public.profiles(id),add column amount_minor bigint check(amount_minor>=0),add column currency text,
 add column attempt_id uuid references public.bank_transfer_attempts(id),add column reference text check(reference is null or length(reference)<=120),
 add column note text check(note is null or length(note)<=500);
create unique index payment_one_receipt_transaction on public.payment_transactions(payment_id) where event_code in ('TRANSFER_CONFIRMED','CASH_RECEIVED');

alter table public.invoices
 add column payment_id uuid references public.payments(id),add column customer_id uuid,add column market_id uuid,add column currency text,
 add column reference text unique,add column kind text check(kind='PAYMENT_RECEIPT'),add column status text check(status='ISSUED'),
 add column subtotal_minor bigint,add column tax_amount_minor bigint,add column total_minor bigint,add column tax_code text,add column tax_rate_bps integer,add column tax_label_ar text,add column tax_label_en text,
 add column issued_at timestamptz,add column issued_by uuid references public.profiles(id),
 add constraint receipt_one_payment unique(payment_id),
 add constraint receipt_market foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 add constraint receipt_customer foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 add constraint receipt_facts check(kind is null or (payment_id is not null and status='ISSUED' and issued_at is not null and issued_by is not null and total_minor=subtotal_minor+tax_amount_minor));

create table private.payment_mutations(actor_id uuid not null,mutation_id uuid not null,organization_id uuid not null,intent jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,mutation_id));
revoke all on private.payment_mutations from public,anon,authenticated;
insert into public.permissions(code) values('finance.verify'),('finance.accounts.manage');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code in ('FINANCE','SUPER_ADMIN') and p.code='finance.verify';
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='SUPER_ADMIN' and p.code='finance.accounts.manage';

create function private.payment_customer(p_payment uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.payments p where p.id=p_payment and private.owns_customer(p.organization_id,p.customer_id) and private.has_permission(p.organization_id,'account.access'))
$$;
revoke all on function private.payment_customer(uuid) from public,anon,authenticated;
alter table public.bank_accounts enable row level security;
alter table public.bank_transfer_attempts enable row level security;
revoke all on public.bank_accounts,public.bank_transfer_attempts from public,anon,authenticated;
grant select on public.bank_accounts,public.bank_transfer_attempts to authenticated;
create policy bank_accounts_finance_read on public.bank_accounts for select to authenticated using(private.has_permission(organization_id,'finance.read') or private.has_permission(organization_id,'finance.accounts.manage'));
create policy transfer_finance_read on public.bank_transfer_attempts for select to authenticated using(private.has_permission(organization_id,'finance.read'));
create policy payment_customer_read on public.payments for select to authenticated using(private.payment_customer(id));
create policy receipt_customer_read on public.invoices for select to authenticated using(private.payment_customer(payment_id));
-- Proof details are exposed to customers by a safe projection, never Finance notes.
drop policy file_objects_read on public.file_objects;
create policy file_objects_read on public.file_objects for select to authenticated using(
 (purpose='GENERAL' and ((owner_profile_id=auth.uid() and private.is_member(organization_id)) or private.has_permission(organization_id,'files.read')))
 or (purpose='TRANSFER_PROOF' and (private.has_permission(organization_id,'finance.read') or exists(select 1 from public.bank_transfer_attempts a where a.file_id=file_objects.id and private.payment_customer(a.payment_id))))
);
drop policy registered_private_files_read on storage.objects;
create policy registered_private_files_read on storage.objects for select to authenticated using(
 bucket_id in ('attachments','pod-files','documents') and exists(select 1 from public.file_objects f where f.bucket_id=storage.objects.bucket_id and f.object_name=storage.objects.name and f.upload_state='ready' and f.purpose='GENERAL'
 and ((f.owner_profile_id=auth.uid() and private.is_member(f.organization_id)) or private.has_permission(f.organization_id,'files.read')))
);

create function private.order_payment_cleared(p_order uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.payments where order_id=p_order and ((method='CASH' and status in ('CASH_DUE','PAID')) or (method='BANK_TRANSFER' and status='PAID')))
$$;
revoke all on function private.order_payment_cleared(uuid) from public,anon,authenticated;
-- Guard the underlying physical start transition so staff and Driver share one rule.
-- Already-started legacy Trips are unchanged; new Trips never inherit that exception.
create function private.payment_start_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare order_key uuid;
begin
 if new.started_at is not null and (tg_op='INSERT' or old.started_at is null) then
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,34));
  select order_id into order_key from public.jobs where id=new.job_id and organization_id=new.organization_id;
  if not private.order_payment_cleared(order_key) then raise exception 'Payment execution clearance required' using errcode='55000'; end if;
 end if;
 return new;
end $$;
revoke all on function private.payment_start_guard() from public,anon,authenticated;
create trigger payment_start_guard before insert or update of started_at on public.trips for each row execute function private.payment_start_guard();
