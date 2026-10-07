-- Existing configured markets retain AUTOMATED; only new settings default MANUAL.
-- No commercial snapshot, city activation, or Production configuration is changed.
alter table public.pricing_settings add column pricing_mode text not null default 'AUTOMATED'
 check(pricing_mode in ('MANUAL','AUTOMATED'));
alter table public.pricing_settings alter column pricing_mode set default 'MANUAL';
grant select on public.pricing_settings to authenticated;
create policy pricing_mode_sales_read on public.pricing_settings for select to authenticated using(private.has_permission(organization_id,'quotes.manage'));
create trigger pricing_settings_audit after insert or update or delete on public.pricing_settings for each row execute function private.audit_change();

alter table public.service_areas add column pickup_eligible boolean not null default true,
 add column delivery_eligible boolean not null default true;
-- Preserve existing coverage on upgrade; newly configured rows require explicit directions.
alter table public.service_areas alter column pickup_eligible set default false,
 alter column delivery_eligible set default false;

create table public.service_addon_applicability (
 organization_id uuid not null, market_id uuid not null, service_id uuid not null,
 additional_service_id uuid not null, active boolean not null default false,
 primary key(organization_id,market_id,service_id,additional_service_id),
 foreign key(organization_id,market_id,service_id) references public.market_services(organization_id,market_id,service_id),
 foreign key(organization_id,additional_service_id) references public.additional_services(organization_id,id)
);
-- Existing organization-wide options retain their scope on upgrade only.
insert into public.service_addon_applicability
 select ms.organization_id,ms.market_id,ms.service_id,a.id,a.active
 from public.market_services ms join public.additional_services a on a.organization_id=ms.organization_id;
alter table public.service_addon_applicability enable row level security;
revoke all on public.service_addon_applicability from public,anon,authenticated;
grant select on public.service_addon_applicability to anon,authenticated;
create policy addon_staff_read on public.service_addon_applicability for select to authenticated using(private.has_permission(organization_id,'services.read'));
create policy addon_member_read on public.service_addon_applicability for select to authenticated using(active and private.is_member(organization_id));
create policy addon_active_read on public.service_addon_applicability for select to anon
 using(active and public.guest_catalogue_visible(organization_id) and exists(select 1 from public.market_services ms where ms.organization_id=service_addon_applicability.organization_id and ms.market_id=service_addon_applicability.market_id and ms.service_id=service_addon_applicability.service_id and ms.active));

create function private.request_coverage_valid(r public.requests) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.markets m join public.market_services ms on ms.market_id=m.id and ms.organization_id=m.organization_id
 join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where m.id=r.market_id and m.organization_id=r.organization_id and m.active and ms.service_id=r.service_id and ms.active and s.active)
 and (select count(*) from public.request_locations l where l.request_id=r.id and l.organization_id=r.organization_id)=2
 and not exists(select 1 from public.request_locations l where l.request_id=r.id and not exists(
 select 1 from public.service_areas a where a.organization_id=r.organization_id and a.market_id=r.market_id and a.service_id=r.service_id and a.city_id=l.city_id and a.active
 and case l.kind when 'pickup' then a.pickup_eligible when 'delivery' then a.delivery_eligible else false end))
 and not exists(select 1 from public.request_additional_services ra where ra.request_id=r.id and not exists(
 select 1 from public.service_addon_applicability a join public.additional_services s on s.id=a.additional_service_id and s.organization_id=a.organization_id
 where a.organization_id=r.organization_id and a.market_id=r.market_id and a.service_id=r.service_id and a.additional_service_id=ra.additional_service_id and a.active and s.active))
$$;
revoke all on function private.request_coverage_valid(public.requests) from public,anon,authenticated;

alter table public.quote_pricing_details
 add column pricing_mode text not null default 'AUTOMATED' check(pricing_mode in ('AUTOMATED','MANUAL')),
 add column request_revision integer check(request_revision>=0),
 add column manual_subtotal_minor bigint,
 add column manual_input jsonb,
 alter column evaluation_id drop not null,
 alter column calculated_subtotal_minor drop not null;
alter table public.quote_pricing_details add constraint quote_pricing_provenance check (
 (pricing_mode='AUTOMATED' and evaluation_id is not null and calculated_subtotal_minor is not null and manual_subtotal_minor is null and manual_input is null)
 or (pricing_mode='MANUAL' and evaluation_id is null and calculated_subtotal_minor is null and request_revision is not null
 and manual_subtotal_minor is not null and manual_subtotal_minor between 0 and 900000000000 and manual_input is not null and manual_adjustment_minor=0 and adjustment_reason is null));
-- Durable idempotency survives draft replacement. No client access.
create table private.manual_quote_mutations (
 organization_id uuid not null references public.organizations(id), actor_id uuid not null,
 mutation_id uuid not null, request_id uuid not null, input jsonb not null, result jsonb not null,
 primary key(organization_id,actor_id,mutation_id)
);
revoke all on private.manual_quote_mutations from public,anon,authenticated;

create function public.create_manual_quote_draft(p_request_id uuid,p_expected_revision integer,p_subtotal_minor bigint,
 p_distance_km numeric,p_source_note text,p_validity_seconds integer,p_mutation_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); r public.requests; m public.markets; tax public.market_tax_versions;
 q public.quotes; v public.quote_versions; d public.distance_snapshots; previous private.manual_quote_mutations;
 facts jsonb; result jsonb; mode text; next_version integer; vat bigint;
begin
 select * into r from public.requests where id=p_request_id for update;
 if not found or uid is null or not private.has_permission(r.organization_id,'quotes.manage') then raise exception 'Request unavailable' using errcode='42501'; end if;
 if p_mutation_id is null or p_expected_revision is null or p_subtotal_minor is null or p_subtotal_minor not between 0 and 900000000000
 or p_validity_seconds is null or p_validity_seconds not between 1 and 2592000 or p_distance_km is null or p_distance_km<=0 or p_distance_km>5000 or scale(p_distance_km)>3
 or length(coalesce(p_source_note,''))>300 then raise exception 'Invalid manual quote input' using errcode='22023'; end if;
 facts=jsonb_build_object('request',r.id,'revision',p_expected_revision,'subtotal',p_subtotal_minor,'distance',p_distance_km,'note',coalesce(btrim(p_source_note),''),'validity',p_validity_seconds);
 perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text||uid::text||p_mutation_id::text,0));
 select * into previous from private.manual_quote_mutations where organization_id=r.organization_id and actor_id=uid and mutation_id=p_mutation_id;
 if found then
  if previous.input is distinct from facts then raise exception 'Conflicting retry' using errcode='22023'; end if;
  return previous.result;
 end if;
 if r.status<>'SUBMITTED' or r.revision<>p_expected_revision then raise exception 'Request revision changed' using errcode='40001'; end if;
 select pricing_mode into mode from public.pricing_settings where organization_id=r.organization_id and market_id=r.market_id for share;
 if mode is distinct from 'MANUAL' then raise exception 'Manual pricing unavailable' using errcode='55000'; end if;
 select * into m from public.markets where id=r.market_id and organization_id=r.organization_id and active for share;
 if not found then raise exception 'Market unavailable' using errcode='55000'; end if;
 select * into tax from public.market_tax_versions where organization_id=r.organization_id and market_id=r.market_id and active and effective_from<=now() and (effective_until is null or effective_until>now()) for share;
 if not found or (select count(*) from public.market_tax_versions where organization_id=r.organization_id and market_id=r.market_id and active and effective_from<=now() and (effective_until is null or effective_until>now()))<>1 then raise exception 'Exactly one applicable market tax configuration required' using errcode='55000'; end if;
 if exists(select 1 from public.orders where organization_id=r.organization_id and request_id=r.id) then raise exception 'Request already ordered' using errcode='55000'; end if;
 insert into public.distance_snapshots(organization_id,request_id,revision,distance_km,source_type,verified_by,source_note)
 select r.organization_id,r.id,coalesce(max(revision),0)+1,p_distance_km,'MANUAL_VERIFIED',uid,nullif(btrim(p_source_note),'') from public.distance_snapshots where organization_id=r.organization_id and request_id=r.id returning * into d;
 insert into public.quotes(organization_id,request_id,reference) values(r.organization_id,r.id,private.next_commercial_reference('quote','Q',m.timezone))
 on conflict(organization_id,request_id) do update set request_id=excluded.request_id returning * into q;
 perform pg_advisory_xact_lock(hashtextextended(q.organization_id::text||':'||q.id::text,0));
 select coalesce(max(version),0)+1 into next_version from public.quote_versions where organization_id=q.organization_id and quote_id=q.id;
 for v in select * from public.quote_versions where organization_id=q.organization_id and quote_id=q.id and status='DRAFT' for update loop
  delete from public.quote_items where quote_version_id=v.id and organization_id=q.organization_id;
  delete from public.quote_pricing_details where quote_version_id=v.id and organization_id=q.organization_id;
  delete from public.quote_versions where id=v.id;
 end loop;
 vat=(p_subtotal_minor*tax.rate_bps+5000)/10000;
 insert into public.quote_versions(id,organization_id,quote_id,version,distance_km,distance_source,distance_verified_at,final_subtotal_minor,vat_rate_bps,vat_amount_minor,total_minor,validity_seconds,currency,tax_version_id,tax_code,tax_label_ar,tax_label_en)
 values(p_mutation_id,r.organization_id,q.id,next_version,d.distance_km,d.source_type,d.verified_at,p_subtotal_minor,tax.rate_bps,vat,p_subtotal_minor+vat,p_validity_seconds,m.currency,tax.id,tax.code,tax.label_ar,tax.label_en) returning * into v;
 insert into public.quote_pricing_details(organization_id,quote_version_id,pricing_mode,request_revision,manual_subtotal_minor,manual_input,manual_adjustment_minor,created_by)
 values(r.organization_id,v.id,'MANUAL',r.revision,p_subtotal_minor,facts,0,uid);
 insert into public.quote_items(organization_id,quote_version_id,component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position)
 values(r.organization_id,v.id,'MANUAL_SERVICE','خدمة النقل','Transport service',1,p_subtotal_minor,p_subtotal_minor,0);
 perform private.commercial_event(r.organization_id,'quote.created','quote_versions',v.id,jsonb_build_object('pricing_mode','MANUAL','version',v.version));
 result=private.quote_result(v);
 insert into private.manual_quote_mutations values(r.organization_id,uid,p_mutation_id,r.id,facts,result);
 return result;
end $$;
revoke all on function public.create_manual_quote_draft(uuid,integer,bigint,numeric,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.create_manual_quote_draft(uuid,integer,bigint,numeric,text,integer,uuid) to authenticated;


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
 select * into setting from public.pricing_settings where organization_id=r.organization_id and market_id=r.market_id for share;
 if not found or setting.pricing_mode<>'AUTOMATED' then raise exception 'Automated pricing unavailable' using errcode='55000'; end if;
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
 if not exists(select 1 from public.pricing_settings where organization_id=e.organization_id and market_id=e.market_id and pricing_mode='AUTOMATED' for share) then raise exception 'Automated pricing unavailable' using errcode='55000'; end if;
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
declare uid uuid=auth.uid(); v public.quote_versions; active public.quote_versions; r public.requests; details public.quote_pricing_details; mode text;
begin
 select req.* into r from public.requests req join public.quotes q on q.request_id=req.id join public.quote_versions qv on qv.quote_id=q.id where qv.id=p_quote_version_id for update of req;
 select * into v from public.quote_versions where id=p_quote_version_id for update;
 if not found or not private.has_permission(v.organization_id,'quotes.manage') then raise exception 'Quote unavailable' using errcode='42501'; end if;
 if v.status='SENT' then return private.quote_result(v); end if;
 select * into details from public.quote_pricing_details where quote_version_id=v.id and organization_id=v.organization_id;
 select pricing_mode into mode from public.pricing_settings where organization_id=v.organization_id and market_id=v.market_id for share;
 if v.status<>'DRAFT' or details.pricing_mode is distinct from mode
 or (details.pricing_mode='MANUAL' and (r.status<>'SUBMITTED' or details.request_revision<>r.revision))
 or (details.pricing_mode='AUTOMATED' and not exists(select 1 from public.pricing_evaluations e where e.id=details.evaluation_id and e.organization_id=v.organization_id and e.status='QUOTED' and e.request_revision=r.revision)) then raise exception 'Quote cannot be sent' using errcode='55000'; end if;
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

create or replace function public.guest_preliminary_price() returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare guest private.guest_access_grants; evaluation public.pricing_evaluations;
begin
 guest=private.guest_context();
 if guest.id is null then raise exception 'Journey unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.pricing_settings s join public.requests r on r.organization_id=s.organization_id and r.market_id=s.market_id where r.id=guest.request_id and r.organization_id=guest.organization_id and s.pricing_mode='AUTOMATED') then return jsonb_build_object('state','WAITING_FOR_REVIEW'); end if;
 select * into evaluation from public.pricing_evaluations where request_id=guest.request_id
 and organization_id=guest.organization_id order by calculated_at desc,id desc limit 1;
 if not found or evaluation.status='STALE' then return jsonb_build_object('state','WAITING_FOR_REVIEW'); end if;
 return jsonb_build_object('state','PRELIMINARY','subtotalMinor',evaluation.calculated_subtotal_minor,
 'currency',evaluation.currency,'calculatedAt',evaluation.calculated_at);
end $$;

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
  if not private.request_coverage_valid(r) then raise exception 'Complete the request before submitting: route or add-on unavailable' using errcode='22023'; end if;
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

-- Public catalogue identifiers only; no customer addresses or financial configuration.
create or replace function public.public_market_catalogue() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'country',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,
 'currency',m.currency,'timezone',m.timezone,'services',(
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nameAr',s.name_ar,'nameEn',s.name_en) order by s.code),'[]')
 from public.market_services ms join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where ms.market_id=m.id and ms.organization_id=m.organization_id and ms.active and s.active
 and exists(select 1 from public.service_areas a where a.market_id=m.id and a.service_id=s.id and a.active)
 ),'cities',(
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nameAr',c.name_ar,'nameEn',c.name_en,
 'pickupEligible',exists(select 1 from public.service_areas a join public.market_services ms on ms.organization_id=a.organization_id and ms.market_id=a.market_id and ms.service_id=a.service_id join public.services s on s.organization_id=ms.organization_id and s.id=ms.service_id where a.organization_id=m.organization_id and a.market_id=m.id and a.city_id=c.id and a.active and a.pickup_eligible and ms.active and s.active),
 'deliveryEligible',exists(select 1 from public.service_areas a join public.market_services ms on ms.organization_id=a.organization_id and ms.market_id=a.market_id and ms.service_id=a.service_id join public.services s on s.organization_id=ms.organization_id and s.id=ms.service_id where a.organization_id=m.organization_id and a.market_id=m.id and a.city_id=c.id and a.active and a.delivery_eligible and ms.active and s.active)) order by c.code),'[]')
 from public.market_cities c where c.organization_id=m.organization_id and c.market_id=m.id
 and exists(select 1 from public.service_areas a join public.market_services ms on ms.market_id=a.market_id and ms.service_id=a.service_id and ms.organization_id=a.organization_id join public.services s on s.id=ms.service_id and s.organization_id=ms.organization_id
 where a.city_id=c.id and a.market_id=m.id and a.active and ms.active and s.active)
 )) order by m.country_code),'[]') from public.markets m
 join private.customer_enrollment e on e.organization_id=m.organization_id
 where m.active and m.country_code in ('SA','EG')
$$;
