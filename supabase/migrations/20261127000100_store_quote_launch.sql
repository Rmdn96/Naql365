-- Quote mode is independent of fixed-price listings and is off until explicitly enabled.
create table private.store_quote_launch (
  singleton boolean primary key default true check (singleton),
  scope_id uuid not null references private.store_policy_versions(id),
  enabled boolean not null default false
);
alter table private.store_quote_launch enable row level security;
alter table private.store_products add column quote_approved_revision bigint, add column quote_approved_listing_revision bigint;
create table private.store_quote_requests (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  reference text not null unique,
  intent_hash text not null,
  contact jsonb not null,
  items jsonb not null,
  revision integer not null default 0,
  offer jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.store_quote_requests enable row level security;

create function private.store_quote_open(s private.store_policy_versions) returns boolean
language sql stable set search_path='' as $$
  select exists(
    select 1 from private.store_quote_launch g join public.markets m
      on (m.organization_id,m.id)=(s.organization_id,s.market_id)
    where g.scope_id=s.id and g.enabled and m.active
      and s.effective_from<=statement_timestamp()
      and (s.effective_until is null or s.effective_until>statement_timestamp())
  )
$$;

create function private.store_quote_item(p private.store_products) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',p.id,'sku',p.sku,'slug',p.slug,'revision',p.revision,
    'category',c.slug,'categoryAr',c.public_content->>'title_ar','categoryEn',c.public_content->>'title_en',
    'content',jsonb_build_object('title_ar',p.draft_content->>'title_ar','title_en',p.draft_content->>'title_en',
      'description_ar',p.draft_content->>'description_ar','description_en',p.draft_content->>'description_en',
      'specifications',coalesce(p.draft_content->'specifications','[]')),
    'price',null,'media',coalesce((select l.approved_media from private.store_product_market_listings l
      join private.store_quote_launch g on g.enabled
      join private.store_policy_versions s on s.id=g.scope_id and s.organization_id=l.organization_id and s.market_id=l.market_id
      where l.product_id=p.id and l.organization_id=p.organization_id and l.status<>'SUSPENDED'
        and l.revision=p.quote_approved_listing_revision),'[]'))
  from private.store_categories c
  where c.id=p.category_id and c.organization_id=p.organization_id
    and p.status='ACTIVE' and p.revision=p.quote_approved_revision
    and private.store_category_eligible(p.organization_id,c.id)
$$;

create function public.store_quote_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s private.store_policy_versions;
begin
  s:=private.store_scope();
  if not private.store_quote_open(s) then return '{"enabled":false,"items":[]}'; end if;
  return jsonb_build_object('enabled',true,'items',coalesce((
    select jsonb_agg(item order by item->>'sku') from (
      select private.store_quote_item(p) item from private.store_products p
      where p.organization_id=s.organization_id and p.revision=p.quote_approved_revision
    ) q where item is not null
  ),'[]'));
exception when sqlstate 'PT409' then return '{"enabled":false,"items":[]}';
end $$;

create function public.store_submit_quote(p_request uuid,p_contact jsonb,p_items jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions; prior private.store_quote_requests; p private.store_products;
  item jsonb; item_snapshot jsonb; items jsonb='[]'; seen text[]='{}'; sku text;
  digest text; ref text;
begin
  if p_request is null or p_contact is null or p_items is null or octet_length(p_items::text)>6000
    or not private.store_keys(p_contact,array['full_name','phone','governorate','area','address'],array['notes'])
    or not private.store_text(p_contact->'full_name',120) or length(btrim(p_contact->>'full_name'))<2
    or not private.store_text(p_contact->'phone',16) or (p_contact->>'phone') !~ '^\+?[0-9]{8,15}$'
    or (p_contact->>'governorate' in ('CAIRO','GIZA')) is not true
    or not private.store_text(p_contact->'area',100)
    or not private.store_text(p_contact->'address',500) or length(btrim(p_contact->>'address'))<3
    or (p_contact?'notes' and not private.store_text(p_contact->'notes',500))
    or jsonb_typeof(p_items) is distinct from 'array'
  then raise exception 'Invalid quote request' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Invalid quote request' using errcode='22023'; end if;
  s:=private.store_scope();
  perform pg_advisory_xact_lock(hashtextextended('store-quote:'||p_request::text,0));
  digest:=encode(sha256(convert_to(jsonb_build_array(p_contact,p_items)::text,'UTF8')),'hex');
  select * into prior from private.store_quote_requests where id=p_request and organization_id=s.organization_id;
  if found then
    if prior.intent_hash<>digest then raise exception 'Request changed' using errcode='P4091'; end if;
    return prior.reference;
  end if;
  perform 1 from private.store_quote_launch where singleton for share;
  if not private.store_quote_open(s) then raise exception 'Quote requests unavailable' using errcode='PT409'; end if;
  perform private.consume_guest_budget(s.organization_id,'create',md5('store:quote:all')::uuid,100,true);
  perform private.consume_guest_budget(s.organization_id,'create',md5('store:quote:phone:'||ltrim(p_contact->>'phone','+'))::uuid,5,true);
  for item in select value from jsonb_array_elements(p_items) loop
    sku:=item->>'sku';
    if not private.store_keys(item,array['sku','quantity','revision'])
      or not private.store_text(item->'sku',80) or sku=any(seen)
      or jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity') !~ '^[1-9][0-9]?$'
      or jsonb_typeof(item->'revision') is distinct from 'number' or (item->>'revision') !~ '^[1-9][0-9]{0,14}$'
    then raise exception 'Invalid quote item' using errcode='22023'; end if;
    select * into p from private.store_products
      where organization_id=s.organization_id and store_products.sku=item->>'sku'
        and revision=(item->>'revision')::bigint for share;
    item_snapshot:=private.store_quote_item(p);
    if item_snapshot is null then raise exception 'Quote item unavailable' using errcode='PT409'; end if;
    seen:=array_append(seen,sku);
    items:=items||jsonb_build_array(item_snapshot||jsonb_build_object('quantity',(item->>'quantity')::int));
  end loop;
  ref:='Q-'||replace(gen_random_uuid()::text,'-','');
  insert into private.store_quote_requests(id,organization_id,reference,intent_hash,contact,items)
    values(p_request,s.organization_id,ref,digest,p_contact,items);
  return ref;
exception when others then
  if sqlstate in ('22023','PT409','PT429','P4091') then
    raise exception 'Quote request rejected' using errcode=sqlstate;
  end if;
  raise exception 'Quote request unavailable' using errcode='XX000';
end $$;

create function public.store_quote_queue(p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions;
begin
  s:=private.store_scope();
  if not private.is_commercial_admin(auth.uid()) then raise exception 'Quote access denied' using errcode='42501'; end if;
  perform private.store_staff(s.organization_id,s.market_id,array['store.orders.read']);
  return coalesce((select jsonb_agg(to_jsonb(q)-'intent_hash'-'organization_id' order by created_at desc) from (
    select * from private.store_quote_requests where organization_id=s.organization_id
      and (p_before is null or created_at<p_before) order by created_at desc limit 30
  ) q),'[]');
end $$;

create function public.store_review_quote(p_id uuid,p_revision integer,p_offer jsonb default null,p_confirmation text default null) returns void
language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions; q private.store_quote_requests;
  item jsonb; amount text; total bigint:=0; delivery bigint; snapshot jsonb;
begin
  s:=private.store_scope();
  if not private.is_commercial_admin(auth.uid()) then raise exception 'Quote access denied' using errcode='42501'; end if;
  perform private.store_staff(s.organization_id,s.market_id,array['store.orders.read']);
  select * into q from private.store_quote_requests where id=p_id and organization_id=s.organization_id for update;
  if not found or q.revision is distinct from p_revision or q.confirmed_at is not null
    then raise exception 'Quote revision unavailable' using errcode='PT409'; end if;
  if p_confirmation is not null then
    if q.offer is null or p_offer is not null or length(btrim(p_confirmation)) not between 1 and 200 then
      raise exception 'Valid offer and customer confirmation required' using errcode='22023'; end if;
    update private.store_quote_requests set confirmed_at=now(),revision=revision+1 where id=p_id;
    snapshot:=jsonb_build_object('offer',q.offer,'confirmation',btrim(p_confirmation));
  else
    if p_offer is null or not private.store_keys(p_offer,array['prices','delivery'])
      or jsonb_typeof(p_offer->'prices') is distinct from 'object'
      or jsonb_typeof(p_offer->'delivery') is distinct from 'number' or (p_offer->>'delivery') !~ '^(0|[1-9][0-9]{0,8})$'
    then raise exception 'Invalid quote amounts' using errcode='22023'; end if;
    delivery:=(p_offer->>'delivery')::bigint;
    for item in select value from jsonb_array_elements(q.items) loop
      amount:=p_offer->'prices'->>(item->>'sku');
      if amount is null or amount !~ '^[1-9][0-9]{0,8}$'
        or jsonb_typeof(p_offer->'prices'->(item->>'sku')) is distinct from 'number'
      then raise exception 'Invalid unit amount' using errcode='22023'; end if;
      total:=total+amount::bigint*(item->>'quantity')::int;
    end loop;
    if (select count(*) from jsonb_object_keys(p_offer->'prices'))<>jsonb_array_length(q.items)
      then raise exception 'Unexpected quote item' using errcode='22023'; end if;
    snapshot:=p_offer||jsonb_build_object('total',total+delivery,'currency','EGP','version',q.revision+1);
    update private.store_quote_requests set offer=snapshot,revision=revision+1 where id=p_id;
  end if;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values(s.organization_id,auth.uid(),case when p_confirmation is null then 'store.quote_version' else 'store.quote_confirmation' end,
      'store_quote_requests',p_id,snapshot);
end $$;

revoke all on function private.store_quote_open(private.store_policy_versions), private.store_quote_item(private.store_products) from public,anon,authenticated;
revoke all on function public.store_quote_catalog(),public.store_submit_quote(uuid,jsonb,jsonb),
  public.store_quote_queue(timestamptz),public.store_review_quote(uuid,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.store_quote_catalog(),public.store_submit_quote(uuid,jsonb,jsonb) to anon,authenticated;
grant execute on function public.store_quote_queue(timestamptz),public.store_review_quote(uuid,integer,jsonb,text) to authenticated;


create function public.store_approve_quote_product(p_product uuid,p_revision bigint,p_approved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare s private.store_policy_versions;
begin
  s:=private.store_scope();
  if not private.is_commercial_admin(auth.uid()) then raise exception 'Quote access denied' using errcode='42501'; end if;
  perform private.store_staff(s.organization_id,s.market_id,array['store.catalog.manage','store.catalog.publish']);
  update private.store_products p set revision=p.revision+1, quote_approved_revision=case when p_approved then p.revision+1 else null end,
    quote_approved_listing_revision=case when p_approved then (select l.revision from private.store_product_market_listings l
      where l.organization_id=s.organization_id and l.market_id=s.market_id and l.product_id=p.id and l.status<>'SUSPENDED') end
    where p.id=p_product and p.organization_id=s.organization_id and p.revision=p_revision and p_approved is not null
      and (not p_approved or (p.status='ACTIVE'
        and private.store_text(p.draft_content->'title_ar',200) and private.store_text(p.draft_content->'title_en',200)
        and private.store_category_eligible(s.organization_id,p.category_id)));
  if not found then raise exception 'Product revision unavailable' using errcode='PT409'; end if;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(s.organization_id,auth.uid(),'store.quote_product_review','store_products',p_product,
    jsonb_build_object('revision',p_revision,'approved',p_approved));
end $$;
revoke all on function public.store_approve_quote_product(uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.store_approve_quote_product(uuid,bigint,boolean) to authenticated;


-- Reuse only ready media attached to the explicitly reviewed listing revision.
create or replace function private.store_media_access(p_path text,p_write boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from private.store_product_market_listings l
   join private.store_products p on p.id=l.product_id and p.organization_id=l.organization_id
   join private.store_quote_launch g on g.enabled
   join private.store_policy_versions q on q.id=g.scope_id and q.organization_id=l.organization_id and q.market_id=l.market_id
   cross join lateral jsonb_array_elements(l.approved_media) m
   where l.id=a.listing_id and l.organization_id=a.organization_id and l.market_id=a.market_id
     and q.kind='STOREFRONT_SCOPE' and q.status='APPROVED' and private.store_quote_open(q)
     and l.revision=p.quote_approved_listing_revision and l.status<>'SUSPENDED'
     and p.revision=p.quote_approved_revision and p.status='ACTIVE'
     and private.store_category_eligible(p.organization_id,p.category_id)
     and m->>'src'='/api/store/media/'||a.id::text) then return true; end if;
 select * into s from private.store_policy_versions where kind='STOREFRONT_SCOPE' and status='APPROVED' and organization_id=a.organization_id and market_id=a.market_id and not scope_paused and content->'publication_enabled'='true'::jsonb and effective_from<=statement_timestamp() and (effective_until is null or effective_until>statement_timestamp());
 return s.id is not null and private.store_listing_eligible(a.organization_id,a.listing_id)
 and exists(select 1 from private.store_product_market_listings l,jsonb_array_elements(l.approved_media) m where l.id=a.listing_id and l.organization_id=a.organization_id and m->>'src'='/api/store/media/'||a.id::text);
end $$;
