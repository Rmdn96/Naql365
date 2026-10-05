-- Extend existing financial evidence policies to the exact guest journey only.
create or replace function private.transfer_file_access(p_file uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bank_transfer_attempts a join public.payments p on p.id=a.payment_id join public.file_objects f on f.id=a.file_id
 where f.id=p_file and f.purpose='TRANSFER_PROOF' and
 ((not p_write and f.upload_state='ready' and (private.payment_customer(p.id) or private.has_permission(p.organization_id,'finance.read')))
 or (p_write and (a.submitted_by=auth.uid() or (auth.uid() is null and a.guest_customer_id=(private.guest_context()).customer_id))
 and private.payment_customer(p.id) and a.state='RESERVED' and f.upload_state='pending' and f.created_at>now()-interval '20 minutes')))
$$;

create or replace function private.transfer_storage_access(p_bucket text,p_path text,p_metadata jsonb default null) returns boolean language plpgsql security definer set search_path='' as $$
declare f public.file_objects;
begin
 if p_bucket<>'documents' then return false; end if;
 select * into f from public.file_objects where bucket_id=p_bucket and object_name=p_path and purpose='TRANSFER_PROOF';
 if not found then return false; end if;
 if p_metadata is null then return private.transfer_file_access(f.id); end if;
 if auth.uid() is null then perform private.lock_guest_context(); end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 return storage.allow_only_operation('object.upload') and private.transfer_file_access(f.id,true)
 and p_metadata->>'mimetype'=f.mime_type and coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size_bytes;
end $$;

create or replace function private.transfer_storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.file_objects;
begin
 if new.bucket_id<>'documents' then return new; end if;
 -- Trusted maintenance is not a customer upload. Anonymous capability uploads are checked.
 if auth.uid() is null and coalesce(current_setting('role',true),'')<>'anon' then return new; end if;
 select * into f from public.file_objects where bucket_id=new.bucket_id and object_name=new.name and purpose='TRANSFER_PROOF';
 if not found then raise exception 'Financial upload reservation required' using errcode='42501'; end if;
 if auth.uid() is null then perform private.lock_guest_context(); end if;
 perform pg_advisory_xact_lock(hashtextextended(f.organization_id::text,34));
 if not private.transfer_file_access(f.id,true) or new.metadata->>'mimetype' is distinct from f.mime_type or coalesce(new.metadata->>'size',new.metadata->>'contentLength')::bigint is distinct from f.size_bytes then raise exception 'Financial upload denied' using errcode='42501'; end if;
 return new;
end $$;

create or replace function private.transfer_storage_removal(p_bucket text,p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select p_bucket='documents' and storage.allow_only_operation('object.delete') and exists(select 1 from public.file_objects f join public.bank_transfer_attempts a on a.file_id=f.id where f.bucket_id=p_bucket and f.object_name=p_path and f.purpose='TRANSFER_PROOF' and f.upload_state='removing' and a.state='REMOVING'
 and (a.submitted_by=auth.uid() or (auth.uid() is null and a.guest_customer_id=(private.guest_context()).customer_id)) and private.payment_customer(a.payment_id))
$$;

-- Expose only bounded predicates to anonymous Storage RLS, never private tables.
create function public.guest_transfer_storage(p_bucket text,p_path text,p_action text,p_metadata jsonb default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null or (private.guest_context()).id is null then return false; end if;
 if p_action='read' then return private.transfer_storage_access(p_bucket,p_path);
 elsif p_action='upload' then return p_metadata is not null and private.transfer_storage_access(p_bucket,p_path,p_metadata);
 elsif p_action='remove' then return private.transfer_storage_removal(p_bucket,p_path);
 end if;
 return false;
end $$;
revoke all on function public.guest_transfer_storage(text,text,text,jsonb) from public,authenticated;
grant execute on function public.guest_transfer_storage(text,text,text,jsonb),public.transfer_proof_path(uuid) to anon;
create policy guest_transfer_read on storage.objects for select to anon using(public.guest_transfer_storage(bucket_id,name,'read') or public.guest_transfer_storage(bucket_id,name,'remove'));
create policy guest_transfer_upload on storage.objects for insert to anon with check(public.guest_transfer_storage(bucket_id,name,'upload',metadata));
create policy guest_transfer_remove on storage.objects for delete to anon using(public.guest_transfer_storage(bucket_id,name,'remove'));
