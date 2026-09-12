create function public.trip_pod_command(p_trip_id uuid,p_file_id uuid,p_action text,p_recipient text default null,p_mime text default null,p_size integer default null,p_notes text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.trips; f public.trip_pods; object_metadata jsonb;
begin
 select * into t from public.trips where id=p_trip_id;
 if not found or not private.has_permission(t.organization_id,'dispatch.manage') then raise exception 'POD access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(t.organization_id::text,34));
 select * into t from public.trips where id=p_trip_id for update;
 select * into f from public.trip_pods where trip_id=t.id for update;
 if f.id is not null and (f.id<>p_file_id or f.actor_id<>auth.uid()) then raise exception 'POD already reserved' using errcode='40001'; end if;
 if p_action not in ('reserve','finalize','abort','finish_abort') or p_action is null or p_file_id is null then raise exception 'Invalid POD action' using errcode='22023'; end if;
 if p_action in ('abort','finish_abort') then
  if f.id is null or f.state='FINAL' then raise exception 'Pending POD required' using errcode='55000'; end if;
  if p_action='abort' then
   if f.state='PENDING' then update public.trip_pods set state='REMOVING' where id=f.id; end if;
  else
   if f.state<>'REMOVING' or exists(select 1 from storage.objects where bucket_id='pod-files' and name=f.object_name)
   then raise exception 'Remove uploaded object first' using errcode='55000'; end if;
   delete from public.trip_pods where id=f.id;
  end if;
  return jsonb_build_object('id',f.id,'path',f.object_name,'state','REMOVING');
 end if;
 if f.state='REMOVING' then raise exception 'Finish removal first' using errcode='55000'; end if;
 if f.state='FINAL' then
  if p_action='reserve' and (f.recipient_name is distinct from btrim(p_recipient) or f.mime_type is distinct from p_mime or f.size_bytes is distinct from p_size or f.notes is distinct from p_notes)
  then raise exception 'POD immutable' using errcode='55000'; end if;
  return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.state);
 end if;
 if t.status<>'DELIVERED' or not exists(select 1 from public.trip_stops where trip_id=t.id)
  or exists(select 1 from public.trip_stops where trip_id=t.id and status<>'COMPLETED')
 then raise exception 'All Stops must complete before POD' using errcode='55000'; end if;
 if p_action='reserve' then
  if f.id is not null then
   if f.recipient_name is distinct from btrim(p_recipient) or f.mime_type is distinct from p_mime or f.size_bytes is distinct from p_size or f.notes is distinct from p_notes
   then raise exception 'Reservation differs' using errcode='40001'; end if;
   if f.created_at<now()-interval '20 minutes' then raise exception 'Reservation expired; authorized cleanup required' using errcode='55000'; end if;
  else
   insert into public.trip_pods(id,organization_id,trip_id,object_name,mime_type,size_bytes,recipient_name,notes,actor_id)
   values(p_file_id,t.organization_id,t.id,t.organization_id::text||'/'||t.id::text||'/'||p_file_id::text,p_mime,p_size,btrim(p_recipient),p_notes,auth.uid()) returning * into f;
  end if;
 else
  if f.id is null or f.created_at<now()-interval '20 minutes' then raise exception 'Valid reservation required' using errcode='55000'; end if;
  select metadata into object_metadata from storage.objects where bucket_id='pod-files' and name=f.object_name;
  if object_metadata is null or object_metadata->>'mimetype' is distinct from f.mime_type
   or (object_metadata->>'size')::bigint is distinct from f.size_bytes
  then raise exception 'Signature upload incomplete' using errcode='22023'; end if;
  update public.trip_pods set state='FINAL',captured_at=now() where id=f.id returning * into f;
  update public.trips set revision=revision+1 where id=t.id;
  perform private.operational_event(t.organization_id,t.id,'POD_CAPTURED',null,jsonb_build_object('pod_id',f.id));
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.state);
end $$;

create function private.can_upload_pod(p_bucket text,p_path text,p_metadata jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare f public.trip_pods; t public.trips;
begin
 if p_bucket<>'pod-files' or not storage.allow_only_operation('object.upload') then return false; end if;
 select * into f from public.trip_pods where object_name=p_path;
 if not found or f.actor_id is distinct from auth.uid() or not private.has_permission(f.organization_id,'dispatch.manage') then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 select * into t from public.trips where id=f.trip_id for update;
 select * into f from public.trip_pods where object_name=p_path for update;
 return f.state='PENDING' and f.created_at>now()-interval '20 minutes' and t.status='DELIVERED'
 and p_metadata->>'mimetype'=f.mime_type and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size_bytes;
end $$;
create function private.pod_object_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id='pod-files' and auth.uid() is not null and not coalesce(private.can_upload_pod(new.bucket_id,new.name,new.metadata),false)
 then raise exception 'POD upload denied' using errcode='42501'; end if;
 return new;
end $$;
create function private.can_read_pod(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_bucket='pod-files' and exists(select 1 from public.trip_pods f where f.object_name=p_path and f.state='FINAL' and private.has_permission(f.organization_id,'pod.read'))
$$;
create trigger naql365_pod_object_completion before insert or update on storage.objects for each row execute function private.pod_object_guard();
create policy pod_signature_upload on storage.objects for insert to authenticated with check(private.can_upload_pod(bucket_id,name,metadata));
create policy pod_signature_read on storage.objects for select to authenticated using(private.can_read_pod(bucket_id,name));
create function private.can_remove_pending_pod(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_bucket='pod-files' and storage.allow_only_operation('object.delete') and exists(select 1 from public.trip_pods f where f.object_name=p_path and f.state='REMOVING' and f.actor_id=auth.uid() and private.has_permission(f.organization_id,'dispatch.manage'))
$$;
revoke all on function private.can_remove_pending_pod(text,text) from public,anon,authenticated;
grant execute on function private.can_remove_pending_pod(text,text) to authenticated;
create policy pending_pod_removal_select on storage.objects for select to authenticated using(private.can_remove_pending_pod(bucket_id,name));
create policy pending_pod_removal on storage.objects for delete to authenticated using(private.can_remove_pending_pod(bucket_id,name));
revoke all on function public.trip_pod_command(uuid,uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.trip_pod_command(uuid,uuid,text,text,text,integer,text) to authenticated;
revoke all on function private.can_upload_pod(text,text,jsonb),private.can_read_pod(text,text),private.pod_object_guard() from public,anon,authenticated;
grant execute on function private.can_upload_pod(text,text,jsonb),private.can_read_pod(text,text) to authenticated;

-- Fixed customer-safe projection; raw Stops, POD and assignment history remain staff-only.
create function public.customer_order_progress(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.orders; result jsonb;
begin
 select * into o from public.orders where id=p_order_id;
 if not found or not private.owns_customer(o.organization_id,o.customer_id) or not private.has_permission(o.organization_id,'account.access')
 then raise exception 'Order unavailable' using errcode='42501'; end if;
 select jsonb_build_object('id',o.id,'reference',o.reference,'status',o.operational_status,'completedAt',o.operational_completed_at,
 'trips',coalesce((select jsonb_agg(jsonb_build_object('reference',t.reference,'status',t.status,
 'totalStops',(select count(*) from public.trip_stops s where s.trip_id=t.id),
 'completedStops',(select count(*) from public.trip_stops s where s.trip_id=t.id and s.status='COMPLETED'),
 'podCaptured',exists(select 1 from public.trip_pods p where p.trip_id=t.id and p.state='FINAL')) order by t.created_at,t.id)
 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.customer_order_progress(uuid) from public,anon,authenticated;
grant execute on function public.customer_order_progress(uuid) to authenticated;

-- Dispatchers need a bounded operational route summary, not broad Request access.
create function public.operational_job_summary(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare j public.jobs; result jsonb;
begin
 select * into j from public.jobs where id=p_job_id;
 if not found or not private.has_permission(j.organization_id,'operations.manage') then raise exception 'Job unavailable' using errcode='42501'; end if;
 select jsonb_build_object('orderReference',o.reference,'requestReference',r.reference,
 'serviceAr',s.name_ar,'serviceEn',s.name_en,
 'locations',coalesce((select jsonb_agg(jsonb_build_object('kind',l.kind,'city',l.city,'district',l.district,'address',l.address) order by l.kind) from public.request_locations l where l.request_id=r.id),'[]'::jsonb)) into result
 from public.orders o join public.requests r on r.id=o.request_id left join public.services s on s.id=r.service_id where o.id=j.order_id;
 return result;
end $$;
revoke all on function public.operational_job_summary(uuid) from public,anon,authenticated;
grant execute on function public.operational_job_summary(uuid) to authenticated;
