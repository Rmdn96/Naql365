-- Private buckets. Only registered objects are readable; writes are denied in Phase 0.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('attachments','attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('pod-files','pod-files',false,10485760,array['image/jpeg','image/png','application/pdf']),
 ('documents','documents',false,10485760,array['application/pdf']);
create policy registered_private_files_read on storage.objects for select to authenticated using (
 bucket_id in ('attachments','pod-files','documents') and exists(
 select 1 from public.file_objects f where f.bucket_id=storage.objects.bucket_id and f.object_name=storage.objects.name
  and ((f.owner_profile_id=(select auth.uid()) and private.is_member(f.organization_id)) or private.has_permission(f.organization_id,'files.read'))
 )
);
