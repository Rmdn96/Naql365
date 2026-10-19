-- Local Store management extension. No grants, scope seeds or business data.
-- Supplier public-reference observations are separate from contractual offers and retail prices.
create table private.store_supplier_reference_prices (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, market_id uuid not null,
 currency text not null default 'EGP' check(currency='EGP'), product_id uuid not null, supplier_id uuid not null,
 version integer not null check(version>0), amount_minor bigint check(amount_minor between 0 and 9007199254740991),
 evidence_reference text not null check(length(evidence_reference) between 1 and 200),
 observed_at timestamptz not null, created_at timestamptz not null default now(), created_by uuid not null references public.profiles(id),
 foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency),
 foreign key(organization_id,product_id) references private.store_products(organization_id,id),
 foreign key(organization_id,supplier_id) references private.store_suppliers(organization_id,id),
 unique(organization_id,market_id,product_id,supplier_id,version)
);
create table private.store_product_media (
 id uuid primary key, organization_id uuid not null, market_id uuid not null, currency text not null default 'EGP' check(currency='EGP'),
 listing_id uuid not null, created_by uuid not null references public.profiles(id),
 rights_reference text not null check(length(rights_reference) between 1 and 200),
 mime text not null check(mime='image/webp'), size_bytes integer not null check(size_bytes between 1 and 2097152),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), status text not null default 'RESERVED' check(status in ('RESERVED','READY')),
 created_at timestamptz not null default now(),
 foreign key(organization_id,market_id,currency,listing_id) references private.store_product_market_listings(organization_id,market_id,currency,id)
);
create index store_reference_page on private.store_supplier_reference_prices(organization_id,market_id,product_id,id);
create index store_media_listing on private.store_product_media(organization_id,listing_id,id);
alter table private.store_supplier_reference_prices enable row level security;
alter table private.store_product_media enable row level security;
revoke all on private.store_supplier_reference_prices,private.store_product_media from public,anon,authenticated,service_role;

create function private.store_reference_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Reference observations are immutable' using errcode='55000'; end $$;
create trigger store_reference_immutable before update or delete on private.store_supplier_reference_prices for each row execute function private.store_reference_immutable();
create function private.store_media_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status<>'RESERVED' or new.status<>'READY' or (to_jsonb(new)-'status')<>(to_jsonb(old)-'status') then
 raise exception 'Product image history is immutable' using errcode='55000'; end if;
 return new;
end $$;
create trigger store_media_immutable before update or delete on private.store_product_media for each row execute function private.store_media_immutable();

create function public.store_catalog_admin_v2(p_org uuid,p_market uuid,p_kind text default 'products',p_after uuid default null,p_search text default '',p_state text default '',p_limit integer default 20)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb; begin
 perform private.store_staff(p_org,p_market,'{}');
 if p_kind not in ('products','categories','listings','prices','references','offers','suppliers','agreements','policies') or p_kind is null
 or p_limit is null or p_limit not between 1 and 50 or p_search is null or length(p_search)>120 or p_state is null or p_state not in ('','ACTIVE','SUSPENDED','DRAFT','PUBLISHED','APPROVED','REVOKED') then
 raise exception 'Invalid catalog page' using errcode='22023'; end if;
 if p_kind in ('references','offers','suppliers','agreements') then perform private.store_staff(p_org,p_market,array['store.sourcing.manage','store.supplier_cost.read']); end if;
 if p_kind='policies' then perform private.store_staff(p_org,p_market,array['store.catalog.policy.manage']); end if;
 with rows as (
 select x.id,x.status state,concat_ws(' ',x.sku,x.slug,x.draft_content->>'title_ar',x.draft_content->>'title_en') search,
 jsonb_build_object('id',x.id,'sku',x.sku,'slug',x.slug,'categoryId',x.category_id,'content',x.draft_content,'state',x.status,'revision',x.revision) item
 from private.store_products x where p_kind='products' and x.organization_id=p_org
 union all select x.id,x.status,concat_ws(' ',x.slug,x.draft_content->>'title_ar',x.draft_content->>'title_en'),
 jsonb_build_object('id',x.id,'slug',x.slug,'parentId',x.parent_id,'content',x.draft_content,'state',x.status,'revision',x.revision)
 from private.store_categories x where p_kind='categories' and x.organization_id=p_org
 union all select x.id,x.status,concat_ws(' ',p.sku,p.slug,p.draft_content->>'title_ar',p.draft_content->>'title_en'),
 jsonb_build_object('id',x.id,'productId',x.product_id,'content',p.draft_content,'publishedContent',x.published_content,'media',x.approved_media,'state',x.status,'revision',x.revision)
 from private.store_product_market_listings x join private.store_products p on p.id=x.product_id and p.organization_id=x.organization_id
 where p_kind='listings' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,x.status,concat_ws(' ',p.sku,p.slug,p.draft_content->>'title_ar',p.draft_content->>'title_en'),
 jsonb_build_object('id',x.id,'listingId',x.listing_id,'productId',p.id,'content',p.draft_content,'amountMinor',x.amount_minor,'version',x.version,'presentationPolicyId',x.presentation_policy_id,'effectiveFrom',x.effective_from,'effectiveUntil',x.effective_until,'state',x.status,'revision',x.revision)
 from private.store_market_prices x join private.store_product_market_listings l on l.id=x.listing_id and l.organization_id=x.organization_id join private.store_products p on p.id=l.product_id and p.organization_id=l.organization_id
 where p_kind='prices' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,'DRAFT',concat_ws(' ',p.sku,p.slug,p.draft_content->>'title_ar',p.draft_content->>'title_en'),
 jsonb_build_object('id',x.id,'productId',x.product_id,'supplierId',x.supplier_id,'content',p.draft_content,'amountMinor',x.amount_minor,'version',x.version,'observedAt',x.observed_at,'evidenceReference',x.evidence_reference,'state','DRAFT','revision',1)
 from private.store_supplier_reference_prices x join private.store_products p on p.id=x.product_id and p.organization_id=x.organization_id where p_kind='references' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,x.status,concat_ws(' ',p.sku,p.slug,p.draft_content->>'title_ar',p.draft_content->>'title_en'),
 jsonb_build_object('id',x.id,'productId',x.product_id,'supplierId',x.supplier_id,'agreementId',x.agreement_id,'offerKey',x.offer_key,'comparison',(select jsonb_build_object('retailMinor',r.amount_minor,'entitlementMinor',x.unit_cost_minor,'productDifferenceMinor',r.amount_minor-x.unit_cost_minor,'retailVersion',r.version,'offerVersion',x.version) from private.store_product_market_listings l join private.store_market_prices r on r.id=l.selected_price_id and r.organization_id=l.organization_id and r.market_id=l.market_id where l.organization_id=p_org and l.market_id=p_market and l.selected_offer_id=x.id and r.status='APPROVED' and x.status='APPROVED' and private.store_listing_eligible(p_org,l.id)),'content',p.draft_content,'amountMinor',x.unit_cost_minor,'version',x.version,'effectiveFrom',x.effective_from,'effectiveUntil',x.effective_until,'evidenceReference',x.evidence_ref,'state',x.status,'revision',x.revision)
 from private.store_supplier_offers x join private.store_products p on p.id=x.product_id and p.organization_id=x.organization_id where p_kind='offers' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,x.status,x.name,jsonb_build_object('id',x.id,'name',x.name,'state',x.status,'revision',x.revision) from private.store_suppliers x where p_kind='suppliers' and x.organization_id=p_org
 union all select x.id,x.status,x.agreement_code,jsonb_build_object('id',x.id,'supplierId',x.supplier_id,'agreementCode',x.agreement_code,'version',x.version,'state',x.status,'revision',x.revision) from private.store_supplier_agreements x where p_kind='agreements' and x.organization_id=p_org and x.market_id=p_market
 union all select x.id,x.status,x.policy_code,jsonb_build_object('id',x.id,'kind',x.kind,'code',x.policy_code,'version',x.version,'state',x.status,'revision',x.revision) from private.store_policy_versions x where p_kind='policies' and x.kind<>'STOREFRONT_SCOPE' and x.organization_id=p_org and x.market_id=p_market
 ), bounded as (select * from rows where (p_after is null or id>p_after) and (p_state='' or state=p_state) and (p_search='' or position(lower(p_search) in lower(search))>0) order by id limit p_limit+1), page as (select * from bounded order by id limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(item order by id) from page),'[]'::jsonb),'nextCursor',case when (select count(*) from bounded)>p_limit then (select id from page order by id desc limit 1) else null end) into result;
 return result;
end $$;

create function public.store_catalog_extension_v1(p_org uuid,p_market uuid,p_action text,p_mutation uuid,p_target uuid,p_revision bigint,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare command_family text; receipt private.store_command_receipts; digest text; result jsonb; rid uuid; l private.store_product_market_listings; asset private.store_product_media; item jsonb; target uuid; begin
 if p_action not in ('reference_price','reserve_media','finalize_media','attach_media') or p_action is null then raise exception 'Invalid catalog action' using errcode='22023'; end if;
 command_family=case when p_action='reference_price' then 'sourcing' else 'publication' end;
 perform private.store_staff(p_org,p_market,case when p_action='reference_price' then array['store.sourcing.manage','store.supplier_cost.read'] when p_action='attach_media' then array['store.catalog.manage','store.catalog.publish'] else array['store.catalog.manage'] end);
 if p_mutation is null or p_target is null or p_revision is null or p_revision<1 or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16384 then raise exception 'Invalid catalog intent' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('naql365:store:catalog:v1:'||p_org::text,0));
 -- Reauthorize after the lock, before replay or mutation.
 perform private.store_staff(p_org,p_market,case when p_action='reference_price' then array['store.sourcing.manage','store.supplier_cost.read'] when p_action='attach_media' then array['store.catalog.manage','store.catalog.publish'] else array['store.catalog.manage'] end);
 digest=encode(sha256(convert_to(jsonb_build_object('extension',p_action,'market',p_market,'target',p_target,'revision',p_revision,'payload',p_payload)::text,'UTF8')),'hex');
 select * into receipt from private.store_command_receipts where organization_id=p_org and actor_subject=auth.uid() and family=command_family and contract_version=1 and mutation_id=p_mutation;
 if receipt.id is not null then if receipt.intent_digest<>digest then raise exception 'Catalog replay conflict' using errcode='PT409'; end if; return receipt.outcome||jsonb_build_object('replayed',true); end if;
 if p_action='reference_price' then
  if not private.store_keys(p_payload,array['supplierId','version','amountMinor','observedAt','evidenceReference']) or not private.store_text(p_payload->'evidenceReference',200)
  or jsonb_typeof(p_payload->'version')<>'number' or p_payload->>'version' !~ '^[1-9][0-9]{0,8}$' or (p_payload->'amountMinor'<>'null'::jsonb and (jsonb_typeof(p_payload->'amountMinor')<>'number' or p_payload->>'amountMinor' !~ '^[0-9]{1,16}$')) then raise exception 'Invalid reference observation' using errcode='22023'; end if;
  perform 1 from private.store_products where id=p_target and organization_id=p_org and revision=p_revision for update;
  if not found then raise exception 'Product version unavailable' using errcode='PT409'; end if;
  target=gen_random_uuid();
  insert into private.store_supplier_reference_prices(id,organization_id,market_id,product_id,supplier_id,version,amount_minor,observed_at,evidence_reference,created_by)
  values(target,p_org,p_market,p_target,(p_payload->>'supplierId')::uuid,(p_payload->>'version')::integer,(p_payload->>'amountMinor')::bigint,(p_payload->>'observedAt')::timestamptz,p_payload->>'evidenceReference',auth.uid());
  result=jsonb_build_object('id',target,'revision',1);
 else
  select * into l from private.store_product_market_listings where id=p_target and organization_id=p_org and market_id=p_market for update;
  if l.id is null or l.revision<>p_revision then raise exception 'Listing version unavailable' using errcode='PT409'; end if;
  if p_action='reserve_media' then
   if not private.store_keys(p_payload,array['assetId','size','sha256','rightsReference']) or not private.store_text(p_payload->'rightsReference',200) or jsonb_typeof(p_payload->'size')<>'number' or p_payload->>'size' !~ '^[1-9][0-9]{0,6}$' then raise exception 'Invalid image intent' using errcode='22023'; end if;
   target=(p_payload->>'assetId')::uuid;
   insert into private.store_product_media(id,organization_id,market_id,listing_id,created_by,mime,size_bytes,sha256,rights_reference) values(target,p_org,p_market,l.id,auth.uid(),'image/webp',(p_payload->>'size')::integer,p_payload->>'sha256',p_payload->>'rightsReference');
   result=jsonb_build_object('id',target,'revision',l.revision);
  elsif p_action='finalize_media' then
   if not private.store_keys(p_payload,array['assetId']) then raise exception 'Invalid image intent' using errcode='22023'; end if;
   select * into asset from private.store_product_media where id=(p_payload->>'assetId')::uuid and organization_id=p_org and market_id=p_market and listing_id=l.id and created_by=auth.uid() for update;
   if asset.id is null or not exists(select 1 from storage.objects o where bucket_id='store-product-media' and name=asset.id::text||'.webp' and metadata->>'mimetype'=asset.mime and coalesce(metadata->>'size',metadata->>'contentLength')::bigint=asset.size_bytes) then raise exception 'Image upload unconfirmed' using errcode='PT409'; end if;
   if asset.status='RESERVED' then update private.store_product_media set status='READY' where id=asset.id; end if;
   result=jsonb_build_object('id',asset.id,'src','/api/store/media/'||asset.id::text,'revision',l.revision);
  else
   if not private.store_keys(p_payload,array['media']) or jsonb_typeof(p_payload->'media')<>'array' or jsonb_array_length(p_payload->'media')>5 then raise exception 'Invalid image selection' using errcode='22023'; end if;
   for item in select * from jsonb_array_elements(p_payload->'media') loop
    if not private.store_keys(item,array['src','altAr','altEn']) or not private.store_text(item->'altAr',200) or not private.store_text(item->'altEn',200)
    or not (exists(select 1 from private.store_product_media a where a.organization_id=p_org and a.market_id=p_market and a.listing_id=l.id and a.status='READY' and item->>'src'='/api/store/media/'||a.id::text)
    or exists(select 1 from jsonb_array_elements(l.approved_media) old where old->>'src'=item->>'src' and item->>'src' ~ '^/store-assets/[A-Za-z0-9_-]+\.(png|webp)$')) then raise exception 'Image selection denied' using errcode='22023'; end if;
   end loop;
   if (select count(distinct x->>'src') from jsonb_array_elements(p_payload->'media') x)<>jsonb_array_length(p_payload->'media') then raise exception 'Duplicate image selection' using errcode='22023'; end if;
   update private.store_product_market_listings set approved_media=p_payload->'media',revision=revision+1 where id=l.id;
   result=jsonb_build_object('id',l.id,'revision',l.revision+1);
  end if;
 end if;
 insert into private.store_command_receipts(organization_id,actor_subject,family,contract_version,mutation_id,intent_digest,outcome) values(p_org,auth.uid(),command_family,1,p_mutation,digest,result) returning id into rid;
 insert into private.store_events(organization_id,command_receipt_id,actor_subject,operation,product_id,listing_id,revision,sourcing_sensitive)
 values(p_org,rid,auth.uid(),p_action,case when p_action='reference_price' then p_target end,case when p_action<>'reference_price' then p_target end,(result->>'revision')::bigint,p_action='reference_price');
 return result;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('store-product-media','store-product-media',false,2097152,array['image/webp']);
create function private.store_media_access(p_path text,p_write boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare a private.store_product_media; s private.store_policy_versions; begin
 if p_path is null or p_path !~ '^[a-f0-9-]{36}\.webp$' then return false; end if;
 select * into a from private.store_product_media where id::text||'.webp'=p_path;
 if a.id is null then return false; end if;
 if auth.uid() is not null then
  begin perform private.store_staff(a.organization_id,a.market_id,case when p_write then array['store.catalog.manage'] else '{}'::text[] end);
   if not p_write then return true; end if;
   return a.created_by=auth.uid() and a.status='RESERVED' and a.created_at>now()-interval '20 minutes';
  exception when insufficient_privilege or sqlstate 'PT409' then null; end;
 end if;
 if p_write or a.status<>'READY' then return false; end if;
 select * into s from private.store_policy_versions where kind='STOREFRONT_SCOPE' and status='APPROVED' and organization_id=a.organization_id and market_id=a.market_id and not scope_paused and content->'publication_enabled'='true'::jsonb and effective_from<=statement_timestamp() and (effective_until is null or effective_until>statement_timestamp());
 return s.id is not null and private.store_listing_eligible(a.organization_id,a.listing_id)
 and exists(select 1 from private.store_product_market_listings l,jsonb_array_elements(l.approved_media) m where l.id=a.listing_id and l.organization_id=a.organization_id and m->>'src'='/api/store/media/'||a.id::text);
end $$;
create function private.store_media_upload(p_path text,p_metadata jsonb) returns boolean language sql security definer set search_path='' as $$
 select storage.allow_only_operation('object.upload') and private.store_media_access(p_path,true) and exists(select 1 from private.store_product_media a where a.id::text||'.webp'=p_path and p_metadata->>'mimetype'=a.mime and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=a.size_bytes)
$$;
create policy store_product_media_read on storage.objects for select to anon,authenticated using(bucket_id='store-product-media' and private.store_media_access(name));
create policy store_product_media_insert on storage.objects for insert to authenticated with check(bucket_id='store-product-media' and private.store_media_upload(name,metadata));
revoke all on function private.store_reference_immutable(),private.store_media_immutable(),private.store_media_access(text,boolean),private.store_media_upload(text,jsonb) from public,anon,authenticated;
grant execute on function private.store_media_access(text,boolean) to anon,authenticated;
grant execute on function private.store_media_upload(text,jsonb) to authenticated;
revoke all on function public.store_catalog_admin_v2(uuid,uuid,text,uuid,text,text,integer),public.store_catalog_extension_v1(uuid,uuid,text,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.store_catalog_admin_v2(uuid,uuid,text,uuid,text,text,integer),public.store_catalog_extension_v1(uuid,uuid,text,uuid,uuid,bigint,jsonb) to authenticated;

-- Extend only the existing nullable-target UI adapter; underlying governed commands stay authoritative.
create or replace function public.store_catalog_ui_command_v1(p_country text,p_family text,p_operation text,p_mutation uuid,p_payload jsonb,p_target uuid default null,p_expected bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions; begin
 if p_country is distinct from 'EG' then raise exception 'Store market denied' using errcode='42501'; end if;
 s=private.store_scope();
 if p_family='draft' then return public.store_catalog_draft_command_v1(s.organization_id,s.market_id,p_operation,p_mutation,p_target,p_expected,p_payload);
 elsif p_family='publication' then return public.store_catalog_publication_command_v1(s.organization_id,s.market_id,p_operation,p_mutation,p_target,p_expected,p_payload);
 elsif p_family='sourcing' then return public.store_sourcing_command_v1(s.organization_id,s.market_id,p_operation,p_mutation,p_target,p_expected,p_payload);
 else raise exception 'Unsupported catalog family' using errcode='22023'; end if;
end $$;
