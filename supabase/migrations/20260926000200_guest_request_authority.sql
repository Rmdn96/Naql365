-- One Request engine: both account and guest creation use this private initializer.
create function private.initialize_customer_request(p_customer uuid,p_market uuid,p_key uuid)
 returns public.requests language plpgsql security definer set search_path='' as $$
declare customer public.customers; market public.markets; r public.requests;
begin
 select * into strict customer from public.customers where id=p_customer for update;
 if p_key is null then raise exception 'Creation key required' using errcode='22023'; end if;
 select * into r from public.requests where organization_id=customer.organization_id and customer_id=customer.id and creation_key=p_key;
 if found then
  if r.market_id is distinct from p_market then raise exception 'Creation key reused across markets' using errcode='22023'; end if;
  return r;
 end if;
 select * into market from public.markets where id=p_market and organization_id=customer.organization_id and active;
 if not found then raise exception 'Active market required' using errcode='22023'; end if;
 if customer.identity_kind='GUEST' and exists(select 1 from public.requests where customer_id=customer.id)
 then raise exception 'Guest journey already exists' using errcode='55000'; end if;
 if (select count(*) from public.requests where customer_id=customer.id and status='DRAFT')>=20
 then raise exception 'Draft limit reached' using errcode='54000'; end if;
 insert into public.requests(organization_id,market_id,customer_id,creation_key,contact_name,contact_phone,contact_email)
 select customer.organization_id,market.id,customer.id,p_key,coalesce(p.display_name,''),coalesce(p.phone,''),coalesce(u.email,'')
 from (select 1) seed left join public.profiles p on p.id=customer.profile_id left join auth.users u on u.id=p.id
 returning * into r;
 perform private.customer_event(r.organization_id,'request.created',r.id);
 return r;
end $$;
revoke all on function private.initialize_customer_request(uuid,uuid,uuid) from public,anon,authenticated;

-- Privileged environment configuration. Anonymous creation is OFF until explicitly enabled.
create table private.guest_policy (
 organization_id uuid primary key references public.organizations(id),
 enabled boolean not null default false,
 lifetime_days integer not null default 30 check(lifetime_days between 1 and 90),
 creations_per_hour integer not null default 30 check(creations_per_hour between 1 and 1000)
);
create table private.guest_rate_budgets (
 organization_id uuid not null references public.organizations(id),
 scope text not null check(scope in ('create','mutation','upload','analytics')),
 subject uuid not null,
 window_start timestamptz not null,
 used integer not null check(used>0),
 primary key(organization_id,scope,subject,window_start)
);
alter table private.guest_policy enable row level security;
alter table private.guest_rate_budgets enable row level security;
revoke all on private.guest_policy,private.guest_rate_budgets from public,anon,authenticated;

create function private.consume_guest_budget(p_org uuid,p_scope text,p_subject uuid,p_limit integer,p_hourly boolean default false)
 returns void language plpgsql security definer set search_path='' as $$
declare used_value integer; bucket timestamptz;
begin
 if p_limit<1 or p_limit>1000 then raise exception 'Invalid rate policy' using errcode='22023'; end if;
 bucket=date_trunc(case when p_hourly then 'hour' else 'minute' end,clock_timestamp());
 insert into private.guest_rate_budgets(organization_id,scope,subject,window_start,used)
 values(p_org,p_scope,p_subject,bucket,1)
 on conflict(organization_id,scope,subject,window_start) do update
 set used=private.guest_rate_budgets.used+1 where private.guest_rate_budgets.used<p_limit
 returning used into used_value;
 if used_value is null then raise exception 'Please retry later' using errcode='PT429'; end if;
end $$;
revoke all on function private.consume_guest_budget(uuid,text,uuid,integer,boolean) from public,anon,authenticated;

create function public.start_guest_request(p_country text) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare policy private.guest_policy; market public.markets; customer_id uuid; r public.requests;
 secret text; grant_id uuid;
begin
 if p_country is null or p_country not in ('SA','EG') then raise exception 'Select a country' using errcode='22023'; end if;
 select p.* into policy from private.guest_policy p join private.customer_enrollment e using(organization_id) where p.enabled;
 if not found then raise exception 'Guest requests unavailable' using errcode='55000'; end if;
 select * into market from public.markets where organization_id=policy.organization_id and country_code=p_country and active;
 if not found then raise exception 'Market unavailable' using errcode='55000'; end if;
 -- Global tenant budget cannot be evaded by forged IP/fingerprint headers.
 perform private.consume_guest_budget(policy.organization_id,'create',policy.organization_id,policy.creations_per_hour,true);
 insert into public.customers(organization_id,identity_kind) values(policy.organization_id,'GUEST') returning id into customer_id;
 r=private.initialize_customer_request(customer_id,market.id,gen_random_uuid());
 -- Three cryptographically random v4 UUIDs provide >256 bits of entropy before SHA-256.
 secret='g1_'||encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'hex');
 insert into private.guest_access_grants(organization_id,customer_id,request_id,verifier,expires_at)
 values(policy.organization_id,customer_id,r.id,sha256(convert_to(secret,'UTF8')),clock_timestamp()+make_interval(days=>policy.lifetime_days))
 returning id into grant_id;
 insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata)
 values(policy.organization_id,'guest.grant_issued','requests',r.id,jsonb_build_object('grant_id',grant_id));
 return jsonb_build_object('token',secret,'request',private.request_result(r));
end $$;
revoke all on function public.start_guest_request(text) from public;
grant execute on function public.start_guest_request(text) to anon,authenticated;

create function private.customer_request_access(p_org uuid,p_customer uuid,p_request uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select (private.owns_customer(p_org,p_customer) and private.has_permission(p_org,'account.access'))
 or (auth.uid() is null and exists(select 1 from private.guest_context() g where g.id is not null and g.organization_id=p_org
 and g.customer_id=p_customer and g.request_id=p_request))
$$;
revoke all on function private.customer_request_access(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.customer_event(tenant uuid,event text,entity uuid,kind text default 'requests')
 returns void language plpgsql security definer set search_path='' as $$
declare facts jsonb='{}'; guest private.guest_access_grants;
begin
 if event='request.created' then facts=jsonb_build_object('analytics_event','request_started');
 elsif event='request.submitted' then facts=jsonb_build_object('analytics_event','request_completed'); end if;
 if auth.uid() is null then
  guest=private.guest_context();
  if guest.organization_id=tenant and guest.request_id=entity and kind='requests'
  then facts=facts||jsonb_build_object('guest_grant_id',guest.id); end if;
 end if;
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(tenant,auth.uid(),event,kind,entity,facts);
end $$;

create function public.guest_access_state() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare guest private.guest_access_grants;
begin
 guest=private.guest_context();
 if guest.id is null then raise exception 'Journey unavailable' using errcode='42501'; end if;
 return jsonb_build_object('requestId',guest.request_id,'expiresAt',guest.expires_at);
end $$;
revoke all on function public.guest_access_state() from public;
grant execute on function public.guest_access_state() to anon;

create or replace function public.request_command(p_operation text, p_request_id uuid, p_revision integer, p_mutation_id uuid, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare guest private.guest_access_grants; uid uuid=auth.uid(); r public.requests; customer public.customers; selected_value jsonb; location jsonb; item jsonb;
 market public.markets; city_record public.market_cities; month_key text; counter bigint; selection uuid; property boolean; i integer=0;
begin
 if uid is null then
  guest=private.lock_guest_context();
  if p_operation='create' then raise exception 'Guest journey already exists' using errcode='42501'; end if;
  perform private.consume_guest_budget(guest.organization_id,'mutation',guest.id,60);
 end if;
 if p_operation is null or p_mutation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>60000
 then raise exception 'Invalid command' using errcode='22023'; end if;
 if p_operation='create' then
  if p_request_id is not null or not private.only_keys(p_payload,array['market_id']) or p_payload->>'market_id' is null then raise exception 'Invalid creation input' using errcode='22023'; end if;
  select c.* into customer from public.customers c join private.customer_enrollment e on e.organization_id=c.organization_id
   where c.profile_id=uid and private.owns_customer(c.organization_id,c.id) and private.has_permission(c.organization_id,'account.access');
  if not found then raise exception 'Customer access required' using errcode='42501'; end if;
  r=private.initialize_customer_request(customer.id,(p_payload->>'market_id')::uuid,p_mutation_id);
  return private.request_result(r);
 end if;
 select * into r from public.requests where id=p_request_id for update;
 if not found or not private.customer_request_access(r.organization_id,r.customer_id,r.id)
 then raise exception 'Request unavailable' using errcode='42501'; end if;
 select * into strict market from public.markets where id=r.market_id and organization_id=r.organization_id;
 if p_operation<>'cancel' and not market.active then raise exception 'Market inactive' using errcode='55000'; end if;
 if p_operation not in ('save','submit','cancel') then raise exception 'Invalid operation' using errcode='22023'; end if;
 if p_operation<>'save' and p_payload<>'{}'::jsonb then raise exception 'Unexpected fields' using errcode='22023'; end if;
 if p_operation='submit' and r.status='SUBMITTED' then return private.request_result(r); end if;
 if p_operation='cancel' and r.status='CANCELLED' then return private.request_result(r); end if;
 if r.status<>'DRAFT' then raise exception 'Request is immutable' using errcode='55000'; end if;
 if r.last_mutation_id=p_mutation_id then return private.request_result(r); end if;
 if p_revision is null or r.revision<>p_revision then raise exception 'Draft changed; reload before saving' using errcode='PT409'; end if;
 if p_operation='save' then
  if not private.only_keys(p_payload,array['service_id','description','notes','pickup','delivery','items','additional_service_ids','preferred_date','time_window','contact_name','contact_phone','contact_email','contact_notes'])
   or not private.text_fields(p_payload,array['service_id','description','notes','preferred_date','time_window','contact_name','contact_phone','contact_email','contact_notes'])
   or jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')>50
   or jsonb_typeof(p_payload->'additional_service_ids') is distinct from 'array' or jsonb_array_length(p_payload->'additional_service_ids')>10
  then raise exception 'Invalid draft fields' using errcode='22023'; end if;
  selection=nullif(p_payload->>'service_id','')::uuid;
  if selection is not null then
   select property_required into property from public.services where id=selection and organization_id=r.organization_id and active and exists(select 1 from public.market_services ms where ms.organization_id=r.organization_id and ms.market_id=r.market_id and ms.service_id=selection and ms.active);
   if not found then raise exception 'Service unavailable' using errcode='22023'; end if;
  end if;
  update public.requests set service_id=selection,description=coalesce(p_payload->>'description',''),notes=coalesce(p_payload->>'notes',''),
   preferred_date=nullif(p_payload->>'preferred_date','')::date,time_window=nullif(p_payload->>'time_window',''),
   contact_name=coalesce(p_payload->>'contact_name',''),contact_phone=coalesce(p_payload->>'contact_phone',''),
   contact_email=coalesce(p_payload->>'contact_email',''),contact_notes=coalesce(p_payload->>'contact_notes','') where id=r.id;
  foreach month_key in array array['pickup','delivery'] loop
   location=p_payload->month_key;
   if location is null or not private.only_keys(location,array['city','city_id','district','address','notes','floor','elevator','access_notes','postal_code','building','unit'])
    or not private.text_fields(location,array['city','city_id','district','address','notes','access_notes','postal_code','building','unit'])
    or (location->'floor' is not null and jsonb_typeof(location->'floor') not in ('number','null'))
    or (location->'elevator' is not null and jsonb_typeof(location->'elevator') not in ('boolean','null'))
   then raise exception 'Invalid location' using errcode='22023'; end if;
   if not coalesce(property,false) and (nullif(location->>'floor','') is not null or location->>'elevator' is not null or coalesce(location->>'access_notes','')<>'')
   then raise exception 'Property fields not applicable' using errcode='22023'; end if;
   city_record=null;
   if nullif(location->>'city_id','') is not null then
    select * into city_record from public.market_cities where id=(location->>'city_id')::uuid and organization_id=r.organization_id and market_id=r.market_id;
    if not found then raise exception 'City outside request market' using errcode='22023'; end if;
   end if;
   insert into public.request_locations(request_id,organization_id,kind,city,district,address,notes,floor,elevator,access_notes,city_id,postal_code,building,unit)
   values(r.id,r.organization_id,month_key,coalesce(city_record.name_en,location->>'city',''),coalesce(location->>'district',''),coalesce(location->>'address',''),coalesce(location->>'notes',''),nullif(location->>'floor','')::integer,(location->>'elevator')::boolean,coalesce(location->>'access_notes',''),city_record.id,coalesce(location->>'postal_code',''),coalesce(location->>'building',''),coalesce(location->>'unit',''))
   on conflict(request_id,kind) do update set city=excluded.city,city_id=excluded.city_id,postal_code=excluded.postal_code,building=excluded.building,unit=excluded.unit,district=excluded.district,address=excluded.address,notes=excluded.notes,floor=excluded.floor,elevator=excluded.elevator,access_notes=excluded.access_notes;
  end loop;
  delete from public.request_items where request_id=r.id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
   if not private.only_keys(item,array['description','quantity','notes']) or not private.text_fields(item,array['description','notes']) or jsonb_typeof(item->'quantity') is distinct from 'number' or item->>'description' is null then raise exception 'Invalid item' using errcode='22023'; end if;
   insert into public.request_items(organization_id,request_id,description,quantity,notes,position)
    values(r.organization_id,r.id,item->>'description',(item->>'quantity')::integer,coalesce(item->>'notes',''),i); i=i+1;
  end loop;
  delete from public.request_additional_services where request_id=r.id;
  for selected_value in select * from jsonb_array_elements(p_payload->'additional_service_ids') loop
   selection=(selected_value#>>'{}')::uuid;
   if not exists(select 1 from public.additional_services where id=selection and organization_id=r.organization_id and active)
   then raise exception 'Additional service unavailable' using errcode='22023'; end if;
   insert into public.request_additional_services(request_id,organization_id,additional_service_id) values(r.id,r.organization_id,selection);
  end loop;
 elsif p_operation='submit' then
  if not exists(select 1 from public.market_services where organization_id=r.organization_id and market_id=r.market_id and service_id=r.service_id and active)
   or exists(select 1 from public.request_locations l where l.request_id=r.id and (l.city_id is null or not exists(select 1 from public.service_areas a where a.organization_id=r.organization_id and a.market_id=r.market_id and a.service_id=r.service_id and a.city_id=l.city_id and a.active)))
   or not exists(select 1 from public.services where id=r.service_id and organization_id=r.organization_id and active)
   or length(btrim(r.description))=0 or length(btrim(r.contact_name))=0 or r.contact_phone=''
   or r.preferred_date is null or r.preferred_date<(now() at time zone market.timezone)::date or r.time_window is null
   or (r.contact_email<>'' and r.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or (select count(*) from public.request_locations where request_id=r.id and length(btrim(city))>0 and length(btrim(address))>0)<>2
   or not exists(select 1 from public.request_items where request_id=r.id)
   or exists(select 1 from public.request_items where request_id=r.id and length(btrim(description))=0)
   or exists(select 1 from public.request_additional_services a join public.additional_services s on s.id=a.additional_service_id where a.request_id=r.id and not s.active)
   or exists(select 1 from public.request_attachments a join public.file_objects f on f.id=a.file_id where a.request_id=r.id and f.upload_state<>'ready')
  then raise exception 'Complete the request before submitting' using errcode='22023'; end if;
  month_key=to_char(now() at time zone market.timezone,'YYYYMM');
  insert into private.request_reference_counters(month,value) values(month_key,1)
   on conflict(month) do update set value=private.request_reference_counters.value+1 returning value into counter;
  update public.requests set status='SUBMITTED',submitted_at=now(),reference='N365-'||month_key||'-'||lpad(counter::text,greatest(6,length(counter::text)), '0') where id=r.id;
  perform private.customer_event(r.organization_id,'request.submitted',r.id);
 else
  update public.requests set status='CANCELLED' where id=r.id;
  update public.file_objects set upload_state='removing' where id in(select file_id from public.request_attachments where request_id=r.id);
  perform private.customer_event(r.organization_id,'request.cancelled',r.id);
 end if;
 update public.requests set revision=revision+1,last_mutation_id=p_mutation_id where id=r.id returning * into r;
 return private.request_result(r);
end $$;

revoke all on function public.request_command(text,uuid,integer,uuid,jsonb) from public;
grant execute on function public.request_command(text,uuid,integer,uuid,jsonb) to anon,authenticated;
