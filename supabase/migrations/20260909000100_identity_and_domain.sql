-- Naql365 Phase 0. No tenant, user, customer or operational seed data.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.branches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(name) between 1 and 200), unique(organization_id,id), unique(organization_id,name),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text check(length(display_name) <= 200), locale text not null default 'ar' check(locale in ('ar','en')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_memberships (
 organization_id uuid not null references public.organizations(id), profile_id uuid not null references public.profiles(id),
 branch_id uuid, member_type text not null check(member_type in ('customer','staff','driver')),
 status text not null default 'active' check(status in ('active','suspended')),
 primary key(organization_id,profile_id), foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index memberships_profile_idx on public.organization_memberships(profile_id,organization_id);
create table public.roles (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 member_type text not null check(member_type in ('customer','staff','driver'))
);
create table public.permissions (id uuid primary key default gen_random_uuid(), code text not null unique);
create table public.user_roles (
 organization_id uuid not null, profile_id uuid not null, role_id uuid not null references public.roles(id),
 primary key(organization_id,profile_id,role_id),
 foreign key(organization_id,profile_id) references public.organization_memberships(organization_id,profile_id),
 created_at timestamptz not null default now()
);
create index user_roles_profile_idx on public.user_roles(profile_id,organization_id);
create table public.role_permissions (
 role_id uuid not null references public.roles(id), permission_id uuid not null references public.permissions(id),
 primary key(role_id,permission_id)
);

create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null, entity_type text not null, entity_id uuid, occurred_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb, before_data jsonb, after_data jsonb
);
create index audit_logs_org_time_idx on public.audit_logs(organization_id,occurred_at desc);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
revoke all on function private.create_profile() from public;
create trigger auth_user_profile after insert on auth.users for each row execute function private.create_profile();

create function private.is_member(tenant uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.organization_memberships m where m.organization_id=tenant and m.profile_id=(select auth.uid()) and m.status='active')
$$;
create function private.has_permission(tenant uuid, permission_code text) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.organization_memberships m
 join public.user_roles ur on ur.organization_id=m.organization_id and ur.profile_id=m.profile_id
 join public.roles r on r.id=ur.role_id and r.member_type=m.member_type
 join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id
 where m.organization_id=tenant and m.profile_id=(select auth.uid()) and m.status='active' and p.code=permission_code)
$$;
create function public.has_permission(organization_id uuid, permission_code text) returns boolean language sql stable security invoker set search_path = '' as $$
 select private.has_permission(organization_id,permission_code)
$$;
revoke all on function private.is_member(uuid), private.has_permission(uuid,text), public.has_permission(uuid,text) from public;
grant execute on function private.is_member(uuid), private.has_permission(uuid,text), public.has_permission(uuid,text) to authenticated;

create function private.validate_role_assignment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.organization_memberships m join public.roles r on r.member_type=m.member_type
 where m.organization_id=new.organization_id and m.profile_id=new.profile_id and r.id=new.role_id)
 then raise exception 'Role does not match membership type' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.validate_role_assignment() from public;
create trigger validate_role_assignment before insert or update on public.user_roles for each row execute function private.validate_role_assignment();

create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_row jsonb; new_row jsonb; row_data jsonb;
begin
 if tg_op <> 'INSERT' then old_row=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_row=to_jsonb(new); end if;
 row_data=coalesce(new_row,old_row);
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,before_data,after_data)
 values((row_data->>'organization_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,
 coalesce(row_data->>'id',row_data->>'profile_id',row_data->>'role_id')::uuid,old_row,new_row);
 return coalesce(new,old);
end $$;
revoke all on function private.audit_change() from public;

create table public.customers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 profile_id uuid not null, unique(organization_id,profile_id), foreign key(organization_id,profile_id) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index customers_profile_id_idx on public.customers(organization_id,profile_id);

create table public.drivers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 profile_id uuid not null, unique(organization_id,profile_id), foreign key(organization_id,profile_id) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index drivers_profile_id_idx on public.drivers(organization_id,profile_id);

create table public.vehicles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 branch_id uuid, foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index vehicles_branch_id_idx on public.vehicles(organization_id,branch_id);

create table public.teams (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 branch_id uuid, foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index teams_branch_id_idx on public.teams(organization_id,branch_id);

create table public.services (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null, unique(organization_id,code),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.service_areas (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 service_id uuid not null, foreign key(organization_id,service_id) references public.services(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index service_areas_service_id_idx on public.service_areas(organization_id,service_id);

create table public.requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 customer_id uuid not null, foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index requests_customer_id_idx on public.requests(organization_id,customer_id);

create table public.request_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 request_id uuid not null, foreign key(organization_id,request_id) references public.requests(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index request_items_request_id_idx on public.request_items(organization_id,request_id);

create table public.file_objects (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 owner_profile_id uuid not null, bucket_id text not null check(bucket_id in ('attachments','pod-files','documents')),
 object_name text generated always as (organization_id::text || '/' || owner_profile_id::text || '/' || id::text) stored not null,
 unique(bucket_id,object_name), foreign key(organization_id,owner_profile_id) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index file_objects_owner_profile_id_idx on public.file_objects(organization_id,owner_profile_id);

create table public.request_attachments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 request_id uuid not null, file_id uuid not null, unique(organization_id,request_id,file_id),
 foreign key(organization_id,request_id) references public.requests(organization_id,id), foreign key(organization_id,file_id) references public.file_objects(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index request_attachments_request_id_idx on public.request_attachments(organization_id,request_id);
create index request_attachments_file_id_idx on public.request_attachments(organization_id,file_id);

create table public.quotes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 request_id uuid not null, foreign key(organization_id,request_id) references public.requests(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index quotes_request_id_idx on public.quotes(organization_id,request_id);

create table public.quote_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 quote_id uuid not null, version integer not null check(version>0), unique(organization_id,quote_id,version), unique(organization_id,quote_id,id),
 foreign key(organization_id,quote_id) references public.quotes(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index quote_versions_quote_id_idx on public.quote_versions(organization_id,quote_id);

create table public.quote_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 quote_version_id uuid not null, foreign key(organization_id,quote_version_id) references public.quote_versions(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index quote_items_quote_version_id_idx on public.quote_items(organization_id,quote_version_id);

create table public.orders (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 quote_id uuid not null, accepted_quote_version_id uuid not null, idempotency_key text not null check(length(idempotency_key) between 1 and 200),
 unique(organization_id,quote_id), unique(organization_id,accepted_quote_version_id), unique(organization_id,idempotency_key),
 foreign key(organization_id,quote_id,accepted_quote_version_id) references public.quote_versions(organization_id,quote_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_quote_id_idx on public.orders(organization_id,quote_id);
create index orders_accepted_quote_version_id_idx on public.orders(organization_id,accepted_quote_version_id);

create table public.jobs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 order_id uuid not null, foreign key(organization_id,order_id) references public.orders(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index jobs_order_id_idx on public.jobs(organization_id,order_id);

create table public.trips (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 job_id uuid not null, foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index trips_job_id_idx on public.trips(organization_id,job_id);

create table public.trip_stops (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 trip_id uuid not null, position integer not null check(position>=0), unique(organization_id,trip_id,position),
 foreign key(organization_id,trip_id) references public.trips(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index trip_stops_trip_id_idx on public.trip_stops(organization_id,trip_id);

create table public.trip_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 trip_id uuid not null, stop_id uuid, event_type text not null check(length(event_type) between 1 and 100), occurred_at timestamptz not null default now(),
 foreign key(organization_id,trip_id) references public.trips(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index trip_events_trip_id_idx on public.trip_events(organization_id,trip_id);
create index trip_events_stop_id_idx on public.trip_events(organization_id,stop_id);

create table public.assignments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 trip_id uuid not null, driver_id uuid, vehicle_id uuid, team_id uuid,
 check(num_nonnulls(driver_id,vehicle_id,team_id)>0),
 foreign key(organization_id,trip_id) references public.trips(organization_id,id),
 foreign key(organization_id,driver_id) references public.drivers(organization_id,id),
 foreign key(organization_id,vehicle_id) references public.vehicles(organization_id,id),
 foreign key(organization_id,team_id) references public.teams(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index assignments_trip_id_idx on public.assignments(organization_id,trip_id);
create index assignments_driver_id_idx on public.assignments(organization_id,driver_id);
create index assignments_vehicle_id_idx on public.assignments(organization_id,vehicle_id);
create index assignments_team_id_idx on public.assignments(organization_id,team_id);

create table public.payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 order_id uuid not null, foreign key(organization_id,order_id) references public.orders(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index payments_order_id_idx on public.payments(organization_id,order_id);

create table public.payment_transactions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 payment_id uuid not null, provider text not null, provider_event_id text not null,
 unique(organization_id,provider,provider_event_id), foreign key(organization_id,payment_id) references public.payments(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index payment_transactions_payment_id_idx on public.payment_transactions(organization_id,payment_id);

create table public.invoices (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 order_id uuid not null, foreign key(organization_id,order_id) references public.orders(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index invoices_order_id_idx on public.invoices(organization_id,order_id);

create table public.notification_templates (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 template_key text not null, locale text not null check(locale in ('ar','en')),
 channel text not null check(channel in ('in_app','email','whatsapp','sms')), unique(organization_id,template_key,locale,channel),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 recipient_profile_id uuid not null, template_id uuid, idempotency_key text not null,
 unique(organization_id,idempotency_key), foreign key(organization_id,recipient_profile_id) references public.organization_memberships(organization_id,profile_id),
 foreign key(organization_id,template_id) references public.notification_templates(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index notifications_recipient_profile_id_idx on public.notifications(organization_id,recipient_profile_id);
create index notifications_template_id_idx on public.notifications(organization_id,template_id);

create table public.reviews (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 order_id uuid not null, customer_id uuid not null, unique(organization_id,order_id,customer_id),
 foreign key(organization_id,order_id) references public.orders(organization_id,id), foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index reviews_order_id_idx on public.reviews(organization_id,order_id);
create index reviews_customer_id_idx on public.reviews(organization_id,customer_id);

create table public.quality_alerts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 trip_id uuid not null, foreign key(organization_id,trip_id) references public.trips(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index quality_alerts_trip_id_idx on public.quality_alerts(organization_id,trip_id);

create table public.issues (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 request_id uuid not null, foreign key(organization_id,request_id) references public.requests(organization_id,id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index issues_request_id_idx on public.issues(organization_id,request_id);

create table public.support_notes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 issue_id uuid not null, author_profile_id uuid not null,
 foreign key(organization_id,issue_id) references public.issues(organization_id,id),
 foreign key(organization_id,author_profile_id) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index support_notes_issue_id_idx on public.support_notes(organization_id,issue_id);
create index support_notes_author_profile_id_idx on public.support_notes(organization_id,author_profile_id);

alter table public.trip_stops add constraint trip_stops_trip_identity unique(organization_id,trip_id,id);
alter table public.trip_events add constraint trip_events_stop_fk foreign key(organization_id,trip_id,stop_id) references public.trip_stops(organization_id,trip_id,id);

-- Account profile registration never trusts raw user metadata for permissions.
-- Tenant membership and role grants require a trusted administrative transaction.
alter table public.organizations enable row level security;
revoke all on public.organizations from anon, authenticated;
grant select on public.organizations to authenticated;
create trigger organizations_updated_at before update on public.organizations for each row execute function private.touch_updated_at();
alter table public.branches enable row level security;
revoke all on public.branches from anon, authenticated;
grant select on public.branches to authenticated;
create trigger branches_updated_at before update on public.branches for each row execute function private.touch_updated_at();
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
alter table public.organization_memberships enable row level security;
revoke all on public.organization_memberships from anon, authenticated;
grant select on public.organization_memberships to authenticated;
create trigger organization_memberships_updated_at before update on public.organization_memberships for each row execute function private.touch_updated_at();
alter table public.roles enable row level security;
revoke all on public.roles from anon, authenticated;
grant select on public.roles to authenticated;
alter table public.permissions enable row level security;
revoke all on public.permissions from anon, authenticated;
grant select on public.permissions to authenticated;
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
alter table public.role_permissions enable row level security;
revoke all on public.role_permissions from anon, authenticated;
grant select on public.role_permissions to authenticated;
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
alter table public.customers enable row level security;
revoke all on public.customers from anon, authenticated;
grant select on public.customers to authenticated;
create trigger customers_updated_at before update on public.customers for each row execute function private.touch_updated_at();
alter table public.drivers enable row level security;
revoke all on public.drivers from anon, authenticated;
grant select on public.drivers to authenticated;
create trigger drivers_updated_at before update on public.drivers for each row execute function private.touch_updated_at();
alter table public.vehicles enable row level security;
revoke all on public.vehicles from anon, authenticated;
grant select on public.vehicles to authenticated;
create trigger vehicles_updated_at before update on public.vehicles for each row execute function private.touch_updated_at();
alter table public.teams enable row level security;
revoke all on public.teams from anon, authenticated;
grant select on public.teams to authenticated;
create trigger teams_updated_at before update on public.teams for each row execute function private.touch_updated_at();
alter table public.services enable row level security;
revoke all on public.services from anon, authenticated;
grant select on public.services to authenticated;
create trigger services_updated_at before update on public.services for each row execute function private.touch_updated_at();
alter table public.service_areas enable row level security;
revoke all on public.service_areas from anon, authenticated;
grant select on public.service_areas to authenticated;
create trigger service_areas_updated_at before update on public.service_areas for each row execute function private.touch_updated_at();
alter table public.requests enable row level security;
revoke all on public.requests from anon, authenticated;
grant select on public.requests to authenticated;
create trigger requests_updated_at before update on public.requests for each row execute function private.touch_updated_at();
alter table public.request_items enable row level security;
revoke all on public.request_items from anon, authenticated;
grant select on public.request_items to authenticated;
create trigger request_items_updated_at before update on public.request_items for each row execute function private.touch_updated_at();
alter table public.file_objects enable row level security;
revoke all on public.file_objects from anon, authenticated;
grant select on public.file_objects to authenticated;
create trigger file_objects_updated_at before update on public.file_objects for each row execute function private.touch_updated_at();
alter table public.request_attachments enable row level security;
revoke all on public.request_attachments from anon, authenticated;
grant select on public.request_attachments to authenticated;
create trigger request_attachments_updated_at before update on public.request_attachments for each row execute function private.touch_updated_at();
alter table public.quotes enable row level security;
revoke all on public.quotes from anon, authenticated;
grant select on public.quotes to authenticated;
create trigger quotes_updated_at before update on public.quotes for each row execute function private.touch_updated_at();
alter table public.quote_versions enable row level security;
revoke all on public.quote_versions from anon, authenticated;
grant select on public.quote_versions to authenticated;
create trigger quote_versions_updated_at before update on public.quote_versions for each row execute function private.touch_updated_at();
alter table public.quote_items enable row level security;
revoke all on public.quote_items from anon, authenticated;
grant select on public.quote_items to authenticated;
create trigger quote_items_updated_at before update on public.quote_items for each row execute function private.touch_updated_at();
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
create trigger orders_updated_at before update on public.orders for each row execute function private.touch_updated_at();
alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated;
grant select on public.jobs to authenticated;
create trigger jobs_updated_at before update on public.jobs for each row execute function private.touch_updated_at();
alter table public.trips enable row level security;
revoke all on public.trips from anon, authenticated;
grant select on public.trips to authenticated;
create trigger trips_updated_at before update on public.trips for each row execute function private.touch_updated_at();
alter table public.trip_stops enable row level security;
revoke all on public.trip_stops from anon, authenticated;
grant select on public.trip_stops to authenticated;
create trigger trip_stops_updated_at before update on public.trip_stops for each row execute function private.touch_updated_at();
alter table public.trip_events enable row level security;
revoke all on public.trip_events from anon, authenticated;
grant select on public.trip_events to authenticated;
create trigger trip_events_updated_at before update on public.trip_events for each row execute function private.touch_updated_at();
alter table public.assignments enable row level security;
revoke all on public.assignments from anon, authenticated;
grant select on public.assignments to authenticated;
create trigger assignments_updated_at before update on public.assignments for each row execute function private.touch_updated_at();
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create trigger payments_updated_at before update on public.payments for each row execute function private.touch_updated_at();
alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;
create trigger payment_transactions_updated_at before update on public.payment_transactions for each row execute function private.touch_updated_at();
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant select on public.invoices to authenticated;
create trigger invoices_updated_at before update on public.invoices for each row execute function private.touch_updated_at();
alter table public.notification_templates enable row level security;
revoke all on public.notification_templates from anon, authenticated;
grant select on public.notification_templates to authenticated;
create trigger notification_templates_updated_at before update on public.notification_templates for each row execute function private.touch_updated_at();
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create trigger notifications_updated_at before update on public.notifications for each row execute function private.touch_updated_at();
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
create trigger reviews_updated_at before update on public.reviews for each row execute function private.touch_updated_at();
alter table public.quality_alerts enable row level security;
revoke all on public.quality_alerts from anon, authenticated;
grant select on public.quality_alerts to authenticated;
create trigger quality_alerts_updated_at before update on public.quality_alerts for each row execute function private.touch_updated_at();
alter table public.issues enable row level security;
revoke all on public.issues from anon, authenticated;
grant select on public.issues to authenticated;
create trigger issues_updated_at before update on public.issues for each row execute function private.touch_updated_at();
alter table public.support_notes enable row level security;
revoke all on public.support_notes from anon, authenticated;
grant select on public.support_notes to authenticated;
create trigger support_notes_updated_at before update on public.support_notes for each row execute function private.touch_updated_at();
create trigger organization_memberships_audit after insert or update or delete on public.organization_memberships for each row execute function private.audit_change();
create trigger user_roles_audit after insert or update or delete on public.user_roles for each row execute function private.audit_change();
create trigger roles_audit after insert or update or delete on public.roles for each row execute function private.audit_change();
create trigger permissions_audit after insert or update or delete on public.permissions for each row execute function private.audit_change();
create trigger role_permissions_audit after insert or update or delete on public.role_permissions for each row execute function private.audit_change();
create trigger quotes_audit after insert or update or delete on public.quotes for each row execute function private.audit_change();
create trigger quote_versions_audit after insert or update or delete on public.quote_versions for each row execute function private.audit_change();
create trigger orders_audit after insert or update or delete on public.orders for each row execute function private.audit_change();
create trigger assignments_audit after insert or update or delete on public.assignments for each row execute function private.audit_change();
create trigger payments_audit after insert or update or delete on public.payments for each row execute function private.audit_change();
create trigger payment_transactions_audit after insert or update or delete on public.payment_transactions for each row execute function private.audit_change();
create trigger reviews_audit after insert or update or delete on public.reviews for each row execute function private.audit_change();

create policy profiles_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy organizations_member on public.organizations for select to authenticated using(private.is_member(id));
create policy branches_member on public.branches for select to authenticated using(private.is_member(organization_id));
create policy memberships_self on public.organization_memberships for select to authenticated using(profile_id=(select auth.uid()) and status='active');
create policy user_roles_self on public.user_roles for select to authenticated using(profile_id=(select auth.uid()) and private.is_member(organization_id));
create policy role_catalogue on public.roles for select to authenticated using(true);
create policy permission_catalogue on public.permissions for select to authenticated using(true);
create policy role_permission_catalogue on public.role_permissions for select to authenticated using(true);
create policy audit_staff on public.audit_logs for select to authenticated using(private.has_permission(organization_id,'audit.read'));

create function private.owns_customer(tenant uuid, customer uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.is_member(tenant) and exists(select 1 from public.customers c where c.organization_id=tenant and c.id=customer and c.profile_id=(select auth.uid()))
$$;
create function private.owns_request(tenant uuid, request uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.requests r where r.organization_id=tenant and r.id=request and private.owns_customer(tenant,r.customer_id))
$$;
revoke all on function private.owns_customer(uuid,uuid),private.owns_request(uuid,uuid) from public;
grant execute on function private.owns_customer(uuid,uuid),private.owns_request(uuid,uuid) to authenticated;
create policy customers_read on public.customers for select to authenticated using(private.owns_customer(organization_id,id) or private.has_permission(organization_id,'customers.read'));
create policy requests_read on public.requests for select to authenticated using(private.owns_customer(organization_id,customer_id) or private.has_permission(organization_id,'requests.read'));
create policy request_items_read on public.request_items for select to authenticated using(private.owns_request(organization_id,request_id) or private.has_permission(organization_id,'requests.read'));
create policy request_attachments_read on public.request_attachments for select to authenticated using(private.owns_request(organization_id,request_id) or private.has_permission(organization_id,'requests.read'));
create policy file_objects_read on public.file_objects for select to authenticated using((owner_profile_id=(select auth.uid()) and private.is_member(organization_id)) or private.has_permission(organization_id,'files.read'));
create policy notifications_self on public.notifications for select to authenticated using(recipient_profile_id=(select auth.uid()) and private.is_member(organization_id));
create policy drivers_staff_read on public.drivers for select to authenticated using(private.has_permission(organization_id,'fleet.read'));
create policy vehicles_staff_read on public.vehicles for select to authenticated using(private.has_permission(organization_id,'fleet.read'));
create policy teams_staff_read on public.teams for select to authenticated using(private.has_permission(organization_id,'fleet.read'));
create policy services_staff_read on public.services for select to authenticated using(private.has_permission(organization_id,'services.read'));
create policy service_areas_staff_read on public.service_areas for select to authenticated using(private.has_permission(organization_id,'services.read'));
create policy quotes_staff_read on public.quotes for select to authenticated using(private.has_permission(organization_id,'quotes.read'));
create policy quote_versions_staff_read on public.quote_versions for select to authenticated using(private.has_permission(organization_id,'quotes.read'));
create policy quote_items_staff_read on public.quote_items for select to authenticated using(private.has_permission(organization_id,'quotes.read'));
create policy orders_staff_read on public.orders for select to authenticated using(private.has_permission(organization_id,'orders.read'));
create policy jobs_staff_read on public.jobs for select to authenticated using(private.has_permission(organization_id,'trips.read'));
create policy trips_staff_read on public.trips for select to authenticated using(private.has_permission(organization_id,'trips.read'));
create policy trip_stops_staff_read on public.trip_stops for select to authenticated using(private.has_permission(organization_id,'trips.read'));
create policy trip_events_staff_read on public.trip_events for select to authenticated using(private.has_permission(organization_id,'trips.read'));
create policy assignments_staff_read on public.assignments for select to authenticated using(private.has_permission(organization_id,'trips.read'));
create policy payments_staff_read on public.payments for select to authenticated using(private.has_permission(organization_id,'finance.read'));
create policy payment_transactions_staff_read on public.payment_transactions for select to authenticated using(private.has_permission(organization_id,'finance.read'));
create policy invoices_staff_read on public.invoices for select to authenticated using(private.has_permission(organization_id,'finance.read'));
create policy notification_templates_staff_read on public.notification_templates for select to authenticated using(private.has_permission(organization_id,'notifications.manage'));
create policy reviews_staff_read on public.reviews for select to authenticated using(private.has_permission(organization_id,'quality.read'));
create policy quality_alerts_staff_read on public.quality_alerts for select to authenticated using(private.has_permission(organization_id,'quality.read'));
create policy issues_staff_read on public.issues for select to authenticated using(private.has_permission(organization_id,'support.read'));
create policy support_notes_staff_read on public.support_notes for select to authenticated using(private.has_permission(organization_id,'support.read'));

insert into public.permissions(code) values ('portal.access'),('users.manage'),('audit.read'),('customers.read'),('requests.read'),('files.read'),('fleet.read'),('services.read'),('quotes.read'),('orders.read'),('trips.read'),('finance.read'),('notifications.manage'),('quality.read'),('support.read'),('driver.access'),('account.access');
insert into public.roles(code,member_type) values('SUPER_ADMIN','staff');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='SUPER_ADMIN' and p.code in ('portal.access','users.manage','audit.read','customers.read','requests.read','files.read','fleet.read','services.read','quotes.read','orders.read','trips.read','finance.read','notifications.manage','quality.read','support.read');
insert into public.roles(code,member_type) values('SALES','staff');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='SALES' and p.code in ('portal.access','customers.read','requests.read','quotes.read','services.read');
insert into public.roles(code,member_type) values('OPERATIONS','staff');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='OPERATIONS' and p.code in ('portal.access','requests.read','orders.read','trips.read','fleet.read','services.read');
insert into public.roles(code,member_type) values('DISPATCHER','staff');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='DISPATCHER' and p.code in ('portal.access','orders.read','trips.read','fleet.read');
insert into public.roles(code,member_type) values('FINANCE','staff');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='FINANCE' and p.code in ('portal.access','finance.read');
insert into public.roles(code,member_type) values('CUSTOMER_SERVICE','staff');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='CUSTOMER_SERVICE' and p.code in ('portal.access','customers.read','requests.read','support.read');
insert into public.roles(code,member_type) values('DRIVER','driver');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='DRIVER' and p.code in ('driver.access');
insert into public.roles(code,member_type) values('CUSTOMER','customer');
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='CUSTOMER' and p.code in ('account.access');
