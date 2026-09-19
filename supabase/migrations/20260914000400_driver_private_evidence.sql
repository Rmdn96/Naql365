insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('issue-files','issue-files',false,2097152,array['image/png','image/jpeg']);
create table public.issue_photos(
 id uuid primary key, organization_id uuid not null, issue_id uuid not null,
 actor_id uuid not null references public.profiles(id), object_name text not null unique,
 mime_type text not null check(mime_type in ('image/png','image/jpeg')),
 size_bytes integer not null check(size_bytes between 1 and 2097152),
 state text not null default 'PENDING' check(state in ('PENDING','FINAL','REMOVING')),
 created_at timestamptz not null default now(), finalized_at timestamptz,
 unique(issue_id), foreign key(organization_id,issue_id) references public.issues(organization_id,id),
 check((state='FINAL')=(finalized_at is not null))
);
alter table public.issue_photos enable row level security;
revoke all on public.issue_photos from public,anon,authenticated;
grant select on public.issue_photos to authenticated;
create policy issue_photos_operations_read on public.issue_photos for select to authenticated using(private.has_permission(organization_id,'dispatch.manage'));
create function private.can_access_issue(p_issue uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.issues i where i.id=p_issue and i.trip_id is not null and (private.has_permission(i.organization_id,'dispatch.manage') or private.driver_trip_access(i.trip_id,false)))
$$;
create function public.issue_photo_command(p_issue uuid,p_file uuid,p_action text,p_mime text default null,p_size integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.issues; f public.issue_photos; meta jsonb;
begin
 select * into i from public.issues where id=p_issue and trip_id is not null;
 if not found or auth.uid() is null then raise exception 'Issue unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(i.organization_id::text,34));
 if not private.can_access_issue(i.id) then raise exception 'Issue unavailable' using errcode='42501'; end if;
 select * into f from public.issue_photos where issue_id=i.id for update;
 if p_action is null or p_action not in ('reserve','finalize','abort','finish_abort') or p_file is null then raise exception 'Invalid photo command' using errcode='22023'; end if;
 if f.id is not null and (f.id<>p_file or (f.actor_id<>auth.uid() and not (p_action in ('abort','finish_abort') and private.has_permission(i.organization_id,'dispatch.manage')))) then raise exception 'Photo reservation conflict' using errcode='40001'; end if;
 if p_action in ('abort','finish_abort') then
  if f.id is null or f.state='FINAL' then raise exception 'Pending photo required' using errcode='55000'; end if;
  if p_action='abort' then update public.issue_photos set state='REMOVING' where id=f.id;
  else
   if f.state<>'REMOVING' or exists(select 1 from storage.objects where bucket_id='issue-files' and name=f.object_name) then raise exception 'Remove photo first' using errcode='55000'; end if;
   delete from public.issue_photos where id=f.id;
  end if;
  return jsonb_build_object('id',f.id,'path',f.object_name,'state','REMOVING');
 end if;
 if f.state='FINAL' then
  if p_action='reserve' and (f.mime_type is distinct from p_mime or f.size_bytes is distinct from p_size) then raise exception 'Photo immutable' using errcode='55000'; end if;
  return jsonb_build_object('id',f.id,'path',f.object_name,'state','FINAL');
 end if;
 if i.actor_id<>auth.uid() or not private.driver_trip_access(i.trip_id,false) or i.status<>'OPEN' then raise exception 'Issue reporter required' using errcode='42501'; end if;
 if f.state='REMOVING' then raise exception 'Finish removal first' using errcode='55000'; end if;
 if p_action='reserve' then
  if f.id is not null then
   if f.mime_type is distinct from p_mime or f.size_bytes is distinct from p_size or f.created_at<now()-interval '20 minutes' then raise exception 'Photo reservation differs or expired' using errcode='40001'; end if;
  else
   insert into public.issue_photos(id,organization_id,issue_id,actor_id,object_name,mime_type,size_bytes)
   values(p_file,i.organization_id,i.id,auth.uid(),i.organization_id::text||'/'||i.id::text||'/'||p_file::text,p_mime,p_size) returning * into f;
  end if;
 else
  if f.id is null or f.created_at<now()-interval '20 minutes' then raise exception 'Photo reservation expired' using errcode='55000'; end if;
  select metadata into meta from storage.objects where bucket_id='issue-files' and name=f.object_name;
  if meta is null or meta->>'mimetype' is distinct from f.mime_type or (meta->>'size')::bigint is distinct from f.size_bytes then raise exception 'Photo upload incomplete' using errcode='22023'; end if;
  update public.issue_photos set state='FINAL',finalized_at=now() where id=f.id returning * into f;
  perform private.operational_event(i.organization_id,i.trip_id,'ISSUE_PHOTO_CAPTURED',i.stop_id,jsonb_build_object('issue_id',i.id));
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.state);
end $$;
create function private.can_upload_issue_photo(p_bucket text,p_path text,p_metadata jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare f public.issue_photos; i public.issues;
begin
 if p_bucket<>'issue-files' or not storage.allow_only_operation('object.upload') then return false; end if;
 select * into f from public.issue_photos where object_name=p_path;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 select * into f from public.issue_photos where object_name=p_path for update;
 select * into i from public.issues where id=f.issue_id;
 return f.actor_id=auth.uid() and f.state='PENDING' and f.created_at>now()-interval '20 minutes' and i.status='OPEN'
 and private.driver_trip_access(i.trip_id,false) and p_metadata->>'mimetype'=f.mime_type and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size_bytes;
end $$;
create function private.issue_photo_object_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id='issue-files' and auth.uid() is not null and not coalesce(private.can_upload_issue_photo(new.bucket_id,new.name,new.metadata),false) then raise exception 'Issue photo denied' using errcode='42501'; end if;
 return new;
end $$;
create trigger issue_photo_upload_guard before insert or update on storage.objects for each row execute function private.issue_photo_object_guard();
create function private.can_read_issue_photo(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_bucket='issue-files' and exists(select 1 from public.issue_photos f where f.object_name=p_path and f.state='FINAL' and private.can_access_issue(f.issue_id))
$$;
create function private.can_remove_issue_photo(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_bucket='issue-files' and storage.allow_only_operation('object.delete') and exists(select 1 from public.issue_photos f where f.object_name=p_path and f.state='REMOVING' and private.can_access_issue(f.issue_id) and (f.actor_id=auth.uid() or private.has_permission(f.organization_id,'dispatch.manage')))
$$;
create policy issue_photo_upload on storage.objects for insert to authenticated with check(private.can_upload_issue_photo(bucket_id,name,metadata));
create policy issue_photo_read on storage.objects for select to authenticated using(private.can_read_issue_photo(bucket_id,name));
create policy issue_photo_removing_read on storage.objects for select to authenticated using(private.can_remove_issue_photo(bucket_id,name));
create policy issue_photo_remove on storage.objects for delete to authenticated using(private.can_remove_issue_photo(bucket_id,name));
create function private.protect_issue_photo() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.state='REMOVING' or (auth.uid() is null and current_setting('app.fixture_cleanup',true)='on') then return old; end if;
 elsif old.state='PENDING' and (to_jsonb(new)-array['state','finalized_at'])=(to_jsonb(old)-array['state','finalized_at']) then return new;
 end if;
 raise exception 'Issue photo immutable' using errcode='55000';
end $$;
create trigger issue_photo_immutable before update or delete on public.issue_photos for each row execute function private.protect_issue_photo();
revoke all on function private.can_access_issue(uuid),private.can_upload_issue_photo(text,text,jsonb),private.issue_photo_object_guard(),private.can_read_issue_photo(text,text),private.can_remove_issue_photo(text,text),private.protect_issue_photo(),public.issue_photo_command(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.can_upload_issue_photo(text,text,jsonb),private.can_read_issue_photo(text,text),private.can_remove_issue_photo(text,text),public.issue_photo_command(uuid,uuid,text,text,integer) to authenticated;

create function public.driver_evidence_path(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_kind='issue' then
  select jsonb_build_object('path',f.object_name,'bucket','issue-files') into result from public.issue_photos f where f.issue_id=p_id and f.state='FINAL' and private.can_access_issue(f.issue_id);
 elsif p_kind='pod' then
  select jsonb_build_object('path',f.object_name,'bucket','pod-files') into result from public.trip_pods f where f.trip_id=p_id and f.state='FINAL' and (private.has_permission(f.organization_id,'pod.read') or (f.actor_id=auth.uid() and private.driver_trip_access(f.trip_id,false)));
 end if;
 if result is null then raise exception 'Evidence unavailable' using errcode='42501'; end if;
 return result;
end $$;
create function public.driver_finalize_pod(p_trip uuid,p_file uuid,p_location jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.trips; prior private.driver_mutations; intent jsonb; result jsonb; old_events uuid[]; e uuid;
begin
 select * into t from public.trips where id=p_trip;
 if not found or auth.uid() is null or p_file is null then raise exception 'Driver POD unavailable' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_file::text,33));
 perform pg_advisory_xact_lock(hashtextextended(t.organization_id::text,34));
 if not private.driver_trip_access(t.id,true) then raise exception 'Driver POD unavailable' using errcode='42501'; end if;
 intent=jsonb_build_object('action','finalize_pod','trip',p_trip,'file',p_file,'location',p_location);
 select * into prior from private.driver_mutations where actor_id=auth.uid() and mutation_id=p_file;
 if found then
  if prior.intent<>intent then raise exception 'POD retry differs' using errcode='22023'; end if;
  return prior.result;
 end if;
 select coalesce(array_agg(id),'{}') into old_events from public.trip_events where trip_id=t.id;
 result=public.trip_pod_command(t.id,p_file,'finalize');
 if p_location is not null and p_location<>'null'::jsonb then
  select id into e from public.trip_events where trip_id=t.id and actor_id=auth.uid() and event_type='POD_CAPTURED' and not(id=any(old_events));
  if e is null then raise exception 'POD evidence already immutable' using errcode='55000'; end if;
  perform private.record_event_location(e,p_location);
 end if;
 insert into private.driver_mutations values(auth.uid(),p_file,intent,result);
 return result;
end $$;
revoke all on function public.driver_evidence_path(text,uuid),public.driver_finalize_pod(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.driver_evidence_path(text,uuid),public.driver_finalize_pod(uuid,uuid,jsonb) to authenticated;
