-- Storage preflight uses contentLength; completed object metadata uses size.
-- Keep both stages bounded and prevent a concurrent upload completion from replacing
-- an already finalized/submitted attachment. No provider rows are manually inserted/deleted.
create or replace function private.can_upload_request_image(bucket text,path text,object_metadata jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.requests; f public.file_objects;
begin
 if bucket<>'attachments' or not storage.allow_only_operation('object.upload') then return false; end if;
 select request.* into r from public.requests request join public.request_attachments a on a.request_id=request.id
 join public.file_objects file on file.id=a.file_id where file.bucket_id=bucket and file.object_name=path for update of request;
 if not found or r.status<>'DRAFT' or not private.owns_customer(r.organization_id,r.customer_id) or not private.has_permission(r.organization_id,'account.access') then return false; end if;
 select * into f from public.file_objects where bucket_id=bucket and object_name=path for update;
 return f.owner_profile_id=auth.uid() and f.upload_state='pending' and f.created_at>now()-interval '20 minutes'
 and f.mime_type in ('image/jpeg','image/png','image/webp') and f.size_bytes between 1 and 3145728
 and object_metadata->>'mimetype'=f.mime_type and coalesce(object_metadata->>'size',object_metadata->>'contentLength')::bigint=f.size_bytes;
end $$;

create function private.guard_request_object_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare r public.requests; f public.file_objects;
begin
 -- Trusted maintenance with no end-user identity remains available for fixture cleanup.
 if auth.uid() is null or new.bucket_id<>'attachments' then return new; end if;
 select request.* into r from public.requests request join public.request_attachments a on a.request_id=request.id
 join public.file_objects file on file.id=a.file_id where file.bucket_id=new.bucket_id and file.object_name=new.name for update of request;
 if not found then raise exception 'Upload reservation unavailable' using errcode='42501'; end if;
 select * into f from public.file_objects where bucket_id=new.bucket_id and object_name=new.name for update;
 if r.status<>'DRAFT' or f.upload_state<>'pending' or f.owner_profile_id<>auth.uid()
 or not private.owns_customer(r.organization_id,r.customer_id) or not private.has_permission(r.organization_id,'account.access')
 or new.metadata->>'mimetype' is distinct from f.mime_type
 or coalesce(new.metadata->>'size',new.metadata->>'contentLength')::bigint is distinct from f.size_bytes
 then raise exception 'Attachment immutable or invalid' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function private.guard_request_object_completion() from public,anon,authenticated;
create trigger naql365_request_object_completion before insert or update on storage.objects
 for each row execute function private.guard_request_object_completion();
