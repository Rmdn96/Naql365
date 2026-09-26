-- Preserve existing authenticated object paths; guest evidence has an explicit customer owner.
alter table public.file_objects alter column owner_profile_id drop not null;
alter table public.file_objects add column guest_customer_id uuid;
alter table public.file_objects add constraint file_guest_customer_fk
 foreign key(organization_id,guest_customer_id) references public.customers(organization_id,id);
alter table public.file_objects add constraint file_single_owner
 check((owner_profile_id is not null)<>(guest_customer_id is not null));
alter table public.file_objects alter column object_name set expression as
 (organization_id::text||'/'||coalesce(owner_profile_id::text,'guest-'||guest_customer_id::text)||'/'||id::text);
create function private.validate_guest_file_owner() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.guest_customer_id is not null and not exists(select 1 from public.customers c
  where c.organization_id=new.organization_id and c.id=new.guest_customer_id and c.identity_kind='GUEST')
 then raise exception 'Guest file owner required' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.organization_id,new.owner_profile_id,new.guest_customer_id,new.bucket_id,new.id)
  is distinct from (old.organization_id,old.owner_profile_id,old.guest_customer_id,old.bucket_id,old.id)
 then raise exception 'File ownership is immutable' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.validate_guest_file_owner() from public,anon,authenticated;
create trigger file_guest_owner before insert or update on public.file_objects
 for each row execute function private.validate_guest_file_owner();
grant select(organization_id,bucket_id,object_name) on public.file_objects to anon;

create function public.guest_request_storage(p_bucket text,p_path text,p_operation text,p_metadata jsonb default null)
 returns boolean language plpgsql security definer set search_path='' as $$
declare guest private.guest_access_grants; r public.requests; f public.file_objects;
begin
 if p_bucket<>'attachments' or auth.uid() is not null or p_operation not in ('read','upload','remove') then return false; end if;
 guest=private.guest_context();
 if guest.id is null then return false; end if;
 if p_operation<>'read' then guest=private.lock_guest_context(); end if;
 select * into r from public.requests where id=guest.request_id and organization_id=guest.organization_id;
 if p_operation<>'read' then perform 1 from public.requests where id=r.id for update; end if;
 select f0.* into f from public.file_objects f0 join public.request_attachments a on a.file_id=f0.id
 where a.request_id=r.id and f0.organization_id=guest.organization_id and f0.guest_customer_id=guest.customer_id
 and f0.owner_profile_id is null and f0.bucket_id=p_bucket and f0.object_name=p_path and f0.purpose='GENERAL';
 if not found then return false; end if;
 if p_operation='read' then return f.upload_state='ready'; end if;
 if p_operation='remove' then return storage.allow_only_operation('object.delete') and r.status in ('DRAFT','CANCELLED') and f.upload_state='removing'; end if;
 return storage.allow_only_operation('object.upload') and r.status='DRAFT' and f.upload_state='pending'
 and f.created_at>clock_timestamp()-interval '20 minutes'
 and f.mime_type in ('image/jpeg','image/png','image/webp') and f.size_bytes between 1 and 3145728
 and p_metadata->>'mimetype'=f.mime_type
 and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size_bytes;
 exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
revoke all on function public.guest_request_storage(text,text,text,jsonb) from public;
grant execute on function public.guest_request_storage(text,text,text,jsonb) to anon;
grant usage on schema storage to anon;
grant select,insert,delete on storage.objects to anon;
create policy guest_request_object_read on storage.objects for select to anon
 using(public.guest_request_storage(bucket_id,name,'read') or public.guest_request_storage(bucket_id,name,'remove'));
create policy guest_request_object_upload on storage.objects for insert to anon
 with check(public.guest_request_storage(bucket_id,name,'upload',metadata));
create policy guest_request_object_remove on storage.objects for delete to anon
 using(public.guest_request_storage(bucket_id,name,'remove'));

create function private.guest_request_upload_guard() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id='attachments' and current_setting('role',true)='anon'
 and not public.guest_request_storage(new.bucket_id,new.name,'upload',new.metadata)
 then raise exception 'Attachment upload denied' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.guest_request_upload_guard() from public,anon,authenticated;
create trigger guest_request_upload_guard before insert or update on storage.objects
 for each row execute function private.guest_request_upload_guard();

create or replace function public.request_file_command(p_operation text,p_request_id uuid,p_file_id uuid,p_mime text default null,p_size integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare guest private.guest_access_grants; r public.requests; f public.file_objects;
begin
 if auth.uid() is null then
  guest=private.lock_guest_context();
  perform private.consume_guest_budget(guest.organization_id,'upload',guest.id,60,true);
 end if;
 select * into r from public.requests where id=p_request_id for update;
 if not found or not private.customer_request_access(r.organization_id,r.customer_id,r.id)
 then raise exception 'Request unavailable' using errcode='42501'; end if;
 if p_operation is null or p_operation not in ('reserve','finalize','remove','finish_remove') or p_file_id is null then raise exception 'Invalid file command' using errcode='22023'; end if;
 if r.status<>'DRAFT' and not (r.status='CANCELLED' and p_operation in ('remove','finish_remove')) then raise exception 'Request immutable' using errcode='55000'; end if;
 if p_operation='reserve' then
  select f0.* into f from public.file_objects f0 join public.request_attachments a on a.file_id=f0.id where a.request_id=r.id and f0.id=p_file_id;
  if found then
   if f.owner_profile_id is distinct from auth.uid() or (auth.uid() is null and f.guest_customer_id is distinct from r.customer_id) or f.mime_type is distinct from p_mime or f.size_bytes is distinct from p_size or f.upload_state not in ('pending','ready') then raise exception 'File retry mismatch' using errcode='22023'; end if;
   return jsonb_build_object('id',f.id,'path',f.object_name,'state',f.upload_state);
  end if;
  if p_mime is null or p_mime not in ('image/jpeg','image/png','image/webp') or p_size is null or p_size not between 1 and 3145728 then raise exception 'Invalid image' using errcode='22023'; end if;
  if (select count(*) from public.request_attachments where request_id=r.id)>=8 then raise exception 'Attachment limit' using errcode='54000'; end if;
  insert into public.file_objects(id,organization_id,owner_profile_id,guest_customer_id,bucket_id,upload_state,mime_type,size_bytes)
   values(p_file_id,r.organization_id,auth.uid(),case when auth.uid() is null then r.customer_id end,'attachments','pending',p_mime,p_size) returning * into f;
  insert into public.request_attachments(organization_id,request_id,file_id) values(r.organization_id,r.id,f.id);
 else
  select f0.* into f from public.file_objects f0 join public.request_attachments a on a.file_id=f0.id where a.request_id=r.id and f0.id=p_file_id for update of f0;
  if not found then
   if p_operation='finish_remove' then return jsonb_build_object('removed',true); end if;
   raise exception 'File unavailable' using errcode='42501';
  end if;
  if f.owner_profile_id is distinct from auth.uid() or (auth.uid() is null and f.guest_customer_id is distinct from r.customer_id) then raise exception 'File unavailable' using errcode='42501'; end if;
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

revoke all on function public.request_file_command(text,uuid,uuid,text,integer) from public;
grant execute on function public.request_file_command(text,uuid,uuid,text,integer) to anon,authenticated;
