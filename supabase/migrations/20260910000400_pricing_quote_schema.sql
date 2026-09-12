-- Phase 2: pricing and commercial quote schema. No tenant or business data seeds.
create table public.vehicle_pricing_classes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check(code ~ '^[a-z0-9-]{1,60}$'), name_ar text not null check(length(name_ar) between 1 and 120),
 name_en text not null check(length(name_en) between 1 and 120), active boolean not null default false,
 unique(organization_id,id), unique(organization_id,code),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.pricing_settings (
 organization_id uuid primary key references public.organizations(id), currency text not null default 'SAR' check(currency='SAR'),
 vat_rate_bps integer not null check(vat_rate_bps between 0 and 10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.pricing_rules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check(code ~ '^[a-z0-9-]{1,80}$'), version integer not null check(version>0),
 component_code text not null check(component_code in ('SERVICE','DISTANCE','VEHICLE','WORKERS','LOADING','UNLOADING','FLOOR_ACCESS','ELEVATOR','PACKING','DISASSEMBLY','ASSEMBLY','WITHIN_CITY','INTERCITY')),
 selector_code text, calculation_method text not null check(calculation_method in ('FIXED','PER_KM','PER_UNIT')),
 amount_minor bigint not null check(amount_minor>=0), active boolean not null default false,
 effective_from timestamptz not null default now(), effective_until timestamptz,
 label_ar text not null check(length(label_ar) between 1 and 120), label_en text not null check(length(label_en) between 1 and 120),
 unique(organization_id,id), unique(organization_id,code,version),
 check(effective_until is null or effective_until>effective_from),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index pricing_rules_effective_idx on public.pricing_rules(organization_id,active,effective_from,effective_until);

create table public.distance_snapshots (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 request_id uuid not null, revision integer not null check(revision>0),
 distance_km numeric(10,3) not null check(distance_km>0 and distance_km<=5000),
 unit text not null default 'km' check(unit='km'), source_type text not null check(source_type in ('MANUAL_VERIFIED','ROUTING_PROVIDER')),
 verified_by uuid not null, verified_at timestamptz not null default now(),
 source_note text check(source_note is null or length(source_note)<=300),
 foreign key(organization_id,request_id) references public.requests(organization_id,id),
 foreign key(organization_id,verified_by) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,id), unique(organization_id,request_id,revision),
 created_at timestamptz not null default now()
);
create index distance_snapshots_request_idx on public.distance_snapshots(organization_id,request_id,revision desc);

create table public.pricing_evaluations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 request_id uuid not null, distance_snapshot_id uuid not null, request_revision integer not null check(request_revision>=0),
 route_scope text not null check(route_scope in ('WITHIN_CITY','INTERCITY')),
 vehicle_class_id uuid not null, worker_count integer not null check(worker_count between 1 and 50),
 status text not null default 'CURRENT' check(status in ('CURRENT','STALE','QUOTED')),
 currency text not null default 'SAR' check(currency='SAR'), calculated_subtotal_minor bigint not null check(calculated_subtotal_minor>=0),
 calculated_by uuid not null, calculated_at timestamptz not null default now(),
 mutation_id uuid not null,
 foreign key(organization_id,request_id) references public.requests(organization_id,id),
 foreign key(organization_id,distance_snapshot_id) references public.distance_snapshots(organization_id,id),
 foreign key(organization_id,vehicle_class_id) references public.vehicle_pricing_classes(organization_id,id),
 foreign key(organization_id,calculated_by) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,id), unique(organization_id,calculated_by,mutation_id),
 created_at timestamptz not null default now()
);
create unique index pricing_evaluations_current_idx on public.pricing_evaluations(organization_id,request_id) where status='CURRENT';
create index pricing_evaluations_request_idx on public.pricing_evaluations(organization_id,request_id,calculated_at desc);

create table public.pricing_evaluation_components (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 evaluation_id uuid not null, pricing_rule_id uuid not null, pricing_rule_version integer not null check(pricing_rule_version>0),
 component_code text not null, label_ar text not null, label_en text not null,
 quantity numeric(12,3) not null check(quantity>0), unit_amount_minor bigint not null check(unit_amount_minor>=0),
 total_amount_minor bigint not null check(total_amount_minor>=0), position integer not null check(position between 0 and 99),
 foreign key(organization_id,evaluation_id) references public.pricing_evaluations(organization_id,id),
 foreign key(organization_id,pricing_rule_id) references public.pricing_rules(organization_id,id),
 unique(organization_id,id), unique(organization_id,evaluation_id,position),
 created_at timestamptz not null default now()
);
create index pricing_components_evaluation_idx on public.pricing_evaluation_components(organization_id,evaluation_id,position);

alter table public.quotes
 add column reference text unique check(reference is null or reference ~ '^Q-N365-[0-9]{6}-[0-9]{6,}$'),
 add constraint quotes_request_unique unique(organization_id,request_id);

alter table public.quote_versions
 add column distance_km numeric(10,3) check(distance_km is null or distance_km>0 and distance_km<=5000),
 add column distance_source text check(distance_source is null or distance_source in ('MANUAL_VERIFIED','ROUTING_PROVIDER')),
 add column distance_verified_at timestamptz,
 add column status text not null default 'DRAFT' check(status in ('DRAFT','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED','SUPERSEDED')),
 add column currency text not null default 'SAR' check(currency='SAR'),
 add column final_subtotal_minor bigint not null default 0 check(final_subtotal_minor>=0),
 add column vat_rate_bps integer not null default 0 check(vat_rate_bps between 0 and 10000),
 add column vat_amount_minor bigint not null default 0 check(vat_amount_minor>=0),
 add column total_minor bigint not null default 0 check(total_minor>=0),
 add column validity_seconds integer not null default 172800 check(validity_seconds between 1 and 2592000),
 add column expires_at timestamptz,
 add column sent_at timestamptz, add column viewed_at timestamptz,
 add column accepted_at timestamptz, add column rejected_at timestamptz,
 add column rejection_reason text check(rejection_reason is null or length(rejection_reason)<=500),
 add constraint quote_amount_equation check(vat_amount_minor=((final_subtotal_minor*vat_rate_bps+5000)/10000) and total_minor=final_subtotal_minor+vat_amount_minor),
 add constraint quote_timeline_consistency check((status='DRAFT' and sent_at is null and expires_at is null) or (status<>'DRAFT' and sent_at is not null and expires_at is not null)),
 add constraint quote_distance_consistency check(status='DRAFT' or (distance_km is not null and distance_source is not null and distance_verified_at is not null));
create index quote_versions_status_idx on public.quote_versions(organization_id,status,updated_at desc);
create unique index quote_versions_open_draft_idx on public.quote_versions(organization_id,quote_id) where status='DRAFT';

create table public.quote_pricing_details (
 quote_version_id uuid primary key, organization_id uuid not null references public.organizations(id), evaluation_id uuid not null,
 calculated_subtotal_minor bigint not null check(calculated_subtotal_minor>=0), manual_adjustment_minor bigint not null,
 adjustment_reason text check(adjustment_reason is null or length(adjustment_reason) between 1 and 500), created_by uuid not null, sent_by uuid,
 foreign key(organization_id,quote_version_id) references public.quote_versions(organization_id,id) on delete cascade,
 foreign key(organization_id,evaluation_id) references public.pricing_evaluations(organization_id,id),
 foreign key(organization_id,created_by) references public.organization_memberships(organization_id,profile_id),
 foreign key(organization_id,sent_by) references public.organization_memberships(organization_id,profile_id),
 unique(organization_id,quote_version_id), unique(organization_id,evaluation_id),
 check(manual_adjustment_minor=0 or adjustment_reason is not null),
 created_at timestamptz not null default now()
);

alter table public.quote_items
 add column component_code text not null default 'LEGACY',
 add column label_ar text not null default 'بند', add column label_en text not null default 'Item',
 add column quantity numeric(12,3) not null default 1 check(quantity>0),
 add column unit_amount_minor bigint not null default 0,
 add column total_amount_minor bigint not null default 0,
 add column position integer not null default 0 check(position between 0 and 99),
 add constraint quote_items_position_unique unique(organization_id,quote_version_id,position);

alter table public.orders
 add column reference text unique check(reference ~ '^O-N365-[0-9]{6}-[0-9]{6,}$'),
 add column request_id uuid, add column customer_id uuid,
 add column distance_km numeric(10,3) check(distance_km is null or distance_km>0 and distance_km<=5000),
 add column distance_source text check(distance_source is null or distance_source in ('MANUAL_VERIFIED','ROUTING_PROVIDER')),
 add column currency text not null default 'SAR' check(currency='SAR'),
 add column subtotal_minor bigint not null default 0 check(subtotal_minor>=0),
 add column vat_amount_minor bigint not null default 0 check(vat_amount_minor>=0),
 add column total_minor bigint not null default 0 check(total_minor>=0),
 add column accepted_at timestamptz,
 add constraint orders_request_fk foreign key(organization_id,request_id) references public.requests(organization_id,id),
 add constraint orders_customer_fk foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 add constraint order_commercial_consistency check(accepted_at is null or (reference is not null and request_id is not null and customer_id is not null and distance_km is not null and distance_source is not null));
create index orders_customer_idx on public.orders(organization_id,customer_id,created_at desc);
create index orders_request_idx on public.orders(organization_id,request_id);

create table private.commercial_reference_counters (
 kind text not null check(kind in ('quote','order')), month text not null check(month ~ '^[0-9]{6}$'),
 value bigint not null check(value>0), primary key(kind,month)
);
revoke all on private.commercial_reference_counters from public,anon,authenticated;
