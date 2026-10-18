-- Wave 6D-1A: additive, private, unconfigured catalog foundation only.
-- No role grants, scope/product/price seeds, public UI, money execution or Storage.
create table private.store_policy_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 market_id uuid not null, currency text not null check(currency='EGP'),
 kind text not null check(kind in ('STOREFRONT_SCOPE','PUBLICATION_IDENTITY','RETAIL_PRESENTATION','DELIVERY_PRESENTATION','RETURNS_PRESENTATION')),
 policy_code text not null check(policy_code ~ '^[a-z0-9][a-z0-9_-]{0,79}$'), version integer not null check(version>0),
 content jsonb not null, evidence_ref text, status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','REVOKED')),
 scope_paused boolean not null default true,
 effective_from timestamptz not null, effective_until timestamptz,
 approved_by uuid references public.profiles(id), approved_at timestamptz,
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from),
 check(status='DRAFT' or (approved_by is not null and approved_at is not null and evidence_ref is not null and length(evidence_ref) between 1 and 200)),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 unique(organization_id,id), unique(organization_id,market_id,currency,id), unique(organization_id,market_id,currency,kind,policy_code,version)
);
-- A paused scope retains its unique identity. Time is not an index predicate.
create unique index store_one_scope on private.store_policy_versions(kind) where kind='STOREFRONT_SCOPE' and status='APPROVED';
create table private.store_suppliers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 reference text not null check(reference ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'),
 name text not null check(length(name) between 1 and 200), status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED')),
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,reference)
);
create table private.store_supplier_agreements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), market_id uuid not null,
 currency text not null check(currency='EGP'), supplier_id uuid not null, agreement_code text not null check(length(agreement_code) between 1 and 80),
 version integer not null check(version>0), terms jsonb not null, evidence_ref text,
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','REVOKED')),
 effective_from timestamptz not null, effective_until timestamptz, approved_by uuid references public.profiles(id), approved_at timestamptz,
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from),
 check(status='DRAFT' or (approved_by is not null and approved_at is not null and evidence_ref is not null and length(evidence_ref) between 1 and 200)),
 foreign key(organization_id,supplier_id) references private.store_suppliers(organization_id,id),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 unique(organization_id,id), unique(organization_id,market_id,currency,id), unique(organization_id,market_id,currency,supplier_id,id),
 unique(organization_id,market_id,currency,supplier_id,agreement_code,version)
);
create table private.store_categories (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), parent_id uuid,
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'), draft_content jsonb not null, public_content jsonb, public_parent_id uuid,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','SUSPENDED')),
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(parent_id is distinct from id), check(status<>'PUBLISHED' or public_content is not null),
 unique(organization_id,id), unique(organization_id,slug),
 foreign key(organization_id,parent_id) references private.store_categories(organization_id,id),
 foreign key(organization_id,public_parent_id) references private.store_categories(organization_id,id)
);
create table private.store_products (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), category_id uuid not null,
 sku text not null check(sku ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'), slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
 draft_content jsonb not null, status text not null default 'ACTIVE' check(status in ('ACTIVE','SUSPENDED')),
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,sku), unique(organization_id,slug),
 foreign key(organization_id,category_id) references private.store_categories(organization_id,id)
);
create table private.store_product_market_listings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), market_id uuid not null,
 currency text not null check(currency='EGP'), product_id uuid not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','SUSPENDED')),
 selected_price_id uuid, selected_offer_id uuid, identity_policy_id uuid, delivery_policy_id uuid, returns_policy_id uuid,
 published_content jsonb, published_product_revision bigint, published_category_id uuid,
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'PUBLISHED' or (selected_price_id is not null and selected_offer_id is not null and identity_policy_id is not null
 and delivery_policy_id is not null and returns_policy_id is not null and published_content is not null and published_product_revision is not null and published_category_id is not null)),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 foreign key(organization_id,product_id) references private.store_products(organization_id,id),
 foreign key(organization_id,published_category_id) references private.store_categories(organization_id,id),
 foreign key(organization_id,market_id,currency,identity_policy_id) references private.store_policy_versions(organization_id,market_id,currency,id),
 foreign key(organization_id,market_id,currency,delivery_policy_id) references private.store_policy_versions(organization_id,market_id,currency,id),
 foreign key(organization_id,market_id,currency,returns_policy_id) references private.store_policy_versions(organization_id,market_id,currency,id),
 unique(organization_id,id), unique(organization_id,market_id,currency,id), unique(organization_id,market_id,product_id)
);
create table private.store_supplier_offers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), market_id uuid not null,
 currency text not null check(currency='EGP'), product_id uuid not null, supplier_id uuid not null, agreement_id uuid not null,
 offer_key text not null check(length(offer_key) between 1 and 80), version integer not null check(version>0),
 unit_cost_minor bigint check(unit_cost_minor between 0 and 9007199254740991), evidence_ref text,
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','REVOKED')),
 effective_from timestamptz not null, effective_until timestamptz, approved_by uuid references public.profiles(id), approved_at timestamptz,
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from),
 check(status='DRAFT' or (unit_cost_minor is not null and approved_by is not null and approved_at is not null and evidence_ref is not null and length(evidence_ref) between 1 and 200)),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 foreign key(organization_id,product_id) references private.store_products(organization_id,id),
 foreign key(organization_id,supplier_id) references private.store_suppliers(organization_id,id),
 foreign key(organization_id,market_id,currency,supplier_id,agreement_id) references private.store_supplier_agreements(organization_id,market_id,currency,supplier_id,id),
 unique(organization_id,id), unique(organization_id,market_id,currency,id), unique(organization_id,market_id,currency,product_id,id),
 unique(organization_id,market_id,currency,supplier_id,product_id,offer_key,version)
);
create table private.store_market_prices (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), market_id uuid not null,
 currency text not null check(currency='EGP'), listing_id uuid not null, version integer not null check(version>0),
 amount_minor bigint check(amount_minor between 1 and 9007199254740991), presentation_policy_id uuid not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','REVOKED')),
 effective_from timestamptz not null, effective_until timestamptz, approved_by uuid references public.profiles(id), approved_at timestamptz,
 revision bigint not null default 1 check(revision>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(effective_until is null or effective_until>effective_from), check(status='DRAFT' or (amount_minor is not null and approved_by is not null and approved_at is not null)),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 foreign key(organization_id,market_id,currency,listing_id) references private.store_product_market_listings(organization_id,market_id,currency,id),
 foreign key(organization_id,market_id,currency,presentation_policy_id) references private.store_policy_versions(organization_id,market_id,currency,id),
 unique(organization_id,id), unique(organization_id,market_id,currency,id), unique(organization_id,market_id,currency,listing_id,id),
 unique(organization_id,market_id,currency,listing_id,version)
);
alter table private.store_product_market_listings add foreign key(organization_id,market_id,currency,id,selected_price_id)
 references private.store_market_prices(organization_id,market_id,currency,listing_id,id);
alter table private.store_product_market_listings add foreign key(organization_id,market_id,currency,product_id,selected_offer_id)
 references private.store_supplier_offers(organization_id,market_id,currency,product_id,id);
create table private.store_command_receipts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 actor_subject uuid not null, family text not null check(family in ('draft','sourcing','policy','publication')),
 contract_version integer not null check(contract_version=1), mutation_id uuid not null,
 intent_digest text not null check(length(intent_digest)=64), outcome jsonb not null,
 created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,actor_subject,family,contract_version,mutation_id)
);
create table private.store_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 command_receipt_id uuid not null, actor_subject uuid not null, operation text not null check(length(operation) between 1 and 80),
 policy_id uuid, supplier_id uuid, agreement_id uuid, category_id uuid, product_id uuid, listing_id uuid, offer_id uuid, price_id uuid,
 prior_revision bigint, revision bigint not null check(revision>0), sourcing_sensitive boolean not null,
 previous_public_snapshot jsonb, public_snapshot jsonb,
 previous_selection jsonb, selected_versions jsonb,
 occurred_at timestamptz not null default now(),
 check(num_nonnulls(policy_id,supplier_id,agreement_id,category_id,product_id,listing_id,offer_id,price_id)=1),
 foreign key(organization_id,command_receipt_id) references private.store_command_receipts(organization_id,id),
 foreign key(organization_id,policy_id) references private.store_policy_versions(organization_id,id),
 foreign key(organization_id,supplier_id) references private.store_suppliers(organization_id,id),
 foreign key(organization_id,agreement_id) references private.store_supplier_agreements(organization_id,id),
 foreign key(organization_id,category_id) references private.store_categories(organization_id,id),
 foreign key(organization_id,product_id) references private.store_products(organization_id,id),
 foreign key(organization_id,listing_id) references private.store_product_market_listings(organization_id,id),
 foreign key(organization_id,offer_id) references private.store_supplier_offers(organization_id,id),
 foreign key(organization_id,price_id) references private.store_market_prices(organization_id,id),
 unique(organization_id,id), unique(command_receipt_id)
);
create index store_category_parent on private.store_categories(organization_id,parent_id);
create index store_product_category on private.store_products(organization_id,category_id,id);
create index store_listing_state on private.store_product_market_listings(organization_id,market_id,status,id);
create index store_offer_agreement on private.store_supplier_offers(organization_id,agreement_id);
create index store_price_policy on private.store_market_prices(organization_id,presentation_policy_id);
create index store_events_page on private.store_events(organization_id,occurred_at desc,id desc);
create index store_receipts_actor on private.store_command_receipts(actor_subject,organization_id);

insert into public.permissions(code) values
 ('store.catalog.read'),('store.catalog.manage'),('store.catalog.publish'),('store.sourcing.manage'),
 ('store.supplier_cost.read'),('store.catalog.policy.manage'),('store.catalog.policy.approve') on conflict(code) do nothing;

-- All ACLs below are Store-only. No policy grants clients direct private-table access.
do $$ declare t text; begin
 foreach t in array array['store_policy_versions','store_suppliers','store_supplier_agreements','store_categories','store_products',
 'store_product_market_listings','store_supplier_offers','store_market_prices','store_events','store_command_receipts'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 if exists(select 1 from pg_roles where rolname='service_role') then execute format('revoke all on private.%I from service_role',t); end if;
 end loop;
end $$;

create function private.store_keys(v jsonb, required text[], optional text[] default '{}') returns boolean
 language sql immutable set search_path='' as $$
 select case when jsonb_typeof(v) is distinct from 'object' then false else
 v ?& required and not exists(select 1 from jsonb_object_keys(v) k where not k=any(required||optional)) end
$$;
create function private.store_text(v jsonb, max_length integer) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}') between 1 and max_length and (v#>>'{}') !~ '[<>\x00-\x08]',false)
$$;
create function private.store_content_ok(v jsonb, product boolean default false) returns boolean language sql immutable set search_path='' as $$
 select coalesce(private.store_keys(v,array['title_ar','title_en'],case when product then array['description_ar','description_en','specifications'] else '{}'::text[] end)
 and private.store_text(v->'title_ar',200) and private.store_text(v->'title_en',200)
 and (not v?'description_ar' or private.store_text(v->'description_ar',4000))
 and (not v?'description_en' or private.store_text(v->'description_en',4000))
 and (not v?'specifications' or (jsonb_typeof(v->'specifications')='array' and jsonb_array_length(v->'specifications')<=30
 and not exists(select 1 from jsonb_array_elements(v->'specifications') x where not private.store_keys(x,array['label_ar','label_en','value_ar','value_en'])
 or not private.store_text(x->'label_ar',200) or not private.store_text(x->'label_en',200) or not private.store_text(x->'value_ar',500) or not private.store_text(x->'value_en',500)))),false)
$$;
create function private.store_policy_ok(k text,v jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when k='STOREFRONT_SCOPE' then private.store_keys(v,array['publication_enabled']) and jsonb_typeof(v->'publication_enabled')='boolean'
 else private.store_keys(v,array['title_ar','title_en','body_ar','body_en']) and private.store_content_ok(v-array['body_ar','body_en'])
 and private.store_text(v->'body_ar',4000) and private.store_text(v->'body_en',4000) end
$$;

-- Auth/session subject snapshots in receipts/events deliberately have no profile FK:
-- they are identifiers, not authority; no new restriction on Auth account deletion.
create function private.store_row_guard() returns trigger language plpgsql set search_path='' as $$
declare a jsonb=to_jsonb(new); b jsonb; lock_org uuid; bad boolean;
begin
 if tg_op='DELETE' then raise exception 'Store history is retained' using errcode='55000'; end if;
 lock_org=new.organization_id;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('naql365:store:catalog:v1:'||lock_org::text,0));
 if a?'market_id' and not exists(select 1 from public.markets m where m.organization_id=lock_org and m.id=(a->>'market_id')::uuid and m.country_code='EG' and m.currency='EGP') then
 raise exception 'Invalid Store context' using errcode='22023'; end if;
 if tg_op='UPDATE' then
 b=to_jsonb(old);
 if tg_table_name in ('store_events','store_command_receipts') then raise exception 'Store history is immutable' using errcode='55000'; end if;
 if new.revision<>old.revision+1 then raise exception 'Store revision conflict' using errcode='PT409'; end if;
 if exists(select 1 from jsonb_each(b) e where e.key=any(array['id','organization_id','market_id','currency','created_at','sku','slug','reference','supplier_id','product_id','listing_id','agreement_id','kind','policy_code','agreement_code','offer_key','version']) and a->e.key is distinct from e.value) then
 raise exception 'Store identity is immutable' using errcode='55000'; end if;
 if b->>'status' in ('APPROVED','REVOKED') and not (tg_table_name='store_policy_versions' and b->>'kind'='STOREFRONT_SCOPE'
 and b->>'status'='APPROVED' and a->>'status'='APPROVED' and (a-array['scope_paused','revision','updated_at'])=(b-array['scope_paused','revision','updated_at'])) and
 ((a-array['status','revision','updated_at']) is distinct from (b-array['status','revision','updated_at']) or a->>'status'<>'REVOKED' or b->>'status'='REVOKED') then
 raise exception 'Approved Store version is immutable' using errcode='55000'; end if;
 new.updated_at=clock_timestamp();
 end if;
 if tg_table_name='store_policy_versions' and not private.store_policy_ok(a->>'kind',a->'content') then raise exception 'Invalid Store policy' using errcode='22023'; end if;
 if tg_table_name='store_supplier_agreements' and not (private.store_keys(a->'terms',array['reference','summary']) and private.store_text(a->'terms'->'reference',200) and private.store_text(a->'terms'->'summary',4000)) then raise exception 'Invalid agreement terms' using errcode='22023'; end if;
 if tg_table_name in ('store_products','store_categories') and not private.store_content_ok(a->'draft_content',tg_table_name='store_products') then raise exception 'Invalid Store content' using errcode='22023'; end if;
 if tg_table_name='store_categories' then
 -- Check the entire bounded tree, including descendants affected by a draft reparent.
 with recursive tree as (
 select id,case when id=new.id then new.parent_id else parent_id end parent_id from private.store_categories where organization_id=lock_org and id<>new.id
 union all select new.id,new.parent_id
 ), paths as (
 select id,parent_id,array[id] seen,false cycle,1 depth from tree
 union all select p.id,t.parent_id,p.seen||t.id,t.id=any(p.seen),p.depth+1 from paths p join tree t on t.id=p.parent_id where not p.cycle and p.depth<=4
 ) select exists(select 1 from paths where cycle or depth>4) into bad;
 if bad then raise exception 'Invalid category hierarchy' using errcode='22023'; end if;
 with recursive tree as (
 select id,public_parent_id parent_id from private.store_categories where organization_id=lock_org and id<>new.id
 union all select new.id,new.public_parent_id
 ), paths as (
 select id,parent_id,array[id] seen,false cycle,1 depth from tree
 union all select p.id,t.parent_id,p.seen||t.id,t.id=any(p.seen),p.depth+1 from paths p join tree t on t.id=p.parent_id where not p.cycle and p.depth<=4
 ) select exists(select 1 from paths where cycle or depth>4) into bad;
 if bad then raise exception 'Invalid published hierarchy' using errcode='22023'; end if;
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['store_policy_versions','store_suppliers','store_supplier_agreements','store_categories','store_products','store_product_market_listings','store_supplier_offers','store_market_prices','store_events','store_command_receipts'] loop
 execute format('create trigger store_integrity before insert or update or delete on private.%I for each row execute function private.store_row_guard()',t);
 end loop;
end $$;

-- The context is resolved, never selected by a caller. VOLATILE guards obtain fresh
-- read-committed snapshots after advisory-lock waits; replays are reauthorized.
create function private.store_scope() returns private.store_policy_versions language plpgsql stable security definer set search_path='' as $$
declare s private.store_policy_versions; begin
 select * into s from private.store_policy_versions where kind='STOREFRONT_SCOPE' and status='APPROVED';
 if s.id is null then raise exception 'Store scope unavailable' using errcode='PT409'; end if;
 if not exists(select 1 from public.markets m where m.id=s.market_id and m.organization_id=s.organization_id and m.country_code='EG' and m.currency='EGP') then raise exception 'Store scope unavailable' using errcode='PT409'; end if;
 return s;
end $$;
create function private.store_staff(p_org uuid,p_market uuid,grants text[]) returns void language plpgsql volatile security definer set search_path='' as $$
declare s private.store_policy_versions; begin
 if auth.uid() is null then raise exception 'Store access denied' using errcode='42501'; end if;
 s=private.store_scope();
 if p_org is distinct from s.organization_id or p_market is distinct from s.market_id then raise exception 'Store access denied' using errcode='42501'; end if;
 if (select count(*) from public.organization_memberships where profile_id=auth.uid() and status='active')<>1 or not exists(
 select 1 from public.organization_memberships where organization_id=s.organization_id and profile_id=auth.uid() and member_type='staff' and status='active')
 or not private.has_permission(s.organization_id,'portal.access') or exists(select 1 from unnest(grants||array['store.catalog.read']) g where not private.has_permission(s.organization_id,g)) then
 raise exception 'Store access denied' using errcode='42501'; end if;
end $$;
create function private.store_policy_eligible(p_org uuid,p_market uuid,p_id uuid,p_kind text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.store_policy_versions where id=p_id and organization_id=p_org and market_id=p_market and currency='EGP' and kind=p_kind and status='APPROVED' and effective_from<=statement_timestamp() and (effective_until is null or effective_until>statement_timestamp()))
$$;
create function private.store_category_eligible(p_org uuid,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 with recursive c as (
 select id,public_parent_id as parent_id,status,public_content,1 depth from private.store_categories where organization_id=p_org and id=p_id
 union all select a.id,a.public_parent_id,a.status,a.public_content,c.depth+1 from c join private.store_categories a on a.organization_id=p_org and a.id=c.parent_id where c.depth<=4
 ) select exists(select 1 from c) and not exists(select 1 from c where status<>'PUBLISHED' or public_content is null or depth>4)
$$;
create function private.store_listing_eligible(p_org uuid,p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.store_product_market_listings l
 join private.store_products p on p.organization_id=l.organization_id and p.id=l.product_id
 join public.markets m on m.organization_id=l.organization_id and m.id=l.market_id and m.country_code='EG' and m.currency='EGP' and m.active
 join private.store_market_prices r on r.organization_id=l.organization_id and r.id=l.selected_price_id and r.listing_id=l.id and r.status='APPROVED'
 join private.store_supplier_offers o on o.organization_id=l.organization_id and o.id=l.selected_offer_id and o.product_id=l.product_id and o.status='APPROVED'
 join private.store_suppliers s on s.organization_id=l.organization_id and s.id=o.supplier_id and s.status='ACTIVE'
 join private.store_supplier_agreements a on a.organization_id=l.organization_id and a.id=o.agreement_id and a.supplier_id=o.supplier_id and a.status='APPROVED'
 join private.store_policy_versions scope on scope.organization_id=l.organization_id and scope.market_id=l.market_id and scope.kind='STOREFRONT_SCOPE' and scope.status='APPROVED'
 where l.organization_id=p_org and l.id=p_id and l.status='PUBLISHED' and p.status='ACTIVE'
 and scope.content->'publication_enabled'='true'::jsonb and not scope.scope_paused and scope.effective_from<=statement_timestamp() and (scope.effective_until is null or scope.effective_until>statement_timestamp())
 and private.store_category_eligible(p_org,l.published_category_id)
 and r.effective_from<=statement_timestamp() and (r.effective_until is null or r.effective_until>statement_timestamp())
 and o.effective_from<=statement_timestamp() and (o.effective_until is null or o.effective_until>statement_timestamp())
 and a.effective_from<=statement_timestamp() and (a.effective_until is null or a.effective_until>statement_timestamp())
 and private.store_policy_eligible(p_org,l.market_id,r.presentation_policy_id,'RETAIL_PRESENTATION')
 and private.store_policy_eligible(p_org,l.market_id,l.identity_policy_id,'PUBLICATION_IDENTITY')
 and private.store_policy_eligible(p_org,l.market_id,l.delivery_policy_id,'DELIVERY_PRESENTATION')
 and private.store_policy_eligible(p_org,l.market_id,l.returns_policy_id,'RETURNS_PRESENTATION'))
$$;

create function private.store_command_v1(p_family text,p_org uuid,p_market uuid,p_operation text,p_mutation uuid,p_target uuid,p_expected bigint,p_payload jsonb,p_version integer)
 returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare required_grants text[]; entity text; digest text; receipt private.store_command_receipts; rid uuid=gen_random_uuid();
 target uuid; old_revision bigint; new_revision bigint; current_state text; outcome jsonb; current_row jsonb;
 l private.store_product_market_listings; p private.store_products; price private.store_market_prices; offer private.store_supplier_offers;
 ident uuid; delivery uuid; returns_policy uuid; prev integer; cat private.store_categories; path jsonb; field record;
begin
 -- Family/operation is closed before even resolving a target or returning a replay.
 if p_family='draft' then
 required_grants=array['store.catalog.manage'];
 if p_operation not in ('create_category','save_category','create_product','save_product','create_listing','save_listing','create_price','save_price') then raise exception 'Invalid Store operation' using errcode='22023'; end if;
 elsif p_family='sourcing' then
 required_grants=array['store.sourcing.manage','store.supplier_cost.read'];
 if p_operation not in ('create_supplier','save_supplier','suspend_supplier','resume_supplier','create_agreement','save_agreement','approve_agreement','revoke_agreement','create_offer','save_offer','approve_offer','revoke_offer') then raise exception 'Invalid Store operation' using errcode='22023'; end if;
 elsif p_family='policy' then
 required_grants=array['store.catalog.policy.manage'];
 if p_operation not in ('create_policy','save_policy','approve_policy','revoke_policy') then raise exception 'Invalid Store operation' using errcode='22023'; end if;
 if p_operation in ('approve_policy','revoke_policy') then required_grants=required_grants||array['store.catalog.policy.approve']; end if;
 elsif p_family='publication' then
 required_grants=array['store.catalog.manage','store.catalog.publish'];
 if p_operation not in ('approve_category','suspend_category','approve_price','revoke_price','publish_listing','suspend_listing','suspend_product','resume_product') then raise exception 'Invalid Store operation' using errcode='22023'; end if;
 else raise exception 'Invalid Store operation' using errcode='22023'; end if;
 perform private.store_staff(p_org,p_market,required_grants);
 if p_version is distinct from 1 or p_mutation is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768 or p_operation is null then raise exception 'Invalid Store intent' using errcode='22023'; end if;
 for field in select * from jsonb_each(p_payload) loop
 if field.value='null'::jsonb then
 if field.key not in ('parent_id','parent_revision','effective_until','amount_minor','unit_cost_minor') then raise exception 'Invalid Store field' using errcode='22023'; end if;
 elsif field.key in ('content','terms') then
 if jsonb_typeof(field.value)<>'object' then raise exception 'Invalid Store field' using errcode='22023'; end if;
 elsif field.key in ('version','amount_minor','unit_cost_minor') or field.key like '%revision' then
 if jsonb_typeof(field.value)<>'number' or field.value::text !~ '^[0-9]+$' then raise exception 'Invalid Store integer' using errcode='22023'; end if;
 elsif not private.store_text(field.value,500) then raise exception 'Invalid Store field' using errcode='22023'; end if;
 end loop;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('naql365:store:catalog:v1:'||p_org::text,0));
 perform private.store_staff(p_org,p_market,required_grants);
 digest=encode(sha256(convert_to(jsonb_build_object('operation',p_operation,'target',p_target,'revision',p_expected,'payload',p_payload,'market',p_market,'version',p_version)::text,'UTF8')),'hex');
 select * into receipt from private.store_command_receipts where organization_id=p_org and actor_subject=auth.uid() and family=p_family and contract_version=p_version and mutation_id=p_mutation;
 if receipt.id is not null then
 if receipt.intent_digest<>digest then raise exception 'Store mutation conflict' using errcode='PT409'; end if;
 return receipt.outcome||jsonb_build_object('replayed',true);
 end if;
 entity=split_part(p_operation,'_',2); target=p_target;
 if p_operation like 'create_%' then
 if p_target is not null or p_expected is not null then raise exception 'Invalid Store create intent' using errcode='22023'; end if;
 target=gen_random_uuid();
 else
 if p_target is null or p_expected is null or p_expected<1 then raise exception 'Store revision required' using errcode='22023'; end if;
 -- The following table name comes exclusively from the operation whitelist above.
 -- No caller SQL, identifiers or arbitrary field paths are interpolated.
 case entity
 when 'category' then select to_jsonb(x) into current_row from private.store_categories x where organization_id=p_org and id=p_target for update;
 when 'product' then select to_jsonb(x) into current_row from private.store_products x where organization_id=p_org and id=p_target for update;
 when 'listing' then select to_jsonb(x) into current_row from private.store_product_market_listings x where organization_id=p_org and market_id=p_market and id=p_target for update;
 when 'price' then select to_jsonb(x) into current_row from private.store_market_prices x where organization_id=p_org and market_id=p_market and id=p_target for update;
 when 'supplier' then select to_jsonb(x) into current_row from private.store_suppliers x where organization_id=p_org and id=p_target for update;
 when 'agreement' then select to_jsonb(x) into current_row from private.store_supplier_agreements x where organization_id=p_org and market_id=p_market and id=p_target for update;
 when 'offer' then select to_jsonb(x) into current_row from private.store_supplier_offers x where organization_id=p_org and market_id=p_market and id=p_target for update;
 when 'policy' then select to_jsonb(x) into current_row from private.store_policy_versions x where organization_id=p_org and market_id=p_market and id=p_target for update;
 end case;
 if current_row is null then raise exception 'Store target unavailable' using errcode='PT404'; end if;
 old_revision=(current_row->>'revision')::bigint; current_state=current_row->>'status';
 if old_revision<>p_expected then raise exception 'Store revision conflict' using errcode='PT409'; end if;
 if entity='policy' and current_row->>'kind'='STOREFRONT_SCOPE' then raise exception 'Store scope is owner controlled' using errcode='42501'; end if;
 if p_operation like 'save_%' and entity in ('policy','agreement','offer','price') and current_state<>'DRAFT' then raise exception 'Store version is frozen' using errcode='PT409'; end if;
 end if;

 case p_operation
 when 'create_category','save_category' then
 if not private.store_keys(p_payload,case when p_operation='create_category' then array['slug','content'] else array['content'] end,array['parent_id']) then raise exception 'Invalid category payload' using errcode='22023'; end if;
 if p_operation='create_category' then
 insert into private.store_categories(id,organization_id,slug,draft_content,parent_id) values(target,p_org,p_payload->>'slug',p_payload->'content',(p_payload->>'parent_id')::uuid);
 else update private.store_categories set draft_content=p_payload->'content',parent_id=(p_payload->>'parent_id')::uuid,revision=revision+1 where id=target; end if;
 when 'create_product','save_product' then
 if not private.store_keys(p_payload,case when p_operation='create_product' then array['sku','slug','category_id','content'] else array['category_id','content'] end) then raise exception 'Invalid product payload' using errcode='22023'; end if;
 if p_operation='create_product' then insert into private.store_products(id,organization_id,sku,slug,category_id,draft_content) values(target,p_org,p_payload->>'sku',p_payload->>'slug',(p_payload->>'category_id')::uuid,p_payload->'content');
 else update private.store_products set category_id=(p_payload->>'category_id')::uuid,draft_content=p_payload->'content',revision=revision+1 where id=target; end if;
 when 'create_listing','save_listing' then
 if not private.store_keys(p_payload,case when p_operation='create_listing' then array['product_id'] else '{}'::text[] end) then raise exception 'Invalid listing payload' using errcode='22023'; end if;
 if p_operation='create_listing' then insert into private.store_product_market_listings(id,organization_id,market_id,currency,product_id) values(target,p_org,p_market,'EGP',(p_payload->>'product_id')::uuid);
 else if current_state<>'DRAFT' then raise exception 'Store listing is not draft' using errcode='PT409'; end if;
 update private.store_product_market_listings set revision=revision+1 where id=target; end if;
 when 'create_price','save_price' then
 if not private.store_keys(p_payload,case when p_operation='create_price' then array['listing_id','version','presentation_policy_id','effective_from'] else array['presentation_policy_id','effective_from'] end,array['amount_minor','effective_until']) then raise exception 'Invalid price payload' using errcode='22023'; end if;
 if p_payload?'amount_minor' and p_payload->'amount_minor'<>'null'::jsonb and (jsonb_typeof(p_payload->'amount_minor')<>'number' or p_payload->>'amount_minor' !~ '^[0-9]+$') then raise exception 'Invalid minor-unit money' using errcode='22023'; end if;
 if p_operation='create_price' then
 insert into private.store_market_prices(id,organization_id,market_id,currency,listing_id,version,amount_minor,presentation_policy_id,effective_from,effective_until)
 values(target,p_org,p_market,'EGP',(p_payload->>'listing_id')::uuid,(p_payload->>'version')::integer,(p_payload->>'amount_minor')::bigint,(p_payload->>'presentation_policy_id')::uuid,(p_payload->>'effective_from')::timestamptz,(p_payload->>'effective_until')::timestamptz);
 else update private.store_market_prices set amount_minor=(p_payload->>'amount_minor')::bigint,presentation_policy_id=(p_payload->>'presentation_policy_id')::uuid,effective_from=(p_payload->>'effective_from')::timestamptz,effective_until=(p_payload->>'effective_until')::timestamptz,revision=revision+1 where id=target; end if;
 when 'create_supplier','save_supplier' then
 if not private.store_keys(p_payload,case when p_operation='create_supplier' then array['reference','name'] else array['name'] end) then raise exception 'Invalid supplier payload' using errcode='22023'; end if;
 if p_operation='create_supplier' then insert into private.store_suppliers(id,organization_id,reference,name) values(target,p_org,p_payload->>'reference',p_payload->>'name');
 else update private.store_suppliers set name=p_payload->>'name',revision=revision+1 where id=target; end if;
 when 'create_agreement','save_agreement' then
 if not private.store_keys(p_payload,case when p_operation='create_agreement' then array['supplier_id','agreement_code','version','terms','effective_from'] else array['terms','effective_from'] end,array['evidence_ref','effective_until']) then raise exception 'Invalid agreement payload' using errcode='22023'; end if;
 if p_operation='create_agreement' then insert into private.store_supplier_agreements(id,organization_id,market_id,currency,supplier_id,agreement_code,version,terms,effective_from,effective_until,evidence_ref)
 values(target,p_org,p_market,'EGP',(p_payload->>'supplier_id')::uuid,p_payload->>'agreement_code',(p_payload->>'version')::integer,p_payload->'terms',(p_payload->>'effective_from')::timestamptz,(p_payload->>'effective_until')::timestamptz,p_payload->>'evidence_ref');
 else update private.store_supplier_agreements set terms=p_payload->'terms',effective_from=(p_payload->>'effective_from')::timestamptz,effective_until=(p_payload->>'effective_until')::timestamptz,evidence_ref=p_payload->>'evidence_ref',revision=revision+1 where id=target; end if;
 when 'create_offer','save_offer' then
 if not private.store_keys(p_payload,case when p_operation='create_offer' then array['product_id','supplier_id','agreement_id','offer_key','version','effective_from'] else array['effective_from'] end,array['unit_cost_minor','effective_until','evidence_ref']) then raise exception 'Invalid offer payload' using errcode='22023'; end if;
 if p_payload?'unit_cost_minor' and p_payload->'unit_cost_minor'<>'null'::jsonb and (jsonb_typeof(p_payload->'unit_cost_minor')<>'number' or p_payload->>'unit_cost_minor' !~ '^[0-9]+$') then raise exception 'Invalid minor-unit money' using errcode='22023'; end if;
 if p_operation='create_offer' then insert into private.store_supplier_offers(id,organization_id,market_id,currency,product_id,supplier_id,agreement_id,offer_key,version,unit_cost_minor,effective_from,effective_until,evidence_ref)
 values(target,p_org,p_market,'EGP',(p_payload->>'product_id')::uuid,(p_payload->>'supplier_id')::uuid,(p_payload->>'agreement_id')::uuid,p_payload->>'offer_key',(p_payload->>'version')::integer,(p_payload->>'unit_cost_minor')::bigint,(p_payload->>'effective_from')::timestamptz,(p_payload->>'effective_until')::timestamptz,p_payload->>'evidence_ref');
 else update private.store_supplier_offers set unit_cost_minor=(p_payload->>'unit_cost_minor')::bigint,effective_from=(p_payload->>'effective_from')::timestamptz,effective_until=(p_payload->>'effective_until')::timestamptz,evidence_ref=p_payload->>'evidence_ref',revision=revision+1 where id=target; end if;
 when 'create_policy','save_policy' then
 if not private.store_keys(p_payload,case when p_operation='create_policy' then array['kind','policy_code','version','content','effective_from'] else array['content','effective_from'] end,array['effective_until','evidence_ref']) then raise exception 'Invalid policy payload' using errcode='22023'; end if;
 if p_payload->>'kind'='STOREFRONT_SCOPE' then raise exception 'Store scope is owner controlled' using errcode='42501'; end if;
 if p_operation='create_policy' then insert into private.store_policy_versions(id,organization_id,market_id,currency,kind,policy_code,version,content,effective_from,effective_until,evidence_ref)
 values(target,p_org,p_market,'EGP',p_payload->>'kind',p_payload->>'policy_code',(p_payload->>'version')::integer,p_payload->'content',(p_payload->>'effective_from')::timestamptz,(p_payload->>'effective_until')::timestamptz,p_payload->>'evidence_ref');
 else update private.store_policy_versions set content=p_payload->'content',effective_from=(p_payload->>'effective_from')::timestamptz,effective_until=(p_payload->>'effective_until')::timestamptz,evidence_ref=p_payload->>'evidence_ref',revision=revision+1 where id=target; end if;
 when 'approve_policy','approve_agreement','approve_offer','approve_price' then
 if not private.store_keys(p_payload,'{}') or current_state<>'DRAFT' then raise exception 'Invalid Store approval' using errcode='PT409'; end if;
 if entity='policy' then update private.store_policy_versions set status='APPROVED',approved_by=auth.uid(),approved_at=clock_timestamp(),revision=revision+1 where id=target;
 elsif entity='agreement' then update private.store_supplier_agreements set status='APPROVED',approved_by=auth.uid(),approved_at=clock_timestamp(),revision=revision+1 where id=target;
 elsif entity='offer' then
 if not exists(select 1 from private.store_supplier_agreements a where a.id=(current_row->>'agreement_id')::uuid and a.organization_id=p_org and a.status='APPROVED') then raise exception 'Store source unavailable' using errcode='PT409'; end if;
 update private.store_supplier_offers set status='APPROVED',approved_by=auth.uid(),approved_at=clock_timestamp(),revision=revision+1 where id=target;
 else
 if not private.store_policy_eligible(p_org,p_market,(current_row->>'presentation_policy_id')::uuid,'RETAIL_PRESENTATION') then raise exception 'Store policy unavailable' using errcode='PT409'; end if;
 update private.store_market_prices set status='APPROVED',approved_by=auth.uid(),approved_at=clock_timestamp(),revision=revision+1 where id=target;
 end if;
 when 'revoke_policy','revoke_agreement','revoke_offer','revoke_price' then
 if not private.store_keys(p_payload,array['reason']) or not private.store_text(p_payload->'reason',500) or current_state<>'APPROVED' then raise exception 'Invalid Store revocation' using errcode='PT409'; end if;
 if entity='policy' then update private.store_policy_versions set status='REVOKED',revision=revision+1 where id=target;
 elsif entity='agreement' then update private.store_supplier_agreements set status='REVOKED',revision=revision+1 where id=target;
 elsif entity='offer' then update private.store_supplier_offers set status='REVOKED',revision=revision+1 where id=target;
 else update private.store_market_prices set status='REVOKED',revision=revision+1 where id=target; end if;
 when 'suspend_supplier','resume_supplier','suspend_product','resume_product','suspend_listing','suspend_category' then
 if not private.store_keys(p_payload,array['reason']) or not private.store_text(p_payload->'reason',500) then raise exception 'Invalid Store status payload' using errcode='22023'; end if;
 if entity='supplier' then update private.store_suppliers set status=case when p_operation='suspend_supplier' then 'SUSPENDED' else 'ACTIVE' end,revision=revision+1 where id=target;
 elsif entity='product' then update private.store_products set status=case when p_operation='suspend_product' then 'SUSPENDED' else 'ACTIVE' end,revision=revision+1 where id=target;
 elsif entity='category' then update private.store_categories set status='SUSPENDED',revision=revision+1 where id=target;
 else update private.store_product_market_listings set status='SUSPENDED',revision=revision+1 where id=target; end if;
 when 'approve_category' then
 if not private.store_keys(p_payload,array['parent_revision']) then raise exception 'Invalid category publication' using errcode='22023'; end if;
 select * into cat from private.store_categories where id=target;
 if cat.parent_id is not null then
 if not private.store_category_eligible(p_org,cat.parent_id) or not exists(select 1 from private.store_categories where id=cat.parent_id and organization_id=p_org and revision=(p_payload->>'parent_revision')::bigint) then raise exception 'Category parent changed' using errcode='PT409'; end if;
 elsif p_payload->'parent_revision'<>'null'::jsonb then raise exception 'Invalid root category publication' using errcode='22023'; end if;
 -- Frozen ancestor labels/paths, never merge a mutable draft into public output.
 select coalesce(public_content->'path','[]'::jsonb) into path from private.store_categories where id=cat.parent_id and organization_id=p_org;
 path=coalesce(path,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('slug',cat.slug,'title_ar',cat.draft_content->>'title_ar','title_en',cat.draft_content->>'title_en'));
 if jsonb_array_length(path)>4 or exists(select 1 from jsonb_array_elements(path) x group by x->>'slug' having count(*)>1) then raise exception 'Invalid category public hierarchy' using errcode='22023'; end if;
 update private.store_categories set public_content=draft_content||jsonb_build_object('path',path),public_parent_id=parent_id,status='PUBLISHED',revision=revision+1 where id=target;
 when 'publish_listing' then
 if not private.store_keys(p_payload,array['product_revision','category_revision','price_id','price_revision','offer_id','offer_revision','identity_policy_id','identity_policy_revision','delivery_policy_id','delivery_policy_revision','returns_policy_id','returns_policy_revision']) then raise exception 'Invalid listing publication' using errcode='22023'; end if;
 select * into l from private.store_product_market_listings where id=target;
 select * into p from private.store_products where organization_id=p_org and id=l.product_id;
 select * into price from private.store_market_prices where organization_id=p_org and market_id=p_market and listing_id=l.id and id=(p_payload->>'price_id')::uuid;
 select * into offer from private.store_supplier_offers where organization_id=p_org and market_id=p_market and product_id=l.product_id and id=(p_payload->>'offer_id')::uuid;
 ident=(p_payload->>'identity_policy_id')::uuid; delivery=(p_payload->>'delivery_policy_id')::uuid; returns_policy=(p_payload->>'returns_policy_id')::uuid;
 if p.revision is distinct from (p_payload->>'product_revision')::bigint or price.revision is distinct from (p_payload->>'price_revision')::bigint or offer.revision is distinct from (p_payload->>'offer_revision')::bigint
 or not exists(select 1 from private.store_categories where id=p.category_id and organization_id=p_org and revision=(p_payload->>'category_revision')::bigint)
 or not exists(select 1 from private.store_policy_versions where id=ident and revision=(p_payload->>'identity_policy_revision')::bigint)
 or not exists(select 1 from private.store_policy_versions where id=delivery and revision=(p_payload->>'delivery_policy_revision')::bigint)
 or not exists(select 1 from private.store_policy_versions where id=returns_policy and revision=(p_payload->>'returns_policy_revision')::bigint) then raise exception 'Store publication conflict' using errcode='PT409'; end if;
 update private.store_product_market_listings set status='PUBLISHED',selected_price_id=price.id,selected_offer_id=offer.id,identity_policy_id=ident,delivery_policy_id=delivery,returns_policy_id=returns_policy,
 published_content=p.draft_content||jsonb_build_object('sku',p.sku,'slug',p.slug,'category',(select public_content from private.store_categories where id=p.category_id)),published_product_revision=p.revision,published_category_id=p.category_id,revision=revision+1 where id=target;
 if not private.store_listing_eligible(p_org,target) then raise exception 'Store publication unavailable' using errcode='PT409'; end if;
 end case;
 -- Only the eight static aggregate tables participate. No private amounts/terms
 -- or caller free text are copied into audit_logs, events, errors or receipts.
 case entity
 when 'category' then select revision,status into new_revision,current_state from private.store_categories where id=target;
 when 'product' then select revision,status into new_revision,current_state from private.store_products where id=target;
 when 'listing' then select revision,status into new_revision,current_state from private.store_product_market_listings where id=target;
 when 'price' then select revision,status into new_revision,current_state from private.store_market_prices where id=target;
 when 'supplier' then select revision,status into new_revision,current_state from private.store_suppliers where id=target;
 when 'agreement' then select revision,status into new_revision,current_state from private.store_supplier_agreements where id=target;
 when 'offer' then select revision,status into new_revision,current_state from private.store_supplier_offers where id=target;
 when 'policy' then select revision,status into new_revision,current_state from private.store_policy_versions where id=target;
 end case;
 outcome=jsonb_build_object('id',target,'revision',new_revision,'state',current_state,'contractVersion',1,'replayed',false);
 insert into private.store_command_receipts(id,organization_id,actor_subject,family,contract_version,mutation_id,intent_digest,outcome)
 values(rid,p_org,auth.uid(),p_family,p_version,p_mutation,digest,outcome);
 insert into private.store_events(organization_id,command_receipt_id,actor_subject,operation,policy_id,supplier_id,agreement_id,category_id,product_id,listing_id,offer_id,price_id,prior_revision,revision,sourcing_sensitive,previous_public_snapshot,public_snapshot,previous_selection,selected_versions)
 values(p_org,rid,auth.uid(),p_operation,case when entity='policy' then target end,case when entity='supplier' then target end,case when entity='agreement' then target end,
 case when entity='category' then target end,case when entity='product' then target end,case when entity='listing' then target end,case when entity='offer' then target end,case when entity='price' then target end,old_revision,new_revision,p_family in ('sourcing','policy'),
 case when p_operation='publish_listing' then current_row->'published_content' when p_operation='approve_category' then current_row->'public_content' end,
 case when p_operation='publish_listing' then (select published_content from private.store_product_market_listings where id=target) when p_operation='approve_category' then (select public_content from private.store_categories where id=target) end,
 case when p_operation='publish_listing' then jsonb_build_object('price_id',current_row->'selected_price_id','offer_id',current_row->'selected_offer_id','identity_policy_id',current_row->'identity_policy_id','delivery_policy_id',current_row->'delivery_policy_id','returns_policy_id',current_row->'returns_policy_id','product_revision',current_row->'published_product_revision') end,
 case when p_operation='publish_listing' then jsonb_build_object('price_id',price.id,'price_version',price.version,'offer_id',offer.id,'offer_version',offer.version,'agreement_id',offer.agreement_id,'identity_policy_id',ident,'delivery_policy_id',delivery,'returns_policy_id',returns_policy,'product_revision',p.revision) end);
 return outcome;
exception
 when foreign_key_violation or unique_violation or check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
 raise exception 'Invalid or conflicting Store intent' using errcode='22023';
end $$;

create function public.store_catalog_draft_command_v1(p_org uuid,p_market uuid,p_operation text,p_mutation uuid,p_target uuid,p_expected bigint,p_payload jsonb,p_version integer default 1)
 returns jsonb language sql volatile security definer set search_path='' as $$ select private.store_command_v1('draft',p_org,p_market,p_operation,p_mutation,p_target,p_expected,p_payload,p_version) $$;
create function public.store_sourcing_command_v1(p_org uuid,p_market uuid,p_operation text,p_mutation uuid,p_target uuid,p_expected bigint,p_payload jsonb,p_version integer default 1)
 returns jsonb language sql volatile security definer set search_path='' as $$ select private.store_command_v1('sourcing',p_org,p_market,p_operation,p_mutation,p_target,p_expected,p_payload,p_version) $$;
create function public.store_catalog_policy_command_v1(p_org uuid,p_market uuid,p_operation text,p_mutation uuid,p_target uuid,p_expected bigint,p_payload jsonb,p_version integer default 1)
 returns jsonb language sql volatile security definer set search_path='' as $$ select private.store_command_v1('policy',p_org,p_market,p_operation,p_mutation,p_target,p_expected,p_payload,p_version) $$;
create function public.store_catalog_publication_command_v1(p_org uuid,p_market uuid,p_operation text,p_mutation uuid,p_target uuid,p_expected bigint,p_payload jsonb,p_version integer default 1)
 returns jsonb language sql volatile security definer set search_path='' as $$ select private.store_command_v1('publication',p_org,p_market,p_operation,p_mutation,p_target,p_expected,p_payload,p_version) $$;

-- No UI/route calls this projection in this slice. With no owner-provisioned
-- approved scope it always returns NOT_AVAILABLE, including for authenticated users.
create function public.store_catalog_public_v1(p_country text default 'EG',p_kind text default 'products',p_after text default null,p_limit integer default 20,p_search text default '',p_slug text default null)
 returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if p_country is distinct from 'EG' then return jsonb_build_object('status','NOT_AVAILABLE','items','[]'::jsonb,'nextCursor',null); end if;
 if p_kind is null or p_kind not in ('products','categories') or p_limit is null or p_limit not between 1 and 50 or p_search is null or length(p_search)>120
 or (p_after is not null and p_after !~ '^[a-z0-9][a-z0-9-]{0,99}$') or (p_slug is not null and p_slug !~ '^[a-z0-9][a-z0-9-]{0,99}$') then raise exception 'Invalid Store page' using errcode='22023'; end if;
 with scope as (
 select s.organization_id,s.market_id from private.store_policy_versions s join public.markets m on m.id=s.market_id and m.organization_id=s.organization_id and m.active and m.country_code='EG' and m.currency='EGP'
 where s.kind='STOREFRONT_SCOPE' and s.status='APPROVED' and s.content->'publication_enabled'='true'::jsonb and not s.scope_paused and s.effective_from<=statement_timestamp() and (s.effective_until is null or s.effective_until>statement_timestamp())
 ), candidates as (
 select p.slug,jsonb_build_object('slug',p.slug,'content',l.published_content,'currency','EGP','amountMinor',r.amount_minor,
 'retailPresentation',retail.content,'deliveryPresentation',delivery.content,'returnsPresentation',returns_policy.content,'identityPresentation',identity_policy.content,'media','[]'::jsonb) item
 from scope s join private.store_product_market_listings l on l.organization_id=s.organization_id and l.market_id=s.market_id
 join private.store_products p on p.id=l.product_id and p.organization_id=s.organization_id
 join private.store_market_prices r on r.id=l.selected_price_id and r.organization_id=s.organization_id
 join private.store_policy_versions retail on retail.id=r.presentation_policy_id
 join private.store_policy_versions delivery on delivery.id=l.delivery_policy_id
 join private.store_policy_versions returns_policy on returns_policy.id=l.returns_policy_id
 join private.store_policy_versions identity_policy on identity_policy.id=l.identity_policy_id
 where p_kind='products' and private.store_listing_eligible(s.organization_id,l.id)
 and (p_slug is null or p.slug=p_slug) and (p_after is null or p.slug>p_after)
 and (p_search='' or position(lower(p_search) in lower((l.published_content->>'title_ar')||' '||(l.published_content->>'title_en')))>0)
 union all
 select c.slug,jsonb_build_object('slug',c.slug,'content',c.public_content,'media','[]'::jsonb)
 from scope s join private.store_categories c on c.organization_id=s.organization_id
 where p_kind='categories' and private.store_category_eligible(s.organization_id,c.id)
 and (p_slug is null or c.slug=p_slug) and (p_after is null or c.slug>p_after)
 and (p_search='' or position(lower(p_search) in lower((c.public_content->>'title_ar')||' '||(c.public_content->>'title_en')))>0)
 ), bounded as (select * from candidates order by slug limit p_limit+1), page as (select * from bounded order by slug limit p_limit)
 select jsonb_build_object('status',case when exists(select 1 from scope) then 'AVAILABLE' else 'NOT_AVAILABLE' end,
 'items',coalesce((select jsonb_agg(item order by slug) from page),'[]'::jsonb),
 'nextCursor',case when (select count(*) from bounded)>p_limit then (select max(slug) from page) else null end) into result;
 return result;
end $$;

create function public.store_catalog_workspace_v1(p_org uuid,p_market uuid,p_kind text default 'products',p_after uuid default null,p_limit integer default 20)
 returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb; begin
 perform private.store_staff(p_org,p_market,'{}');
 if p_kind is null or p_kind not in ('products','categories','listings','prices','events','policies') or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid Store page' using errcode='22023'; end if;
 if p_kind='policies' then perform private.store_staff(p_org,p_market,array['store.catalog.policy.manage']); end if;
 -- Every branch explicitly lists safe fields. No sourcing joins or to_jsonb(row).
 with rows as (
 select x.id,jsonb_build_object('id',x.id,'sku',x.sku,'slug',x.slug,'categoryId',x.category_id,'content',x.draft_content,'state',x.status,'revision',x.revision) item
 from private.store_products x where p_kind='products' and x.organization_id=p_org
 union all select x.id,jsonb_build_object('id',x.id,'slug',x.slug,'parentId',x.parent_id,'content',x.draft_content,'publicContent',x.public_content,'state',x.status,'revision',x.revision)
 from private.store_categories x where p_kind='categories' and x.organization_id=p_org
 union all select x.id,jsonb_build_object('id',x.id,'productId',x.product_id,'state',x.status,'revision',x.revision,'publishedContent',x.published_content,'publishedProductRevision',x.published_product_revision,'eligible',private.store_listing_eligible(p_org,x.id),'selectedPriceId',x.selected_price_id)
 from private.store_product_market_listings x where p_kind='listings' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,jsonb_build_object('id',x.id,'listingId',x.listing_id,'amountMinor',x.amount_minor,'currency',x.currency,'version',x.version,'state',x.status,'revision',x.revision,'presentationPolicyId',x.presentation_policy_id,'effectiveFrom',x.effective_from,'effectiveUntil',x.effective_until)
 from private.store_market_prices x where p_kind='prices' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,jsonb_build_object('id',x.id,'kind',x.kind,'code',x.policy_code,'version',x.version,'content',x.content,'state',x.status,'revision',x.revision,'effectiveFrom',x.effective_from,'effectiveUntil',x.effective_until)
 from private.store_policy_versions x where p_kind='policies' and x.kind<>'STOREFRONT_SCOPE' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,jsonb_build_object('id',x.id,'operation',x.operation,'revision',x.revision,'occurredAt',x.occurred_at)
 from private.store_events x where p_kind='events' and x.organization_id=p_org and not x.sourcing_sensitive
 ), bounded as (select * from rows where p_after is null or id>p_after order by id limit p_limit+1), page as (select * from bounded order by id limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by id) from page),'[]'::jsonb),'nextCursor',
 case when (select count(*) from bounded)>p_limit then (select id from page order by id desc limit 1) else null end) into result;
 return result;
end $$;
create function public.store_catalog_sourcing_v1(p_org uuid,p_market uuid,p_kind text default 'offers',p_after uuid default null,p_limit integer default 20)
 returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb; begin
 perform private.store_staff(p_org,p_market,array['store.sourcing.manage','store.supplier_cost.read']);
 if p_kind is null or p_kind not in ('suppliers','agreements','offers','events') or p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid Store page' using errcode='22023'; end if;
 with rows as (
 select x.id,jsonb_build_object('id',x.id,'reference',x.reference,'name',x.name,'state',x.status,'revision',x.revision) item
 from private.store_suppliers x where p_kind='suppliers' and x.organization_id=p_org
 union all select x.id,jsonb_build_object('id',x.id,'supplierId',x.supplier_id,'agreementCode',x.agreement_code,'version',x.version,'terms',x.terms,'evidenceRef',x.evidence_ref,'state',x.status,'revision',x.revision,'effectiveFrom',x.effective_from,'effectiveUntil',x.effective_until)
 from private.store_supplier_agreements x where p_kind='agreements' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,jsonb_build_object('id',x.id,'supplierId',x.supplier_id,'productId',x.product_id,'agreementId',x.agreement_id,'offerKey',x.offer_key,'version',x.version,'unitCostMinor',x.unit_cost_minor,'currency',x.currency,'evidenceRef',x.evidence_ref,'state',x.status,'revision',x.revision,'effectiveFrom',x.effective_from,'effectiveUntil',x.effective_until)
 from private.store_supplier_offers x where p_kind='offers' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,jsonb_build_object('id',x.id,'operation',x.operation,'revision',x.revision,'occurredAt',x.occurred_at)
 from private.store_events x where p_kind='events' and x.organization_id=p_org and x.sourcing_sensitive
 ), bounded as (select * from rows where p_after is null or id>p_after order by id limit p_limit+1), page as (select * from bounded order by id limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by id) from page),'[]'::jsonb),'nextCursor',case when (select count(*) from bounded)>p_limit then (select id from page order by id desc limit 1) else null end) into result;
 return result;
end $$;

-- Explicit ownership: migration owner postgres, never an application login.
-- A definer owner bypasses RLS: the guards/projections above enforce authority.
-- Revoke default function ACLs after ALL function creation, including helpers.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.proname like 'store\_%' escape '\' loop
 execute format('alter function %s owner to postgres',f.signature);
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 if exists(select 1 from pg_roles where rolname='service_role') then execute format('revoke all on function %s from service_role',f.signature); end if;
 end loop;
end $$;
grant execute on function public.store_catalog_public_v1(text,text,text,integer,text,text) to anon,authenticated;
grant execute on function public.store_catalog_workspace_v1(uuid,uuid,text,uuid,integer),public.store_catalog_sourcing_v1(uuid,uuid,text,uuid,integer) to authenticated;
grant execute on function public.store_catalog_draft_command_v1(uuid,uuid,text,uuid,uuid,bigint,jsonb,integer),
 public.store_sourcing_command_v1(uuid,uuid,text,uuid,uuid,bigint,jsonb,integer),
 public.store_catalog_policy_command_v1(uuid,uuid,text,uuid,uuid,bigint,jsonb,integer),
 public.store_catalog_publication_command_v1(uuid,uuid,text,uuid,uuid,bigint,jsonb,integer) to authenticated;
