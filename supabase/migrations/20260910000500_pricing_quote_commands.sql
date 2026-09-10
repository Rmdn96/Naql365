-- Phase 2 trusted commercial commands.
create function private.commercial_event(tenant uuid, event text, entity_type text, entity uuid, details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
 values(tenant,auth.uid(),event,entity_type,entity,details)
$$;
revoke all on function private.commercial_event(uuid,text,text,uuid,jsonb) from public,anon,authenticated;

create function private.next_commercial_reference(kind_value text, prefix text) returns text
language plpgsql security definer set search_path='' as $$
declare month_key text=to_char(timezone('Asia/Riyadh',now()),'YYYYMM'); counter bigint;
begin
 insert into private.commercial_reference_counters(kind,month,value) values(kind_value,month_key,1)
 on conflict(kind,month) do update set value=private.commercial_reference_counters.value+1 returning value into counter;
 return prefix||'-N365-'||month_key||'-'||lpad(counter::text,greatest(6,length(counter::text)),'0');
end $$;
revoke all on function private.next_commercial_reference(text,text) from public,anon,authenticated;

create function private.quote_result(v public.quote_versions) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',v.id,'quote_id',v.quote_id,'version',v.version,'status',v.status,'final_subtotal_minor',v.final_subtotal_minor,'vat_rate_bps',v.vat_rate_bps,
 'vat_amount_minor',v.vat_amount_minor,'total_minor',v.total_minor,'currency',v.currency,'expires_at',v.expires_at)
$$;
revoke all on function private.quote_result(public.quote_versions) from public,anon,authenticated;

create function public.calculate_preliminary_price(
 p_request_id uuid, p_distance_km numeric, p_source_note text, p_vehicle_class_id uuid, p_worker_count integer, p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); r public.requests; vehicle public.vehicle_pricing_classes; setting public.pricing_settings;
 distance public.distance_snapshots; evaluation public.pricing_evaluations; rule public.pricing_rules; qty numeric(12,3); line bigint; pos integer=0; subtotal bigint=0; scope text;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into r from public.requests where id=p_request_id for update;
 if not found or r.status<>'SUBMITTED' or not private.has_permission(r.organization_id,'pricing.calculate') then raise exception 'Request unavailable' using errcode='42501'; end if;
 if p_distance_km is null or p_distance_km<=0 or p_distance_km>5000 or scale(p_distance_km)>3 then raise exception 'Invalid verified distance' using errcode='22023'; end if;
 if p_worker_count is null or p_worker_count<1 or p_worker_count>50 or p_mutation_id is null or p_source_note is not null and length(btrim(p_source_note))>300 then raise exception 'Invalid pricing input' using errcode='22023'; end if;
 select * into vehicle from public.vehicle_pricing_classes where organization_id=r.organization_id and id=p_vehicle_class_id and active;
 if not found then raise exception 'Vehicle class unavailable' using errcode='22023'; end if;
 select * into setting from public.pricing_settings where organization_id=r.organization_id;
 if not found then raise exception 'Pricing is not configured' using errcode='55000'; end if;
 select * into evaluation from public.pricing_evaluations where organization_id=r.organization_id and calculated_by=uid and mutation_id=p_mutation_id;
 if found then return jsonb_build_object('id',evaluation.id,'subtotal_minor',evaluation.calculated_subtotal_minor,'currency',evaluation.currency,'status',evaluation.status); end if;
 perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text||':'||r.id::text,0));
 update public.pricing_evaluations set status='STALE' where organization_id=r.organization_id and request_id=r.id and status in ('CURRENT','QUOTED');
 insert into public.distance_snapshots(organization_id,request_id,revision,distance_km,source_type,verified_by,source_note)
 select r.organization_id,r.id,coalesce(max(revision),0)+1,p_distance_km,'MANUAL_VERIFIED',uid,nullif(btrim(p_source_note),'') from public.distance_snapshots where organization_id=r.organization_id and request_id=r.id returning * into distance;
 select case when lower(btrim(p.city))=lower(btrim(d.city)) then 'WITHIN_CITY' else 'INTERCITY' end into scope
 from public.request_locations p join public.request_locations d on d.request_id=p.request_id and d.organization_id=p.organization_id and d.kind='delivery'
 where p.request_id=r.id and p.organization_id=r.organization_id and p.kind='pickup';
 if scope is null then raise exception 'Request route unavailable' using errcode='22023'; end if;
 insert into public.pricing_evaluations(organization_id,request_id,distance_snapshot_id,request_revision,route_scope,vehicle_class_id,worker_count,currency,calculated_subtotal_minor,calculated_by,mutation_id)
 values(r.organization_id,r.id,distance.id,r.revision,scope,vehicle.id,p_worker_count,setting.currency,0,uid,p_mutation_id) returning * into evaluation;
 for rule in
  select pr.* from public.pricing_rules pr where pr.organization_id=r.organization_id and pr.active and pr.effective_from<=now() and (pr.effective_until is null or pr.effective_until>now())
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

create function public.create_quote_draft(p_evaluation_id uuid,p_adjustment_minor bigint,p_adjustment_reason text,p_validity_seconds integer,p_mutation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); e public.pricing_evaluations; d public.distance_snapshots; q public.quotes; v public.quote_versions; setting public.pricing_settings; next_version integer; final_amount bigint; vat bigint;
begin
 select * into v from public.quote_versions where id=p_mutation_id for update;
 if found then
  if not private.has_permission(v.organization_id,'quotes.manage') then raise exception 'Quote unavailable' using errcode='42501'; end if;
  return private.quote_result(v);
 end if;
 select * into e from public.pricing_evaluations where id=p_evaluation_id for update;
 if not found or e.status<>'CURRENT' or not private.has_permission(e.organization_id,'quotes.manage') then raise exception 'Evaluation unavailable' using errcode='42501'; end if;
 if p_adjustment_minor is null or e.calculated_subtotal_minor+p_adjustment_minor<0 or p_adjustment_minor<>0 and (p_adjustment_reason is null or length(btrim(p_adjustment_reason)) not between 1 and 500) or p_validity_seconds not between 1 and 2592000 or p_mutation_id is null then raise exception 'Invalid quote terms' using errcode='22023'; end if;
 select * into setting from public.pricing_settings where organization_id=e.organization_id;
 select * into d from public.distance_snapshots where id=e.distance_snapshot_id and organization_id=e.organization_id;
 insert into public.quotes(organization_id,request_id,reference) values(e.organization_id,e.request_id,private.next_commercial_reference('quote','Q'))
 on conflict(organization_id,request_id) do update set request_id=excluded.request_id returning * into q;
 perform pg_advisory_xact_lock(hashtextextended(q.organization_id::text||':'||q.id::text,0));
 select * into v from public.quote_versions where organization_id=q.organization_id and quote_id=q.id and status='DRAFT' for update;
 if found then
  delete from public.quote_items where organization_id=q.organization_id and quote_version_id=v.id;
  delete from public.quote_pricing_details where organization_id=q.organization_id and quote_version_id=v.id;
  delete from public.quote_versions where id=v.id;
 end if;
 select coalesce(max(version),0)+1 into next_version from public.quote_versions where organization_id=q.organization_id and quote_id=q.id;
 final_amount=e.calculated_subtotal_minor+p_adjustment_minor; vat=(final_amount*setting.vat_rate_bps+5000)/10000;
 insert into public.quote_versions(id,organization_id,quote_id,version,distance_km,distance_source,distance_verified_at,final_subtotal_minor,vat_rate_bps,vat_amount_minor,total_minor,validity_seconds)
 values(p_mutation_id,e.organization_id,q.id,next_version,d.distance_km,d.source_type,d.verified_at,final_amount,setting.vat_rate_bps,vat,final_amount+vat,p_validity_seconds) returning * into v;
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

create function public.send_quote(p_quote_version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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

create function public.view_customer_quote(p_quote_version_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.quote_versions; q public.quotes;
begin
 select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
 select * into q from public.quotes where id=v.quote_id;
 if not found or not private.owns_request(q.organization_id,q.request_id) or not private.has_permission(q.organization_id,'account.access') or v.status='DRAFT' then raise exception 'Quote unavailable' using errcode='42501'; end if;
 if v.status in ('SENT','VIEWED') and clock_timestamp()>v.expires_at then update public.quote_versions set status='EXPIRED' where id=v.id returning * into v; perform private.commercial_event(v.organization_id,'quote.expired','quote_versions',v.id); end if;
 if v.status='SENT' then update public.quote_versions set status='VIEWED',viewed_at=now() where id=v.id returning * into v; perform private.commercial_event(v.organization_id,'quote.viewed','quote_versions',v.id,'{"analytics_event":"quote_viewed"}'::jsonb); end if;
 return private.quote_result(v);
end $$;

create function public.respond_to_quote(p_quote_version_id uuid,p_action text,p_idempotency_key text,p_reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.quote_versions; q public.quotes; r public.requests; existing public.orders; created public.orders;
begin
 select qv.* into v from public.quote_versions qv where qv.id=p_quote_version_id for update;
 select * into q from public.quotes where id=v.quote_id;
 select * into r from public.requests where id=q.request_id and organization_id=q.organization_id;
 if not found or not private.owns_request(q.organization_id,q.request_id) or not private.has_permission(q.organization_id,'account.access') then raise exception 'Quote unavailable' using errcode='42501'; end if;
 if p_action not in ('accept','reject') or p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200 or p_reason is not null and length(p_reason)>500 then raise exception 'Invalid response' using errcode='22023'; end if;
 if p_action='accept' then
  select * into existing from public.orders where organization_id=q.organization_id and accepted_quote_version_id=v.id;
  if found then return jsonb_build_object('quote_version_id',v.id,'status','ACCEPTED','order_id',existing.id,'order_reference',existing.reference); end if;
 end if;
 if p_action='reject' and v.status='REJECTED' then return jsonb_build_object('quote_version_id',v.id,'status',v.status); end if;
 if v.status in ('SENT','VIEWED') and clock_timestamp()>v.expires_at then update public.quote_versions set status='EXPIRED' where id=v.id; perform private.commercial_event(v.organization_id,'quote.expired','quote_versions',v.id); raise exception 'Quote expired' using errcode='55000'; end if;
 if v.status not in ('SENT','VIEWED') then raise exception 'Quote cannot be changed' using errcode='55000'; end if;
 if p_action='reject' then
  update public.quote_versions set status='REJECTED',rejected_at=now(),rejection_reason=nullif(btrim(p_reason),'') where id=v.id returning * into v;
  perform private.commercial_event(v.organization_id,'quote.rejected','quote_versions',v.id);
  return jsonb_build_object('quote_version_id',v.id,'status',v.status);
 end if;
 update public.quote_versions set status='ACCEPTED',accepted_at=now() where id=v.id returning * into v;
 insert into public.orders(organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,currency,subtotal_minor,vat_amount_minor,total_minor,accepted_at)
 values(v.organization_id,v.quote_id,v.id,p_idempotency_key,private.next_commercial_reference('order','O'),q.request_id,r.customer_id,v.distance_km,v.distance_source,v.currency,v.final_subtotal_minor,v.vat_amount_minor,v.total_minor,v.accepted_at)
 returning * into created;
 perform private.commercial_event(v.organization_id,'quote.accepted','quote_versions',v.id,'{"analytics_event":"quote_accepted"}'::jsonb);
 perform private.commercial_event(v.organization_id,'order.created','orders',created.id,jsonb_build_object('quote_version_id',v.id));
 return jsonb_build_object('quote_version_id',v.id,'status',v.status,'order_id',created.id,'order_reference',created.reference);
end $$;

revoke all on function public.calculate_preliminary_price(uuid,numeric,text,uuid,integer,uuid),public.create_quote_draft(uuid,bigint,text,integer,uuid),public.send_quote(uuid),public.view_customer_quote(uuid),public.respond_to_quote(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.calculate_preliminary_price(uuid,numeric,text,uuid,integer,uuid),public.create_quote_draft(uuid,bigint,text,integer,uuid),public.send_quote(uuid) to authenticated;
grant execute on function public.view_customer_quote(uuid),public.respond_to_quote(uuid,text,text,text) to authenticated;
