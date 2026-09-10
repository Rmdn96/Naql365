-- Optimistic draft conflicts are permanent for the supplied revision, not serialization failures.
-- SQLSTATE 40001 triggers PostgREST transaction retries; PT409 returns a bounded HTTP conflict.
create or replace function public.request_command(p_operation text, p_request_id uuid, p_revision integer, p_mutation_id uuid, p_payload jsonb default '{}'::jsonb) returns jsonb
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
 if p_revision is null or r.revision<>p_revision then raise exception 'Draft changed; reload before saving' using errcode='PT409'; end if;
 if p_operation='save' then
  if not private.only_keys(p_payload,array['service_id','description','notes','pickup','delivery','items','additional_service_ids','preferred_date','time_window','contact_name','contact_phone','contact_email','contact_notes'])
   or not private.text_fields(p_payload,array['service_id','description','notes','preferred_date','time_window','contact_name','contact_phone','contact_email','contact_notes'])
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
    or not private.text_fields(location,array['city','district','address','notes','access_notes'])
    or (location->'floor' is not null and jsonb_typeof(location->'floor') not in ('number','null'))
    or (location->'elevator' is not null and jsonb_typeof(location->'elevator') not in ('boolean','null'))
   then raise exception 'Invalid location' using errcode='22023'; end if;
   if not coalesce(property,false) and (nullif(location->>'floor','') is not null or location->>'elevator' is not null or coalesce(location->>'access_notes','')<>'')
   then raise exception 'Property fields not applicable' using errcode='22023'; end if;
   insert into public.request_locations(request_id,organization_id,kind,city,district,address,notes,floor,elevator,access_notes)
   values(r.id,r.organization_id,month_key,coalesce(location->>'city',''),coalesce(location->>'district',''),coalesce(location->>'address',''),coalesce(location->>'notes',''),nullif(location->>'floor','')::integer,(location->>'elevator')::boolean,coalesce(location->>'access_notes',''))
   on conflict(request_id,kind) do update set city=excluded.city,district=excluded.district,address=excluded.address,notes=excluded.notes,floor=excluded.floor,elevator=excluded.elevator,access_notes=excluded.access_notes;
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
