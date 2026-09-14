import 'server-only';
import { z } from 'zod';
import {
  driverCommand,
  driverIssue,
  driverTrip,
  driverViews,
  eventLocation,
} from '@/domain/driver/model';
import { podInput } from '@/domain/operations/model';
import { AppError } from '@/domain/shared/errors';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { normalizeSignature } from '@/infrastructure/operations/signature';

function failure(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Driver access denied');
  if (['40001', '23505'].includes(code)) throw new AppError('conflict', 'Execution changed');
  if (['22023', '22P02', '23514', '23503', '23502', '55000', '22007', '22008'].includes(code))
    throw new AppError('validation', 'Invalid execution');
  throw new AppError('internal', 'Execution unavailable');
}
export async function driverClient(writable = false) {
  if (!getPublicEnv()) throw new AppError('network', 'Driver service unavailable');
  const client = await createSupabaseServerClient(writable);
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new AppError('unauthenticated', 'Sign in required');
  const identity = await client.rpc('driver_identity');
  if (identity.error) failure(identity.error.code);
  if (!Array.isArray(identity.data) || identity.data.length === 0)
    throw new AppError('forbidden', 'Internal Driver required');
  return client;
}
export async function getDriverTrips(view: unknown, offset: unknown = 0) {
  const client = await driverClient();
  const { data, error } = await client.rpc('driver_trips', {
    p_view: z.enum(driverViews).parse(view),
    p_offset: z.number().int().min(0).max(10000).parse(offset),
  });
  if (error) failure(error.code);
  return driverTrip.array().max(20).parse(data);
}
export async function getDriverTrip(id: string) {
  const client = await driverClient();
  const { data, error } = await client.rpc('driver_trip', { p_trip: z.uuid().parse(id) });
  if (error) failure(error.code);
  return driverTrip.parse(data);
}
export async function executeDriver(input: unknown) {
  const c = driverCommand.parse(input),
    client = await driverClient(true);
  const { data, error } = await client.rpc('driver_execute', {
    p_trip: c.tripId,
    p_action: c.action,
    p_revision: c.revision,
    p_mutation: c.mutationId,
    p_payload: c.payload,
    p_location: c.location,
  });
  if (error) failure(error.code);
  return data;
}
export async function reportDriverIssue(input: unknown) {
  const c = driverIssue.parse(input),
    client = await driverClient(true);
  const { data, error } = await client.rpc('report_driver_issue', {
    p_trip: c.tripId,
    p_stop: c.stopId,
    p_category: c.category,
    p_reason: c.reason,
    p_mutation: c.mutationId,
  });
  if (error) failure(error.code);
  return z.object({ id: z.uuid() }).parse(data);
}
const fileResult = z.object({
  id: z.uuid(),
  path: z.string(),
  state: z.enum(['PENDING', 'FINAL', 'REMOVING']),
});
export async function uploadDriverEvidence(kind: 'pod' | 'issue', form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > 2097152)
    throw new AppError('validation', 'Image size invalid');
  const client = await driverClient(true);
  const bytes = await normalizeSignature(new Uint8Array(await file.arrayBuffer()), file.type);
  const fileId = z.uuid().parse(form.get('fileId'));
  if (kind === 'pod') {
    const c = podInput.parse({
      tripId: form.get('tripId'),
      fileId,
      recipient: form.get('recipient'),
      notes: form.get('notes') ?? '',
    });
    let rawLocation: unknown;
    try {
      rawLocation = JSON.parse(String(form.get('location') ?? 'null')) as unknown;
    } catch {
      throw new AppError('validation', 'Invalid location');
    }
    const location = eventLocation.nullable().parse(rawLocation);
    const reserve = await client.rpc('trip_pod_command', {
      p_trip_id: c.tripId,
      p_file_id: fileId,
      p_action: 'reserve',
      p_recipient: c.recipient,
      p_notes: c.notes,
      p_mime: 'image/png',
      p_size: bytes.length,
    });
    if (reserve.error) failure(reserve.error.code);
    const f = fileResult.parse(reserve.data);
    if (f.state !== 'FINAL')
      await client.storage
        .from('pod-files')
        .upload(f.path, bytes, { contentType: 'image/png', upsert: false });
    const final = await client.rpc('driver_finalize_pod', {
      p_trip: c.tripId,
      p_file: fileId,
      p_location: location,
    });
    if (final.error) failure(final.error.code);
    return final.data;
  }
  const issue = z.uuid().parse(form.get('issueId'));
  const reserve = await client.rpc('issue_photo_command', {
    p_issue: issue,
    p_file: fileId,
    p_action: 'reserve',
    p_mime: 'image/png',
    p_size: bytes.length,
  });
  if (reserve.error) failure(reserve.error.code);
  const f = fileResult.parse(reserve.data);
  if (f.state === 'FINAL') return f;
  await client.storage
    .from('issue-files')
    .upload(f.path, bytes, { contentType: 'image/png', upsert: false });
  const final = await client.rpc('issue_photo_command', {
    p_issue: issue,
    p_file: fileId,
    p_action: 'finalize',
  });
  if (final.error) failure(final.error.code);
  return final.data;
}
export async function evidenceUrl(kind: unknown, id: unknown) {
  // Database checks current assignment or staff permission, including on signed URL creation.
  const client = await createSupabaseServerClient();
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new AppError('unauthenticated', 'Sign in required');
  const result = await client.rpc('driver_evidence_path', {
    p_kind: z.enum(['pod', 'issue']).parse(kind),
    p_id: z.uuid().parse(id),
  });
  if (result.error) failure(result.error.code);
  const f = z
    .object({ bucket: z.enum(['pod-files', 'issue-files']), path: z.string() })
    .parse(result.data);
  const signed = await client.storage.from(f.bucket).createSignedUrl(f.path, 60);
  if (signed.error) throw new AppError('forbidden', 'Evidence unavailable');
  return { url: signed.data.signedUrl };
}
