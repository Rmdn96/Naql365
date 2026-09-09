-- Phase 1: customer identity and request intake only. No business/tenant seeds.
alter table public.profiles add column phone text check(phone ~ '^\+[1-9][0-9]{7,14}$');
create table private.customer_enrollment (
 singleton boolean primary key default true check(singleton),
 organization_id uuid not null references public.organizations(id)
);
revoke all on private.customer_enrollment from public, anon, authenticated;

alter table public.services
 add column name_ar text check(length(name_ar) between 1 and 120),
 add column name_en text check(length(name_en) between 1 and 120),
 add column active boolean not null default false,
 add column property_required boolean not null default false;
alter table public.services add constraint active_service_labels check(not active or (name_ar is not null and name_en is not null));
create table public.additional_services (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 code text not null check(length(code) between 1 and 60), name_ar text not null check(length(name_ar) between 1 and 120),
 name_en text not null check(length(name_en) between 1 and 120), active boolean not null default false,
 unique(organization_id,id), unique(organization_id,code),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.requests
 add column status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','CANCELLED')),
 add column revision integer not null default 0 check(revision>=0),
 add column creation_key uuid,
 add column last_mutation_id uuid,
 add column service_id uuid,
 add column description text not null default '' check(length(description)<=2000),
 add column notes text not null default '' check(length(notes)<=2000),
 add column preferred_date date,
 add column time_window text check(time_window in ('morning','afternoon','evening','flexible')),
 add column contact_name text not null default '' check(length(contact_name)<=200),
 add column contact_phone text not null default '' check(contact_phone='' or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
 add column contact_email text not null default '' check(length(contact_email)<=254),
 add column contact_notes text not null default '' check(length(contact_notes)<=1000),
 add column reference text unique check(reference ~ '^N365-[0-9]{6}-[0-9]{6,}$'),
 add column submitted_at timestamptz,
 add constraint requests_service_fk foreign key(organization_id,service_id) references public.services(organization_id,id),
 add constraint requests_creation_unique unique(organization_id,customer_id,creation_key),
 add constraint submitted_reference_consistency check((status='SUBMITTED')=(reference is not null and submitted_at is not null));
create index requests_customer_time_idx on public.requests(organization_id,customer_id,created_at desc,id);
create index requests_service_idx on public.requests(organization_id,service_id);
create table public.request_locations (
 request_id uuid not null, organization_id uuid not null,
 kind text not null check(kind in ('pickup','delivery')), primary key(request_id,kind),
 city text not null default '' check(length(city)<=120), district text not null default '' check(length(district)<=120),
 address text not null default '' check(length(address)<=500), notes text not null default '' check(length(notes)<=1000),
 floor integer check(floor between -5 and 200), elevator boolean,
 access_notes text not null default '' check(length(access_notes)<=1000),
 foreign key(organization_id,request_id) references public.requests(organization_id,id)
);
create index request_locations_tenant_idx on public.request_locations(organization_id,request_id);
alter table public.request_items
 add column description text not null default '' check(length(description)<=200),
 add column quantity integer not null default 1 check(quantity between 1 and 10000),
 add column notes text not null default '' check(length(notes)<=1000),
 add column position integer not null default 0 check(position between 0 and 49);
create table public.request_additional_services (
 request_id uuid not null, organization_id uuid not null, additional_service_id uuid not null,
 primary key(request_id,additional_service_id),
 foreign key(organization_id,request_id) references public.requests(organization_id,id),
 foreign key(organization_id,additional_service_id) references public.additional_services(organization_id,id)
);
create index request_additional_tenant_idx on public.request_additional_services(organization_id,request_id);
create index request_additional_service_idx on public.request_additional_services(organization_id,additional_service_id);
create table private.request_reference_counters(month text primary key check(month ~ '^[0-9]{6}$'), value bigint not null check(value>0));
revoke all on private.request_reference_counters from public, anon, authenticated;

alter table public.file_objects
 add column upload_state text not null default 'ready' check(upload_state in ('pending','ready','removing')),
 add column mime_type text check(mime_type in ('image/jpeg','image/png','image/webp')),
 add column size_bytes integer check(size_bytes between 1 and 3145728);
-- Existing foundation files remain readable; Phase 1 reservations always supply bounded image metadata.
create function private.customer_event(tenant uuid, event text, entity uuid, kind text default 'requests') returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(tenant,auth.uid(),event,kind,entity,
 case when event='request.created' then '{"analytics_event":"request_started"}'::jsonb
 when event='request.submitted' then '{"analytics_event":"request_completed"}'::jsonb else '{}'::jsonb end)
$$;
revoke all on function private.customer_event(uuid,text,uuid,text) from public,anon,authenticated;

create function public.onboard_customer(p_name text, p_phone text, p_locale text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); tenant uuid; customer uuid; membership public.organization_memberships;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null)
 then raise exception 'Confirmed authentication required' using errcode='42501'; end if;
 if length(btrim(p_name)) not between 1 and 200 or p_name is null or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_locale is null or p_locale not in ('ar','en')
 then raise exception 'Invalid profile' using errcode='22023'; end if;
 perform 1 from public.profiles where id=uid for update;
 select organization_id into tenant from private.customer_enrollment where singleton;
 if tenant is null then raise exception 'Enrollment not configured' using errcode='55000'; end if;
 select * into membership from public.organization_memberships where organization_id=tenant and profile_id=uid;
 if found and (membership.member_type<>'customer' or membership.status<>'active')
 then raise exception 'Enrollment unavailable' using errcode='42501'; end if;
 insert into public.organization_memberships(organization_id,profile_id,member_type) values(tenant,uid,'customer') on conflict do nothing;
 insert into public.customers(organization_id,profile_id) values(tenant,uid) on conflict do nothing;
 insert into public.user_roles(organization_id,profile_id,role_id) select tenant,uid,id from public.roles where code='CUSTOMER' and member_type='customer' on conflict do nothing;
 select id into customer from public.customers where organization_id=tenant and profile_id=uid;
 update public.profiles set display_name=btrim(p_name),phone=p_phone,locale=p_locale where id=uid;
 if membership.profile_id is null then perform private.customer_event(tenant,'customer.onboarded',customer,'customers'); end if;
 return customer;
end $$;
revoke all on function public.onboard_customer(text,text,text) from public,anon;
grant execute on function public.onboard_customer(text,text,text) to authenticated;

-- All input envelopes are strictly allowlisted at the database boundary too.
create function private.only_keys(value jsonb, keys text[]) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(value)='object' and not exists(select 1 from jsonb_object_keys(value) k where not k=any(keys))
$$;
revoke all on function private.only_keys(jsonb,text[]) from public,anon,authenticated;
create function private.request_result(r public.requests) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'reference',r.reference)
$$;
revoke all on function private.request_result(public.requests) from public,anon,authenticated;

create function public.request_command(p_operation text, p_request_id uuid, p_revision integer, p_mutation_id uuid, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); r public.requests; customer public.customers; selected_value jsonb; location jsonb; item jsonb;
 month_key text; counter bigint; selection uuid; property boolean; i integer=0;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_operation is null or p_mutation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>60000
 then raise exception 'Invalid command' using errcode='22023'; end if;
 if p_operation='create' then
  if p_request_id is not null or p_payload<>'{}'::jsonb then raise exception 'Invalid creation input' using errcode='22023'; end if;
  select c.* into customer from public.customers c join private.customer_enrollment e on e.organization_id=c.organization_id
   where c.profile_id=uid and private.owns_customer(c.organization_id,c.id) and private.has_permission(c.organization_id,'account.access');
  if not found then raise exception 'Customer access required' using errcode='42501'; end if;
  perform 1 from public.customers where id=customer.id for update;
  select * into r from public.requests where organization_id=customer.organization_id and customer_id=customer.id and creation_key=p_mutation_id;
  if found then return private.request_result(r); end if;
  if (select count(*) from public.requests where customer_id=customer.id and status='DRAFT')>=20 then raise exception 'Draft limit reached' using errcode='54000'; end if;
  insert into public.requests(organization_id,customer_id,creation_key,contact_name,contact_phone,contact_email)
   select customer.organization_id,customer.id,p_mutation_id,coalesce(p.display_name,''),coalesce(p.phone,''),coalesce(u.email,'')
   from public.profiles p join auth.users u on u.id=p.id where p.id=uid returning * into r;
  perform private.customer_event(r.organization_id,'request.created',r.id);
  return private.request_result(r);
 end if;
 select * into r from public.requests where id=p_request_id for update;
 if not found or not private.owns_customer(r.organization_id,r.customer_id) or not private.has_permission(r.organization_id,'account.access')
 then raise exception 'Request unavailable' using errcode='42501'; end if;
 if p_operation not in ('save','submit','cancel') then raise exception 'Invalid operation' using errcode='22023'; end if;
 if p_operation<>'save' and p_payload<>'{}'::jsonb then raise exception 'Unexpected fields' using errcode='22023'; end if;
 if p_operation='submit' and r.status='SUBMITTED' then return private.request_result(r); end if;
 if p_operation='cancel' and r.status='CANCELLED' then return private.request_result(r); end if;
 if r.status<>'DRAFT' then raise exception 'Request is immutable' using errcode='55000'; end if;
 if r.last_mutation_id=p_mutation_id then return private.request_result(r); end if;
 if p_revision is null or r.revision<>p_revision then raise exception 'Draft changed; reload before saving' using errcode='40001'; end if;
 if p_operation='save' then
  if not private.only_keys(p_payload,array['service_id','description','notes','pickup','delivery','items','additional_service_ids','preferred_date','time_window','contact_name','contact_phone','contact_email','contact_notes'])
   or jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')>50
   or jsonb_typeof(p_payload->'additional_service_ids') is distinct from 'array' or jsonb_array_length(p_payload->'additional_service_ids')>10
  then raise exception 'Invalid draft fields' using errcode='22023'; end if;
  selection=nullif(p_payload->>'service_id','')::uuid;
  if selection is not null then
   select property_required into property from public.services where id=selection and organization_id=r.organization_id and active;
   if not found then raise exception 'Service unavailable' using errcode='22023'; end if;
  end if;
  update public.requests set service_id=selection,description=coalesce(p_payload->>'description',''),notes=coalesce(p_payload->>'notes',''),
   preferred_date=nullif(p_payload->>'preferred_date','')::date,time_window=nullif(p_payload->>'time_window',''),
   contact_name=coalesce(p_payload->>'contact_name',''),contact_phone=coalesce(p_payload->>'contact_phone',''),
   contact_email=coalesce(p_payload->>'contact_email',''),contact_notes=coalesce(p_payload->>'contact_notes','') where id=r.id;
  foreach month_key in array array['pickup','delivery'] loop
   location=p_payload->month_key;
   if location is null or not private.only_keys(location,array['city','district','address','notes','floor','elevator','access_notes'])
   then raise exception 'Invalid location' using errcode='22023'; end if;
   if not coalesce(property,false) and (nullif(location->>'floor','') is not null or location->>'elevator' is not null or coalesce(location->>'access_notes','')<>'')
   then raise exception 'Property fields not applicable' using errcode='22023'; end if;
   insert into public.request_locations(request_id,organization_id,kind,city,district,address,notes,floor,elevator,access_notes)
   values(r.id,r.organization_id,month_key,coalesce(location->>'city',''),coalesce(location->>'district',''),coalesce(location->>'address',''),coalesce(location->>'notes',''),nullif(location->>'floor','')::integer,(location->>'elevator')::boolean,coalesce(location->>'access_notes',''))
   on conflict(request_id,kind) do update set city=excluded.city,district=excluded.district,address=excluded.address,notes=excluded.notes,floor=excluded.floor,elevator=excluded.elevator,access_notes=excluded.access_notes;
  end loop;
  delete from public.request_items where request_id=r.id;
  for item in select * from jsonb_array_elements(p_payload->'items') loop
   if not private.only_keys(item,array['description','quantity','notes']) or item->>'quantity' is null or item->>'description' is null then raise exception 'Invalid item' using errcode='22023'; end if;
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
  if not exists(select 1 from public.services where id=r.service_id and organization_id=r.organization_id and active)
   or length(btrim(r.description))=0 or length(btrim(r.contact_name))=0 or r.contact_phone=''
   or r.preferred_date is null or r.preferred_date<(now() at time zone 'Asia/Riyadh')::date or r.time_window is null
   or (r.contact_email<>'' and r.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or (select count(*) from public.request_locations where request_id=r.id and length(btrim(city))>0 and length(btrim(address))>0)<>2
   or not exists(select 1 from public.request_items where request_id=r.id)
   or exists(select 1 from public.request_items where request_id=r.id and length(btrim(description))=0)
   or exists(select 1 from public.request_additional_services a join public.additional_services s on s.id=a.additional_service_id where a.request_id=r.id and not s.active)
   or exists(select 1 from public.request_attachments a join public.file_objects f on f.id=a.file_id where a.request_id=r.id and f.upload_state<>'ready')
  then raise exception 'Complete the request before submitting' using errcode='22023'; end if;
  month_key=to_char(now() at time zone 'Asia/Riyadh','YYYYMM');
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
revoke all on function public.request_command(text,uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.request_command(text,uuid,integer,uuid,jsonb) to authenticated;

create function public.request_file_command(p_operation text,p_request_id uuid,p_file_id uuid,p_mime text default null,p_size integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.requests; f public.file_objects;
begin
 select * into r from public.requests where id=p_request_id for update;
 if not found or not private.owns_customer(r.organization_id,r.customer_id) or not private.has_permission(r.organization_id,'account.access')
 then raise exception 'Request unavailable' using errcode='42501'; end if;
 if p_operation is null or p_operation not in ('reserve','finalize','remove','finish_remove') or p_file_id is null then raise exception 'Invalid file command' using errcode='22023'; end if;
 if r.status<>'DRAFT' and not (r.status='CANCELLED' and p_operation in ('remove','finish_remove')) then raise exception 'Request immutable' using errcode='55000'; end if;
 if p_operation='reserve' then
  select f0.* into f from public.file_objects f0 join public.request_attachments a on a.file_id=f0.id where a.request_id=r.id and f0.id=p_file_id;
  if found then
   if f.owner_profile_id<>auth.uid() or f.mime_type is distinct from p_mime or f.size_bytes is distinct from p_size or f.upload_state<>'pending' then raise exception 'File retry mismatch' using errcode='22023'; end if;
   return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.upload_state);
  end if;
  if p_mime is null or p_mime not in ('image/jpeg','image/png','image/webp') or p_size is null or p_size not between 1 and 3145728 then raise exception 'Invalid image' using errcode='22023'; end if;
  if (select count(*) from public.request_attachments where request_id=r.id)>=8 then raise exception 'Attachment limit' using errcode='54000'; end if;
  insert into public.file_objects(id,organization_id,owner_profile_id,bucket_id,upload_state,mime_type,size_bytes)
   values(p_file_id,r.organization_id,auth.uid(),'attachments','pending',p_mime,p_size) returning * into f;
  insert into public.request_attachments(organization_id,request_id,file_id) values(r.organization_id,r.id,f.id);
 else
  select f0.* into f from public.file_objects f0 join public.request_attachments a on a.file_id=f0.id where a.request_id=r.id and f0.id=p_file_id for update of f0;
  if not found then
   if p_operation='finish_remove' then return jsonb_build_object('removed',true); end if;
   raise exception 'File unavailable' using errcode='42501';
  end if;
  if f.owner_profile_id<>auth.uid() then raise exception 'File unavailable' using errcode='42501'; end if;
  if p_operation='finalize' then
   if f.upload_state='ready' then return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.upload_state); end if;
   if f.upload_state<>'pending' or not exists(select 1 from storage.objects where bucket_id=f.bucket_id and name=f.object_name and (metadata->>'size')::bigint=f.size_bytes and metadata->>'mimetype'=f.mime_type)
   then raise exception 'Upload incomplete' using errcode='22023'; end if;
   update public.file_objects set upload_state='ready' where id=f.id returning * into f;
   perform private.customer_event(r.organization_id,'attachment.associated',f.id,'file_objects');
  elsif p_operation='remove' then
   update public.file_objects set upload_state='removing' where id=f.id returning * into f;
  else
   if f.upload_state<>'removing' or exists(select 1 from storage.objects where bucket_id=f.bucket_id and name=f.object_name) then raise exception 'Remove object first' using errcode='55000'; end if;
   delete from public.request_attachments where request_id=r.id and file_id=f.id;
   delete from public.file_objects where id=f.id;
   perform private.customer_event(r.organization_id,'attachment.deleted',f.id,'file_objects');
   update public.requests set revision=revision+1,last_mutation_id=null where id=r.id;
   return jsonb_build_object('removed',true);
  end if;
 end if;
 update public.requests set revision=revision+1,last_mutation_id=null where id=r.id;
 return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.upload_state);
end $$;
revoke all on function public.request_file_command(text,uuid,uuid,text,integer) from public,anon;
grant execute on function public.request_file_command(text,uuid,uuid,text,integer) to authenticated;

alter table public.additional_services enable row level security;
alter table public.request_locations enable row level security;
alter table public.request_additional_services enable row level security;
revoke all on public.additional_services,public.request_locations,public.request_additional_services from public,anon,authenticated;
grant select on public.additional_services,public.request_locations,public.request_additional_services to authenticated;
create policy additional_services_read on public.additional_services for select to authenticated using(private.is_member(organization_id) and active);
create policy services_customer_read on public.services for select to authenticated using(active and private.has_permission(organization_id,'account.access'));
create policy request_locations_read on public.request_locations for select to authenticated using(private.owns_request(organization_id,request_id) or private.has_permission(organization_id,'requests.read'));
create policy request_additional_read on public.request_additional_services for select to authenticated using(private.owns_request(organization_id,request_id) or private.has_permission(organization_id,'requests.read'));

drop policy registered_private_files_read on storage.objects;
create policy registered_private_files_read on storage.objects for select to authenticated using (
 bucket_id in ('attachments','pod-files','documents') and exists(select 1 from public.file_objects f where f.bucket_id=storage.objects.bucket_id and f.object_name=storage.objects.name and f.upload_state='ready'
 and ((f.owner_profile_id=auth.uid() and private.is_member(f.organization_id)) or private.has_permission(f.organization_id,'files.read')))
);
create policy request_images_insert on storage.objects for insert to authenticated with check(
 bucket_id='attachments' and exists(select 1 from public.file_objects f join public.request_attachments a on a.file_id=f.id join public.requests r on r.id=a.request_id
 where f.bucket_id=storage.objects.bucket_id and f.object_name=storage.objects.name and f.owner_profile_id=auth.uid() and f.upload_state='pending'
 and f.mime_type in ('image/jpeg','image/png','image/webp') and f.size_bytes between 1 and 3145728 and f.created_at>now()-interval '20 minutes'
 and r.status='DRAFT' and private.owns_customer(r.organization_id,r.customer_id) and private.has_permission(r.organization_id,'account.access'))
);
-- Official operation-aware SELECT supports deletion without permitting download/signing.
create policy request_images_delete_lookup on storage.objects for select to authenticated using(
 storage.allow_only_operation('object.delete_many') and bucket_id='attachments' and exists(
 select 1 from public.file_objects f join public.request_attachments a on a.file_id=f.id join public.requests r on r.id=a.request_id
 where f.bucket_id=storage.objects.bucket_id and f.object_name=storage.objects.name and f.owner_profile_id=auth.uid() and f.upload_state='removing'
 and r.status in ('DRAFT','CANCELLED') and private.owns_customer(r.organization_id,r.customer_id))
);
create policy request_images_delete on storage.objects for delete to authenticated using(
 bucket_id='attachments' and exists(select 1 from public.file_objects f join public.request_attachments a on a.file_id=f.id join public.requests r on r.id=a.request_id
 where f.bucket_id=storage.objects.bucket_id and f.object_name=storage.objects.name and f.owner_profile_id=auth.uid() and f.upload_state='removing'
 and r.status in ('DRAFT','CANCELLED') and private.owns_customer(r.organization_id,r.customer_id))
);
