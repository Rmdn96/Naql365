create table private.store_category_media (
  id uuid primary key,
  organization_id uuid not null,
  market_id uuid not null,
  category_id uuid not null,
  created_by uuid not null references public.profiles(id),
  size_bytes integer not null check (size_bytes between 1 and 2097152),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  rights_reference text not null check (length(rights_reference) between 1 and 200),
  status text not null default 'RESERVED' check (status in ('RESERVED','DRAFT','APPROVED','RETIRED')),
  created_at timestamptz not null default now(),
  foreign key (organization_id,category_id) references private.store_categories(organization_id,id),
  foreign key (organization_id,market_id) references public.markets(organization_id,id)
);
alter table private.store_category_media enable row level security;
revoke all on private.store_category_media from public,anon,authenticated,service_role;
create unique index store_category_media_current on private.store_category_media(category_id) where status in ('DRAFT','APPROVED');

create function private.store_category_image_public(a private.store_category_media) returns boolean
language sql stable security definer set search_path='' as $$
  select a.status='APPROVED'
    and private.store_category_eligible(a.organization_id,a.category_id)
    and exists (
      select from private.store_policy_versions s
      where s.organization_id=a.organization_id and s.market_id=a.market_id
        and s.kind='STOREFRONT_SCOPE' and s.status='APPROVED' and private.store_quote_open(s)
    )
    and exists (
      select from private.store_products p where p.organization_id=a.organization_id
        and p.category_id=a.category_id and p.status='ACTIVE' and p.revision=p.quote_approved_revision
    );
$$;

create function private.store_category_image_access(p_path text,p_upload jsonb default null) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare a private.store_category_media;
begin
  if p_path is null or p_path !~ '^category/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}\.webp$' then return false; end if;
  select * into a from private.store_category_media where id=substring(p_path from 10 for 36)::uuid;
  if not found then return false; end if;
  if p_upload is null and private.store_category_image_public(a) then return true; end if;
  if auth.uid() is null or not private.is_commercial_admin(auth.uid()) then return false; end if;
  perform private.store_staff(a.organization_id,a.market_id,
    case when p_upload is null then array['store.catalog.read'] else array['store.catalog.manage'] end);
  if p_upload is null then return a.status in ('RESERVED','DRAFT','APPROVED'); end if;
  return a.status='RESERVED' and a.created_by=auth.uid() and a.created_at>now()-interval '20 minutes'
    and p_upload->>'mimetype'='image/webp'
    and coalesce(p_upload->>'size',p_upload->>'contentLength')=a.size_bytes::text;
exception when insufficient_privilege or sqlstate 'PT409' then return false;
end $$;

create policy store_category_media_read on storage.objects for select to anon,authenticated
  using (bucket_id='store-product-media' and private.store_category_image_access(name));
create policy store_category_media_insert on storage.objects for insert to authenticated
  with check (bucket_id='store-product-media' and storage.allow_only_operation('object.upload') and private.store_category_image_access(name,metadata));

create function public.store_category_image_admin(p_org uuid,p_market uuid,p_categories uuid[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare images jsonb;
begin
  if not private.is_commercial_admin(auth.uid()) then raise insufficient_privilege; end if;
  perform private.store_staff(p_org,p_market,array['store.catalog.read']);
  if cardinality(p_categories)>50 then raise sqlstate '22023'; end if;
  select coalesce(jsonb_object_agg(category_id,jsonb_build_object('id',id,'approved',status='APPROVED')),'{}')
    into images from private.store_category_media where organization_id=p_org and market_id=p_market
      and category_id=any(p_categories) and status in ('DRAFT','APPROVED');
  return images;
end $$;

create function public.store_quote_category_images() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare scope private.store_policy_versions; images jsonb;
begin
  scope:=private.store_scope();
  if not private.store_quote_open(scope) then return '{}'; end if;
  select coalesce(jsonb_object_agg(c.slug,a.id),'{}') into images
    from private.store_category_media a
    join private.store_categories c on (c.organization_id,c.id)=(a.organization_id,a.category_id)
    where a.status='APPROVED' and a.organization_id=scope.organization_id
      and a.market_id=scope.market_id and private.store_category_image_public(a);
  return images;
exception when sqlstate 'PT409' then return '{}';
end $$;

create function public.store_category_image_command(
  p_org uuid,p_market uuid,p_category uuid,p_revision bigint,p_action text,p_asset uuid,p_payload jsonb default '{}'
) returns void language plpgsql security definer set search_path='' as $$
declare a private.store_category_media; c private.store_categories; prior uuid;
begin
  if not private.is_commercial_admin(auth.uid()) then raise insufficient_privilege; end if;
  perform private.store_staff(p_org,p_market,case when p_action='approve'
    then array['store.catalog.manage','store.catalog.publish'] else array['store.catalog.manage'] end);
  perform pg_advisory_xact_lock(hashtextextended('naql365:store:catalog:v1:'||p_org::text,0));
  if not private.is_commercial_admin(auth.uid()) then raise insufficient_privilege; end if;
  perform private.store_staff(p_org,p_market,case when p_action='approve'
    then array['store.catalog.manage','store.catalog.publish'] else array['store.catalog.manage'] end);
  select * into c from private.store_categories where id=p_category and organization_id=p_org for update;
  if not found then raise sqlstate 'PT404'; end if;
  select * into a from private.store_category_media where id=p_asset and organization_id=p_org
    and category_id=p_category and market_id=p_market;
  if p_action='reserve' and a.id is not null and a.created_by=auth.uid()
    and a.sha256=p_payload->>'sha256' and a.size_bytes::text=p_payload->>'size' and a.rights_reference=p_payload->>'rights'
    and a.status in ('RESERVED','DRAFT','APPROVED') then return; end if;
  if p_action='finish' and a.id is not null and a.created_by=auth.uid() and a.status in ('DRAFT','APPROVED') then return; end if;
  if p_revision is distinct from c.revision then raise sqlstate 'PT409' using message='Category revision changed'; end if;
  if p_action='reserve' then
    if not private.store_keys(p_payload,array['size','sha256','rights'])
      or p_payload->>'size' !~ '^[1-9][0-9]{0,6}$' then raise sqlstate '22023'; end if;
    insert into private.store_category_media(id,organization_id,market_id,category_id,created_by,size_bytes,sha256,rights_reference)
      values(p_asset,p_org,p_market,p_category,auth.uid(),(p_payload->>'size')::integer,p_payload->>'sha256',p_payload->>'rights');
    return;
  end if;
  if a.id is null then raise sqlstate 'PT404'; end if;
  if p_action='finish' and a.status='RESERVED' and a.created_by=auth.uid() then
    if not exists(select from storage.objects where bucket_id='store-product-media' and name='category/'||a.id::text||'.webp'
      and metadata->>'mimetype'='image/webp' and coalesce(metadata->>'size',metadata->>'contentLength')=a.size_bytes::text)
      then raise sqlstate 'PT409' using message='Category upload unconfirmed'; end if;
    update private.store_category_media set status='RETIRED' where category_id=p_category and status in ('DRAFT','APPROVED') returning id into prior;
    update private.store_category_media set status='DRAFT' where id=a.id;
  elsif p_action='approve' and a.status='DRAFT' then
    update private.store_category_media set status='APPROVED' where id=a.id;
  elsif p_action='remove' and a.status in ('DRAFT','APPROVED') then
    update private.store_category_media set status='RETIRED' where id=a.id;
  else raise sqlstate 'PT409' using message='Category image changed'; end if;
  update private.store_categories set revision=revision+1 where id=c.id;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values(p_org,auth.uid(),'store.category_image_'||p_action,'store_categories',c.id,
      jsonb_build_object('asset',a.id,'previousAsset',prior));
end $$;
revoke all on function private.store_category_image_public(private.store_category_media) from public,anon,authenticated;
revoke all on function private.store_category_image_access(text,jsonb) from public,anon,authenticated;
grant execute on function private.store_category_image_access(text,jsonb) to anon,authenticated;
revoke all on function public.store_category_image_admin(uuid,uuid,uuid[]),
  public.store_category_image_command(uuid,uuid,uuid,bigint,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.store_category_image_admin(uuid,uuid,uuid[]),
  public.store_category_image_command(uuid,uuid,uuid,bigint,text,uuid,jsonb) to authenticated;
revoke all on function public.store_quote_category_images() from public,anon,authenticated;
grant execute on function public.store_quote_category_images() to anon,authenticated;
