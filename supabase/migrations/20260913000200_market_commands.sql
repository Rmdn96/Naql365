-- Explicit market creation; existing creation RPC cannot silently select a country.
-- Optimistic draft conflicts are permanent for the supplied revision, not serialization failures.
-- SQLSTATE 40001 triggers PostgREST transaction retries; PT409 returns a bounded HTTP conflict.
create or replace function public.request_command(p_operation text, p_request_id uuid, p_revision integer, p_mutation_id uuid, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); r public.requests; customer public.customers; selected_value jsonb; location jsonb; item jsonb;
 market public.markets; city_record public.market_cities; month_key text; counter bigint; selection uuid; property boolean; i integer=0;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_operation is null or p_mutation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>60000
 then raise exception 'Invalid command' using errcode='22023'; end if;
 if p_operation='create' then
  if p_request_id is not null or not private.only_keys(p_payload,array['market_id']) or p_payload->>'market_id' is null then raise exception 'Invalid creation input' using errcode='22023'; end if;
  select c.* into customer from public.customers c join private.customer_enrollment e on e.organization_id=c.organization_id
   where c.profile_id=uid and private.owns_customer(c.organization_id,c.id) and private.has_permission(c.organization_id,'account.access');
  if not found then raise exception 'Customer access required' using errcode='42501'; end if;
  perform 1 from public.customers where id=customer.id for update;
  select * into r from public.requests where organization_id=customer.organization_id and customer_id=customer.id and creation_key=p_mutation_id;
  if found then
   if r.market_id is distinct from (p_payload->>'market_id')::uuid then raise exception 'Creation key reused across markets' using errcode='22023'; end if;
   return private.request_result(r); end if;
  select * into market from public.markets where id=(p_payload->>'market_id')::uuid and organization_id=customer.organization_id and active;
  if not found then raise exception 'Active market required' using errcode='22023'; end if;
  if (select count(*) from public.requests where customer_id=customer.id and status='DRAFT')>=20 then raise exception 'Draft limit reached' using errcode='54000'; end if;
  insert into public.requests(organization_id,market_id,customer_id,creation_key,contact_name,contact_phone,contact_email)
   select customer.organization_id,market.id,customer.id,p_mutation_id,coalesce(p.display_name,''),coalesce(p.phone,''),coalesce(u.email,'')
   from public.profiles p join auth.users u on u.id=p.id where p.id=uid returning * into r;
  perform private.customer_event(r.organization_id,'request.created',r.id);
  return private.request_result(r);
 end if;
 select * into r from public.requests where id=p_request_id for update;
 if not found or not private.owns_customer(r.organization_id,r.customer_id) or not private.has_permission(r.organization_id,'account.access')
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

drop function public.create_customer_request(uuid);
create function public.create_customer_request(p_key uuid,p_market_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select public.request_command('create',null,0,p_key,jsonb_build_object('market_id',p_market_id)) $$;
revoke all on function public.create_customer_request(uuid,uuid) from public,anon;
grant execute on function public.create_customer_request(uuid,uuid) to authenticated;

-- Phase 2 trusted commercial commands.
create or replace function private.commercial_event(tenant uuid, event text, entity_type text, entity uuid, details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(tenant,auth.uid(),event,entity_type,entity,details)
$$;
revoke all on function private.commercial_event(uuid,text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function private.next_commercial_reference(kind_value text, prefix text, p_timezone text) returns text
language plpgsql security definer set search_path='' as $$
declare month_key text=to_char(timezone(p_timezone,now()),'YYYYMM'); counter bigint;
begin
 insert into private.commercial_reference_counters(kind,month,value) values(kind_value,month_key,1)
 on conflict(kind,month) do update set value=private.commercial_reference_counters.value+1 returning value into counter;
 return prefix||'-N365-'||month_key||'-'||lpad(counter::text,greatest(6,length(counter::text)),'0');
end $$;
revoke all on function private.next_commercial_reference(text,text,text) from public,anon,authenticated;

create or replace function private.quote_result(v public.quote_versions) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',v.id,'quote_id',v.quote_id,'version',v.version,'status',v.status,'final_subtotal_minor',v.final_subtotal_minor,'vat_rate_bps',v.vat_rate_bps,
 'vat_amount_minor',v.vat_amount_minor,'total_minor',v.total_minor,'currency',v.currency,'expires_at',v.expires_at)
$$;
revoke all on function private.quote_result(public.quote_versions) from public,anon,authenticated;

create or replace function public.calculate_preliminary_price(
 p_request_id uuid, p_distance_km numeric, p_source_note text, p_vehicle_class_id uuid, p_worker_count integer, p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); r public.requests; vehicle public.vehicle_pricing_classes; setting public.pricing_settings; market public.markets; tax public.market_tax_versions;
 distance public.distance_snapshots; evaluation public.pricing_evaluations; rule public.pricing_rules; qty numeric(12,3); line bigint; pos integer=0; subtotal bigint=0; scope text;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into r from public.requests where id=p_request_id for update;
 if not found or r.status<>'SUBMITTED' or not private.has_permission(r.organization_id,'pricing.calculate') then raise exception 'Request unavailable' using errcode='42501'; end if;
 if p_distance_km is null or p_distance_km<=0 or p_distance_km>5000 or scale(p_distance_km)>3 then raise exception 'Invalid verified distance' using errcode='22023'; end if;
 if p_worker_count is null or p_worker_count<1 or p_worker_count>50 or p_mutation_id is null or p_source_note is not null and length(btrim(p_source_note))>300 then raise exception 'Invalid pricing input' using errcode='22023'; end if;
 select * into strict market from public.markets where id=r.market_id and organization_id=r.organization_id;
 if not market.active then raise exception 'Market inactive' using errcode='55000'; end if;
 select * into vehicle from public.vehicle_pricing_classes where organization_id=r.organization_id and id=p_vehicle_class_id and market_id=r.market_id and active;
 if not found then raise exception 'Vehicle class unavailable' using errcode='22023'; end if;
 select * into setting from public.pricing_settings where organization_id=r.organization_id and market_id=r.market_id;
 if not found then raise exception 'Pricing is not configured' using errcode='55000'; end if;
 select * into tax from public.market_tax_versions where organization_id=r.organization_id and market_id=r.market_id and active and effective_from<=now() and (effective_until is null or effective_until>now());
 if not found or (select count(*) from public.market_tax_versions where organization_id=r.organization_id and market_id=r.market_id and active and effective_from<=now() and (effective_until is null or effective_until>now()))<>1 then raise exception 'Exactly one applicable market tax configuration required' using errcode='55000'; end if;
 select * into evaluation from public.pricing_evaluations where organization_id=r.organization_id and calculated_by=uid and mutation_id=p_mutation_id;
 if found then return jsonb_build_object('id',evaluation.id,'subtotal_minor',evaluation.calculated_subtotal_minor,'currency',evaluation.currency,'status',evaluation.status); end if;
 perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text||':'||r.id::text,0));
 update public.pricing_evaluations set status='STALE' where organization_id=r.organization_id and request_id=r.id and status in ('CURRENT','QUOTED');
 insert into public.distance_snapshots(organization_id,request_id,revision,distance_km,source_type,verified_by,source_note)
 select r.organization_id,r.id,coalesce(max(revision),0)+1,p_distance_km,'MANUAL_VERIFIED',uid,nullif(btrim(p_source_note),'') from public.distance_snapshots where organization_id=r.organization_id and request_id=r.id returning * into distance;
 select case when case when p.city_id is not null and d.city_id is not null then p.city_id=d.city_id else lower(btrim(p.city))=lower(btrim(d.city)) end then 'WITHIN_CITY' else 'INTERCITY' end into scope
 from public.request_locations p join public.request_locations d on d.request_id=p.request_id and d.organization_id=p.organization_id and d.kind='delivery'
 where p.request_id=r.id and p.organization_id=r.organization_id and p.kind='pickup';
 if scope is null then raise exception 'Request route unavailable' using errcode='22023'; end if;
 insert into public.pricing_evaluations(organization_id,request_id,distance_snapshot_id,request_revision,route_scope,vehicle_class_id,worker_count,currency,calculated_subtotal_minor,calculated_by,mutation_id,tax_version_id)
 values(r.organization_id,r.id,distance.id,r.revision,scope,vehicle.id,p_worker_count,market.currency,0,uid,p_mutation_id,tax.id) returning * into evaluation;
 for rule in
  select pr.* from public.pricing_rules pr where pr.organization_id=r.organization_id and pr.market_id=r.market_id and pr.active and pr.effective_from<=now() and (pr.effective_until is null or pr.effective_until>now())
  and (
   (pr.component_code='SERVICE' and pr.selector_code=(select code from public.services where id=r.service_id and organization_id=r.organization_id)) or
   (pr.component_code='DISTANCE' and pr.selector_code is null) or
   (pr.component_code='VEHICLE' and pr.selector_code=vehicle.code) or
   (pr.component_code='WORKERS' and pr.selector_code is null) or
   (pr.component_code in ('WITHIN_CITY','INTERCITY') and pr.component_code=scope) or
   (pr.component_code in ('LOADING','UNLOADING','PACKING','DISASSEMBLY','ASSEMBLY') and exists(select 1 from public.request_additional_services ras join public.additional_services a on a.id=ras.additional_service_id and a.organization_id=ras.organization_id where ras.request_id=r.id and ras.organization_id=r.organization_id and upper(a.code)=pr.component_code)) or
   (pr.component_code='FLOOR_ACCESS' and exists(select 1 from public.request_locations l where l.request_id=r.id and l.organization_id=r.organization_id and coalesce(l.floor,0)>0 and coalesce(l.elevator,false)=false)) or
   (pr.component_code='ELEVATOR' and exists(select 1 from public.request_locations l where l.request_id=r.id and l.organization_id=r.organization_id and coalesce(l.floor,0)>0 and l.elevator=true))
  ) order by pr.component_code,pr.code,pr.version
 loop
  qty=case when rule.calculation_method='PER_KM' then distance.distance_km when rule.component_code='WORKERS' then p_worker_count
   when rule.component_code='FLOOR_ACCESS' then (select sum(greatest(coalesce(floor,0),0)) from public.request_locations where request_id=r.id and organization_id=r.organization_id and coalesce(elevator,false)=false)
   when rule.component_code='ELEVATOR' then (select count(*) from public.request_locations where request_id=r.id and organization_id=r.organization_id and coalesce(floor,0)>0 and elevator=true)
   else 1 end;
  line=case when rule.calculation_method='FIXED' then rule.amount_minor else round(rule.amount_minor*qty)::bigint end;
  insert into public.pricing_evaluation_components(organization_id,evaluation_id,pricing_rule_id,pricing_rule_version,component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position)
  values(r.organization_id,evaluation.id,rule.id,rule.version,rule.component_code,rule.label_ar,rule.label_en,qty,rule.amount_minor,line,pos);
  subtotal=subtotal+line; pos=pos+1;
 end loop;
 if pos=0 then raise exception 'No pricing rules apply' using errcode='55000'; end if;
 update public.pricing_evaluations set calculated_subtotal_minor=subtotal where id=evaluation.id returning * into evaluation;
 perform private.commercial_event(r.organization_id,'pricing.calculated','pricing_evaluations',evaluation.id,jsonb_build_object('distance_source','MANUAL_VERIFIED','distance_revision',distance.revision));
 return jsonb_build_object('id',evaluation.id,'subtotal_minor',subtotal,'currency',evaluation.currency,'status',evaluation.status);
end $$;

create or replace function public.create_quote_draft(p_evaluation_id uuid,p_adjustment_minor bigint,p_adjustment_reason text,p_validity_seconds integer,p_mutation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); e public.pricing_evaluations; d public.distance_snapshots; q public.quotes; v public.quote_versions; setting public.pricing_settings; market public.markets; tax public.market_tax_versions; next_version integer; final_amount bigint; vat bigint;
begin
 select * into v from public.quote_versions where id=p_mutation_id for update;
 if found then
  if not private.has_permission(v.organization_id,'quotes.manage') then raise exception 'Quote unavailable' using errcode='42501'; end if;
  return private.quote_result(v);
 end if;
 select * into e from public.pricing_evaluations where id=p_evaluation_id for update;
 if not found or e.status<>'CURRENT' or not private.has_permission(e.organization_id,'quotes.manage') then raise exception 'Evaluation unavailable' using errcode='42501'; end if;
 if p_adjustment_minor is null or e.calculated_subtotal_minor+p_adjustment_minor<0 or p_adjustment_minor<>0 and (p_adjustment_reason is null or length(btrim(p_adjustment_reason)) not between 1 and 500) or p_validity_seconds not between 1 and 2592000 or p_mutation_id is null then raise exception 'Invalid quote terms' using errcode='22023'; end if;
 select * into strict market from public.markets where id=e.market_id and organization_id=e.organization_id;
 select * into tax from public.market_tax_versions where id=e.tax_version_id and organization_id=e.organization_id and market_id=e.market_id;
 if not found or not market.active then raise exception 'Evaluation tax context unavailable; recalculate' using errcode='55000'; end if;
 select * into d from public.distance_snapshots where id=e.distance_snapshot_id and organization_id=e.organization_id;
 insert into public.quotes(organization_id,request_id,reference) values(e.organization_id,e.request_id,private.next_commercial_reference('quote','Q',market.timezone))
 on conflict(organization_id,request_id) do update set request_id=excluded.request_id returning * into q;
 perform pg_advisory_xact_lock(hashtextextended(q.organization_id::text||':'||q.id::text,0));
 select * into v from public.quote_versions where organization_id=q.organization_id and quote_id=q.id and status='DRAFT' for update;
 if found then
  delete from public.quote_items where organization_id=q.organization_id and quote_version_id=v.id;
  delete from public.quote_pricing_details where organization_id=q.organization_id and quote_version_id=v.id;
  delete from public.quote_versions where id=v.id;
 end if;
 select coalesce(max(version),0)+1 into next_version from public.quote_versions where organization_id=q.organization_id and quote_id=q.id;
 final_amount=e.calculated_subtotal_minor+p_adjustment_minor; vat=(final_amount*tax.rate_bps+5000)/10000;
 insert into public.quote_versions(id,organization_id,quote_id,version,distance_km,distance_source,distance_verified_at,final_subtotal_minor,vat_rate_bps,vat_amount_minor,total_minor,validity_seconds,currency,tax_version_id,tax_code,tax_label_ar,tax_label_en)
 values(p_mutation_id,e.organization_id,q.id,next_version,d.distance_km,d.source_type,d.verified_at,final_amount,tax.rate_bps,vat,final_amount+vat,p_validity_seconds,e.currency,tax.id,tax.code,tax.label_ar,tax.label_en) returning * into v;
 insert into public.quote_pricing_details(quote_version_id,organization_id,evaluation_id,calculated_subtotal_minor,manual_adjustment_minor,adjustment_reason,created_by)
 values(v.id,v.organization_id,e.id,e.calculated_subtotal_minor,p_adjustment_minor,case when p_adjustment_minor=0 then null else btrim(p_adjustment_reason) end,uid);
 insert into public.quote_items(organization_id,quote_version_id,component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position)
 select organization_id,v.id,component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position from public.pricing_evaluation_components where evaluation_id=e.id order by position;
 if p_adjustment_minor<>0 then
  insert into public.quote_items(organization_id,quote_version_id,component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position)
  select v.organization_id,v.id,'COMMERCIAL_ADJUSTMENT','تسوية تجارية','Commercial adjustment',1,p_adjustment_minor,p_adjustment_minor,coalesce(max(position),-1)+1 from public.quote_items where quote_version_id=v.id;
 end if;
 update public.pricing_evaluations set status='QUOTED' where id=e.id;
 perform private.commercial_event(e.organization_id,'quote.created','quote_versions',v.id,jsonb_build_object('version',v.version,'manual_adjustment',p_adjustment_minor<>0));
 if p_adjustment_minor<>0 then perform private.commercial_event(e.organization_id,'quote.adjusted','quote_versions',v.id,jsonb_build_object('version',v.version)); end if;
 return private.quote_result(v);
end $$;

create or replace function public.send_quote(p_quote_version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); v public.quote_versions; active public.quote_versions;
begin
 select * into v from public.quote_versions where id=p_quote_version_id for update;
 if not found or not private.has_permission(v.organization_id,'quotes.manage') then raise exception 'Quote unavailable' using errcode='42501'; end if;
 if v.status='SENT' then return private.quote_result(v); end if;
 if v.status<>'DRAFT' or not exists(select 1 from public.quote_pricing_details d join public.pricing_evaluations e on e.id=d.evaluation_id and e.organization_id=d.organization_id where d.quote_version_id=v.id and d.organization_id=v.organization_id and e.status='QUOTED') then raise exception 'Quote cannot be sent' using errcode='55000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v.organization_id::text||':'||v.quote_id::text,0));
 for active in select * from public.quote_versions where organization_id=v.organization_id and quote_id=v.quote_id and id<>v.id and status in ('SENT','VIEWED') for update loop
  update public.quote_versions set status='SUPERSEDED' where id=active.id;
  perform private.commercial_event(v.organization_id,'quote.superseded','quote_versions',active.id,jsonb_build_object('replacement_version_id',v.id));
 end loop;
 update public.quote_pricing_details set sent_by=uid where quote_version_id=v.id and organization_id=v.organization_id;
 update public.quote_versions set status='SENT',sent_at=clock_timestamp(),expires_at=clock_timestamp()+make_interval(secs=>validity_seconds) where id=v.id returning * into v;
 perform private.commercial_event(v.organization_id,'quote.sent','quote_versions',v.id,jsonb_build_object('version',v.version));
 return private.quote_result(v);
end $$;

create or replace function public.view_customer_quote(p_quote_version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.quote_versions; q public.quotes;
begin
 select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
 select * into q from public.quotes where id=v.quote_id;
 if not found or not private.owns_request(q.organization_id,q.request_id) or not private.has_permission(q.organization_id,'account.access') or v.status='DRAFT' then raise exception 'Quote unavailable' using errcode='42501'; end if;
 if v.status in ('SENT','VIEWED') and clock_timestamp()>v.expires_at then update public.quote_versions set status='EXPIRED' where id=v.id returning * into v; perform private.commercial_event(v.organization_id,'quote.expired','quote_versions',v.id); end if;
 if v.status='SENT' then update public.quote_versions set status='VIEWED',viewed_at=now() where id=v.id returning * into v; perform private.commercial_event(v.organization_id,'quote.viewed','quote_versions',v.id,'{"analytics_event":"quote_viewed"}'::jsonb); end if;
 return private.quote_result(v);
end $$;


-- Expiry is a durable lifecycle transition. Returning an application-level
-- failure marker lets PostgreSQL commit the EXPIRED state before the server
-- maps the response to a validation error.
create or replace function public.respond_to_quote(
  p_quote_version_id uuid,
  p_action text,
  p_idempotency_key text,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v public.quote_versions;
  q public.quotes;
  r public.requests;
  existing public.orders;
  created public.orders;
begin
  select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
  select * into q from public.quotes where id=v.quote_id;
  select * into r from public.requests where id=q.request_id and organization_id=q.organization_id;
  if not found or not private.owns_request(q.organization_id,q.request_id) or not private.has_permission(q.organization_id,'account.access') then
    raise exception 'Quote unavailable' using errcode='42501';
  end if;
  if p_action not in ('accept','reject') or p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200 or p_reason is not null and length(p_reason)>500 then
    raise exception 'Invalid response' using errcode='22023';
  end if;
  if p_action='accept' then
    select * into existing from public.orders where organization_id=q.organization_id and accepted_quote_version_id=v.id;
    if found then
      return jsonb_build_object('quote_version_id',v.id,'status','ACCEPTED','order_id',existing.id,'order_reference',existing.reference);
    end if;
  end if;
  if p_action='reject' and v.status='REJECTED' then
    return jsonb_build_object('quote_version_id',v.id,'status',v.status);
  end if;
  if v.status in ('SENT','VIEWED') and clock_timestamp()>v.expires_at then
    update public.quote_versions set status='EXPIRED' where id=v.id returning * into v;
    perform private.commercial_event(v.organization_id,'quote.expired','quote_versions',v.id);
    return jsonb_build_object('quote_version_id',v.id,'status','EXPIRED','error_code','QUOTE_EXPIRED');
  end if;
  if v.status not in ('SENT','VIEWED') then
    raise exception 'Quote cannot be changed' using errcode='55000';
  end if;
  if p_action='reject' then
    update public.quote_versions set status='REJECTED',rejected_at=now(),rejection_reason=nullif(btrim(p_reason),'') where id=v.id returning * into v;
    perform private.commercial_event(v.organization_id,'quote.rejected','quote_versions',v.id);
    return jsonb_build_object('quote_version_id',v.id,'status',v.status);
  end if;
  update public.quote_versions set status='ACCEPTED',accepted_at=now() where id=v.id returning * into v;
  insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,currency,subtotal_minor,vat_amount_minor,total_minor,accepted_at,tax_version_id,tax_code,tax_rate_bps,tax_label_ar,tax_label_en)
  values(v.organization_id,v.quote_id,v.id,p_idempotency_key,private.next_commercial_reference('order','O',(select timezone from public.markets where id=v.market_id)),q.request_id,r.customer_id,v.distance_km,v.distance_source,v.currency,v.final_subtotal_minor,v.vat_amount_minor,v.total_minor,v.accepted_at,v.tax_version_id,v.tax_code,v.vat_rate_bps,v.tax_label_ar,v.tax_label_en)
  returning * into created;
  perform private.commercial_event(v.organization_id,'quote.accepted','quote_versions',v.id,'{"analytics_event":"quote_accepted"}'::jsonb);
  perform private.commercial_event(v.organization_id,'order.created','orders',created.id,jsonb_build_object('quote_version_id',v.id));
  return jsonb_build_object('quote_version_id',v.id,'status',v.status,'order_id',created.id,'order_reference',created.reference);
end $$;

revoke all on function public.respond_to_quote(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.respond_to_quote(uuid,text,text,text) to authenticated;

-- Short tenant-scoped command transactions serialize aggregate/resource changes. Unique
-- constraints additionally protect exclusive assignments and one primary Job per Order.
create or replace function private.next_operational_reference(p_kind text,p_timezone text) returns text
language plpgsql set search_path='' as $$
declare m text=to_char(now() at time zone p_timezone,'YYYYMM'); n bigint;
begin
 insert into private.operational_reference_counters(kind,month,value) values(p_kind,m,1)
 on conflict(kind,month) do update set value=private.operational_reference_counters.value+1 returning value into n;
 return case p_kind when 'job' then 'J' else 'T' end||'-N365-'||m||'-'||lpad(n::text,greatest(6,length(n::text)),'0');
end $$;
create or replace function private.operational_event(p_org uuid,p_trip uuid,p_action text,p_stop uuid default null,p_facts jsonb default '{}') returns void
language plpgsql set search_path='' as $$
begin
 insert into public.trip_events(organization_id,trip_id,event_type,stop_id,actor_id,metadata)
 values(p_org,p_trip,p_action,p_stop,auth.uid(),p_facts);
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(p_org,auth.uid(),p_action,'trips',p_trip,p_facts);
end $$;
create or replace function private.refresh_job_progress(p_job uuid) returns void language plpgsql set search_path='' as $$
declare j public.jobs; next_status text;
begin
 select * into strict j from public.jobs where id=p_job for update;
 select case
 when not exists(select 1 from public.trips where job_id=j.id) then 'OPEN'
 when exists(select 1 from public.trips where job_id=j.id and status in ('FAILED','CANCELLED')) then 'EXCEPTION'
 when not exists(select 1 from public.trips where job_id=j.id and status<>'COMPLETED') then 'COMPLETED'
 else 'IN_PROGRESS' end into next_status;
 if j.status<>next_status then
  update public.jobs set status=next_status,revision=revision+1,completed_at=case when next_status='COMPLETED' then now() end where id=j.id;
  update public.orders set operational_status=case when next_status='OPEN' then 'IN_PROGRESS' else next_status end,
   operational_completed_at=case when next_status='COMPLETED' then now() end where id=j.order_id;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(j.organization_id,auth.uid(),'JOB_'||next_status,'jobs',j.id,jsonb_build_object('status',next_status));
  if next_status='COMPLETED' then
   insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id) values(j.organization_id,auth.uid(),'ORDER_OPERATIONALLY_COMPLETED','orders',j.order_id);
  end if;
 end if;
end $$;
create or replace function private.validate_trip_plan(p_trip uuid) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.trip_stops where trip_id=p_trip and kind='PICKUP')
 or not exists(select 1 from public.trip_stops where trip_id=p_trip and kind='DELIVERY')
 or exists(select 1 from public.trip_stops where trip_id=p_trip and (kind is null or address is null))
 or (select kind from public.trip_stops where trip_id=p_trip order by position limit 1)<>'PICKUP'
 or (select kind from public.trip_stops where trip_id=p_trip order by position desc limit 1)<>'DELIVERY'
 or exists(select 1 from public.trip_stops s where s.trip_id=p_trip and s.kind='DELIVERY' and not exists(select 1 from public.trip_stop_dependencies d where d.delivery_stop_id=s.id))
 or exists(select 1 from public.trip_stop_dependencies d join public.trip_stops pickup on pickup.id=d.pickup_stop_id
 join public.trip_stops delivery on delivery.id=d.delivery_stop_id where d.trip_id=p_trip and
 (pickup.kind<>'PICKUP' or delivery.kind<>'DELIVERY' or pickup.position>=delivery.position))
 then raise exception 'Incomplete or invalid stop dependencies' using errcode='22023'; end if;
end $$;

create or replace function public.operations_command(p_organization_id uuid,p_action text,p_entity_id uuid,p_revision integer,p_mutation_id uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 required_permission text; intent jsonb; prior private.operational_mutations; result jsonb;
 j public.jobs; t public.trips; s public.trip_stops; a public.assignments; o public.orders;
 new_id uuid; item jsonb; dependency jsonb; pos integer; did uuid; vid uuid; why text;
 next_status text; actor uuid=auth.uid(); facts jsonb='{}';
begin
 required_permission=case when p_action in ('create_driver','create_vehicle','set_driver_active','set_vehicle_active') then 'fleet.manage'
 when p_action in ('assign','reassign','ready','dispatch','arrive','start_service','complete_stop','depart','complete_trip','cancel','fail') then 'dispatch.manage' else 'operations.manage' end;
 if actor is null or not private.has_permission(p_organization_id,required_permission) then raise exception 'Operational access denied' using errcode='42501'; end if;
 if p_mutation_id is null or p_entity_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768
 then raise exception 'Invalid command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_mutation_id::text,33));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,34));
 intent=jsonb_build_object('action',p_action,'entity',p_entity_id,'revision',p_revision,'payload',p_payload);
 select * into prior from private.operational_mutations where actor_id=actor and mutation_id=p_mutation_id;
 if found then
  if prior.organization_id<>p_organization_id or prior.intent<>intent then raise exception 'Mutation identity reused' using errcode='22023'; end if;
  return prior.result;
 end if;
 if p_action in ('create_driver','create_vehicle') then
  if not exists(select 1 from public.markets where id=(p_payload->>'marketId')::uuid and organization_id=p_organization_id and active) then raise exception 'Active resource market required' using errcode='22023'; end if;
  new_id=gen_random_uuid();
  if p_action='create_driver' then
   if p_payload->>'type' is null or nullif(btrim(p_payload->>'name'),'') is null then raise exception 'Driver facts required' using errcode='22023'; end if;
   insert into public.drivers(id,organization_id,market_id,driver_type,display_name,active)
    values(new_id,p_organization_id,(p_payload->>'marketId')::uuid,p_payload->>'type',btrim(p_payload->>'name'),true);
  else
   if nullif(btrim(p_payload->>'identifier'),'') is null or nullif(btrim(p_payload->>'type'),'') is null then raise exception 'Vehicle facts required' using errcode='22023'; end if;
   insert into public.vehicles(id,organization_id,market_id,identifier,vehicle_type,active)
    values(new_id,p_organization_id,(p_payload->>'marketId')::uuid,btrim(p_payload->>'identifier'),btrim(p_payload->>'type'),true);
  end if;
  result=jsonb_build_object('id',new_id,'revision',0);
 elsif p_action in ('set_driver_active','set_vehicle_active') then
  if jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception 'Active flag required' using errcode='22023'; end if;
  if exists(select 1 from public.assignments where organization_id=p_organization_id and execution_active and
   ((p_action='set_driver_active' and driver_id=p_entity_id) or (p_action='set_vehicle_active' and vehicle_id=p_entity_id)))
  then raise exception 'Executing resource cannot be deactivated' using errcode='55000'; end if;
  if p_action='set_driver_active' then update public.drivers set active=(p_payload->>'active')::boolean where id=p_entity_id and organization_id=p_organization_id;
  else update public.vehicles set active=(p_payload->>'active')::boolean where id=p_entity_id and organization_id=p_organization_id; end if;
  if not found then raise exception 'Resource unavailable' using errcode='42501'; end if;
  result=jsonb_build_object('id',p_entity_id,'revision',0);
 elsif p_action='create_job' then
  select * into o from public.orders where id=p_entity_id and organization_id=p_organization_id for update;
  if not found or o.accepted_at is null or not exists(select 1 from public.quote_versions where id=o.accepted_quote_version_id and status='ACCEPTED')
  then raise exception 'Accepted Order required' using errcode='42501'; end if;
  select * into j from public.jobs where organization_id=p_organization_id and order_id=o.id;
  if not found then
   insert into public.jobs(organization_id,order_id,reference) values(p_organization_id,o.id,private.next_operational_reference('job',(select timezone from public.markets where id=o.market_id))) returning * into j;
   update public.orders set operational_status='IN_PROGRESS' where id=o.id;
  end if;
  result=jsonb_build_object('id',j.id,'revision',j.revision);
 elsif p_action='create_trip' then
  select * into j from public.jobs where id=p_entity_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Job unavailable' using errcode='42501'; end if;
  if j.status='COMPLETED' then raise exception 'Job complete' using errcode='55000'; end if;
  if p_revision is distinct from j.revision then raise exception 'Job changed' using errcode='40001'; end if;
  insert into public.trips(organization_id,job_id,reference) values(p_organization_id,j.id,private.next_operational_reference('trip',(select timezone from public.markets where id=j.market_id))) returning * into t;
  update public.jobs set revision=revision+1 where id=j.id;
  perform private.operational_event(p_organization_id,t.id,'TRIP_CREATED');
  perform private.refresh_job_progress(j.id);
  result=jsonb_build_object('id',t.id,'revision',t.revision);
 else
  select * into t from public.trips where id=p_entity_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Trip unavailable' using errcode='42501'; end if;
  perform 1 from public.jobs where id=t.job_id for update;
  if p_revision is distinct from t.revision then raise exception 'Trip changed' using errcode='40001'; end if;
  if t.status in ('COMPLETED','CANCELLED','FAILED') then raise exception 'Terminal Trip' using errcode='55000'; end if;
  next_status=t.status;
  if p_action='plan' then
   if t.started_at is not null then raise exception 'Execution plan frozen' using errcode='55000'; end if;
   if jsonb_typeof(p_payload->'stops') is distinct from 'array' or jsonb_array_length(p_payload->'stops') not between 2 and 40
    or p_payload->>'plannedStart' is null or p_payload->>'plannedEnd' is null
    then raise exception 'Bounded stop plan and window required' using errcode='22023'; end if;
   delete from public.trip_stop_dependencies where trip_id=t.id;
   delete from public.trip_stops where trip_id=t.id;
   pos=0;
   for item in select value from jsonb_array_elements(p_payload->'stops') loop
    if item->>'kind' is null or nullif(btrim(item->>'address'),'') is null then raise exception 'Stop facts required' using errcode='22023'; end if;
    insert into public.trip_stops(organization_id,trip_id,position,kind,address,notes,city_id)
     values(p_organization_id,t.id,pos,item->>'kind',btrim(item->>'address'),coalesce(item->>'notes',''),(item->>'cityId')::uuid);
    pos=pos+1;
   end loop;
   pos=0;
   for item in select value from jsonb_array_elements(p_payload->'stops') loop
    if jsonb_typeof(item->'pickups') is distinct from 'array' then raise exception 'Pickup dependencies required' using errcode='22023'; end if;
    for dependency in select value from jsonb_array_elements(item->'pickups') loop
     select id into did from public.trip_stops where trip_id=t.id and position=(dependency#>>'{}')::integer;
     select id into vid from public.trip_stops where trip_id=t.id and position=pos;
     insert into public.trip_stop_dependencies values(p_organization_id,t.id,vid,did);
    end loop;
    pos=pos+1;
   end loop;
   if exists(select 1 from public.trip_stops where trip_id=t.id and city_id is null) then raise exception 'Structured Stop city required' using errcode='22023'; end if;
   perform private.validate_trip_plan(t.id);
   update public.trips set planned_start=(p_payload->>'plannedStart')::timestamptz,planned_end=(p_payload->>'plannedEnd')::timestamptz where id=t.id;
   next_status=case when exists(select 1 from public.assignments where trip_id=t.id and ended_at is null) then 'ASSIGNED' else 'PLANNED' end;
   facts=jsonb_build_object('stop_count',pos);
  elsif p_action in ('assign','reassign') then
   if (p_action='assign' and t.started_at is not null) or (p_action='reassign' and t.started_at is null)
   then raise exception 'Use appropriate assignment action' using errcode='55000'; end if;
   why=coalesce(btrim(p_payload->>'reason'),'');
   if p_action='reassign' and (length(why) not between 1 and 500 or p_payload->'confirmed' is distinct from 'true'::jsonb)
   then raise exception 'Confirmed emergency reason required' using errcode='22023'; end if;
   did=(p_payload->>'driverId')::uuid; vid=(p_payload->>'vehicleId')::uuid;
   if not exists(select 1 from public.drivers where id=did and organization_id=p_organization_id and market_id=t.market_id and active)
    or not exists(select 1 from public.vehicles where id=vid and organization_id=p_organization_id and market_id=t.market_id and active)
   then raise exception 'Active same-tenant resources required' using errcode='42501'; end if;
   select * into a from public.assignments where trip_id=t.id and ended_at is null for update;
   if found and a.driver_id=did and a.vehicle_id=vid then raise exception 'Assignment unchanged' using errcode='22023'; end if;
   update public.assignments set ended_at=now(),execution_active=false where trip_id=t.id and ended_at is null;
   insert into public.assignments(organization_id,trip_id,driver_id,vehicle_id,assigned_by,reason,execution_active)
    values(p_organization_id,t.id,did,vid,actor,why,t.started_at is not null);
   next_status=case when t.started_at is null then 'ASSIGNED' else t.status end;
   facts=jsonb_build_object('previous_assignment',a.id,'driver_id',did,'vehicle_id',vid,'reason',why);
  elsif p_action='ready' then
   if t.status<>'ASSIGNED' or t.planned_start is null or t.planned_end is null then raise exception 'Assigned and scheduled Trip required' using errcode='55000'; end if;
   if exists(select 1 from public.trip_stops where trip_id=t.id and city_id is null) then raise exception 'Structured Stop city required' using errcode='22023'; end if;
   perform private.validate_trip_plan(t.id);
   if not exists(select 1 from public.assignments candidate join public.drivers d on d.id=candidate.driver_id join public.vehicles v on v.id=candidate.vehicle_id
    where candidate.trip_id=t.id and candidate.ended_at is null and d.active and v.active)
   then raise exception 'Active resources required' using errcode='55000'; end if;
   next_status='READY';
  elsif p_action='dispatch' then
   if t.status<>'READY' then raise exception 'Ready Trip required' using errcode='55000'; end if;
   if exists(select 1 from public.trip_stops where trip_id=t.id and city_id is null) then raise exception 'Structured Stop city required' using errcode='22023'; end if;
   perform private.validate_trip_plan(t.id);
   if not exists(select 1 from public.assignments candidate join public.drivers d on d.id=candidate.driver_id join public.vehicles v on v.id=candidate.vehicle_id
    where candidate.trip_id=t.id and candidate.ended_at is null and d.active and v.active)
   then raise exception 'Active resources required' using errcode='55000'; end if;
   update public.assignments set execution_active=true where trip_id=t.id and ended_at is null;
   select * into s from public.trip_stops where trip_id=t.id order by position limit 1;
   update public.trip_stops set status='EN_ROUTE' where id=s.id;
   update public.trips set started_at=now() where id=t.id;
   next_status='EN_ROUTE_TO_PICKUP';
  elsif p_action in ('arrive','start_service','complete_stop','depart') then
   if t.started_at is null then raise exception 'Dispatch required' using errcode='55000'; end if;
   select * into s from public.trip_stops where trip_id=t.id and status<>'COMPLETED' order by position limit 1 for update;
   if not found or s.id is distinct from (p_payload->>'stopId')::uuid then raise exception 'Current Stop required' using errcode='55000'; end if;
   if s.kind='DELIVERY' and exists(select 1 from public.trip_stop_dependencies dep join public.trip_stops pickup on pickup.id=dep.pickup_stop_id where dep.delivery_stop_id=s.id and pickup.status<>'COMPLETED')
    then raise exception 'Pickup dependencies incomplete' using errcode='55000'; end if;
   if p_action='depart' and s.status='PENDING' then
    update public.trip_stops set status='EN_ROUTE' where id=s.id;
    next_status=case when s.kind='PICKUP' then 'EN_ROUTE_TO_PICKUP' else 'IN_TRANSIT' end;
   elsif p_action='arrive' and s.status='EN_ROUTE' then
    update public.trip_stops set status='ARRIVED',arrived_at=now() where id=s.id;
    next_status=case when s.kind='PICKUP' then 'AT_PICKUP' else 'AT_DELIVERY' end;
   elsif p_action='start_service' and s.status='ARRIVED' then
    update public.trip_stops set status='IN_PROGRESS' where id=s.id;
    next_status=case when s.kind='PICKUP' then 'PICKUP_IN_PROGRESS' else 'DELIVERY_IN_PROGRESS' end;
   elsif p_action='complete_stop' and s.status='IN_PROGRESS' then
    update public.trip_stops set status='COMPLETED',completed_at=now() where id=s.id;
    next_status=case when s.kind='PICKUP' then 'PICKED_UP' else 'DELIVERED' end;
   else raise exception 'Invalid Stop transition' using errcode='55000'; end if;
  elsif p_action='complete_trip' then
   if t.status<>'DELIVERED' or not exists(select 1 from public.trip_stops where trip_id=t.id)
    or exists(select 1 from public.trip_stops where trip_id=t.id and status<>'COMPLETED')
    or not exists(select 1 from public.trip_pods where trip_id=t.id and state='FINAL')
    then raise exception 'Completed Stops and final POD required' using errcode='55000'; end if;
   next_status='COMPLETED';
   update public.trips set status='COMPLETED',completed_at=now() where id=t.id;
   update public.assignments set execution_active=false,ended_at=now() where trip_id=t.id and ended_at is null;
  elsif p_action in ('cancel','fail') then
   why=btrim(p_payload->>'reason');
   if why is null or length(why) not between 1 and 500 then raise exception 'Exception reason required' using errcode='22023'; end if;
   next_status=case p_action when 'cancel' then 'CANCELLED' else 'FAILED' end;
   update public.assignments set execution_active=false,ended_at=now() where trip_id=t.id and ended_at is null;
   facts=jsonb_build_object('reason',why);
  else raise exception 'Unsupported operational action' using errcode='22023'; end if;
  update public.trips set status=next_status,revision=revision+1 where id=t.id returning * into t;
  perform private.operational_event(p_organization_id,t.id,upper(p_action),s.id,facts);
  perform private.refresh_job_progress(t.job_id);
  result=jsonb_build_object('id',t.id,'revision',t.revision,'status',t.status);
 end if;
 if p_action in ('create_driver','create_vehicle','set_driver_active','set_vehicle_active','create_job') then
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id)
  values(p_organization_id,actor,upper(p_action),case when p_action='create_job' then 'jobs' else 'resources' end,(result->>'id')::uuid);
 end if;
 insert into private.operational_mutations(actor_id,mutation_id,organization_id,intent,result) values(actor,p_mutation_id,p_organization_id,intent,result);
 return result;
end $$;
revoke all on function private.next_operational_reference(text,text),private.operational_event(uuid,uuid,text,uuid,jsonb),private.refresh_job_progress(uuid),private.validate_trip_plan(uuid) from public,anon,authenticated;
revoke all on function public.operations_command(uuid,text,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.operations_command(uuid,text,uuid,integer,uuid,jsonb) to authenticated;

-- No obsolete Saudi-default private reference path remains.
drop function private.next_commercial_reference(text,text);
drop function private.next_operational_reference(text);
