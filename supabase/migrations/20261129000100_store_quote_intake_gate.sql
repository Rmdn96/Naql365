-- Approved catalog visibility and acceptance of new submissions have independent switches.
alter table private.store_quote_launch add column intake_enabled boolean not null default false;

create or replace function public.store_quote_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s private.store_policy_versions;
begin
  s:=private.store_scope();
  if not private.store_quote_open(s) then return '{"enabled":false,"intake_enabled":false,"items":[]}'; end if;
  return jsonb_build_object('enabled', true, 'intake_enabled', exists (
    select 1 from private.store_quote_launch where scope_id = s.id and intake_enabled
  ), 'items', coalesce((
    select jsonb_agg(item order by item->>'sku') from (
      select private.store_quote_item(p) item from private.store_products p
      where p.organization_id=s.organization_id and p.revision=p.quote_approved_revision
    ) q where item is not null
  ),'[]'));
exception when sqlstate 'PT409' then return '{"enabled":false,"intake_enabled":false,"items":[]}';
end $$;

create or replace function public.store_submit_quote(p_request uuid,p_contact jsonb,p_items jsonb) returns text
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
  perform 1 from private.store_quote_launch where singleton and scope_id = s.id and enabled and intake_enabled for share;
  if not found or not private.store_quote_open(s) then raise exception 'Quote requests unavailable' using errcode='PT409'; end if;
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
