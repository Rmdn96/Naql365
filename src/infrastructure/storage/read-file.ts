import 'server-only';
import { fileAccessInput } from '@/domain/shared/validation';
import { AppError } from '@/domain/shared/errors';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

export async function signedFileUrl(input: unknown): Promise<string> {
  const parsed = fileAccessInput.safeParse(input);
  if (!parsed.success) throw new AppError('validation', 'Invalid file identifier');
  const client = await createSupabaseServerClient();
  const { data: user, error: authError } = await client.auth.getUser();
  if (authError || !user.user) throw new AppError('unauthenticated', 'Authentication required');
  // Caller supplies an identifier, never an arbitrary bucket or path. Both lookups are RLS-scoped.
  const { data: file, error } = await client
    .from('file_objects')
    .select('bucket_id,object_name,upload_state')
    .eq('id', parsed.data.fileId)
    .maybeSingle();
  if (error) throw new AppError('internal', 'File lookup failed');
  if (!file) throw new AppError('not_found', 'File unavailable');
  if (file.upload_state && file.upload_state !== 'ready')
    throw new AppError('not_found', 'File unavailable');
  const { data, error: signingError } = await client.storage
    .from(file.bucket_id)
    .createSignedUrl(file.object_name, 60, { download: true });
  if (signingError) throw new AppError('internal', 'Unable to sign file');
  return data.signedUrl;
}
