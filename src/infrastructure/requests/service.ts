import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
import { guestSessionClient } from '@/infrastructure/guest/session';
import { marketSchema } from '@/domain/markets/model';
import {
  blankDraft,
  commandInput,
  commandResult,
  draftInput,
  imageMime,
} from '@/domain/requests/intake';

function databaseError(code: string): never {
  if (code === 'PT409' || code === '40001') throw new AppError('conflict', 'Draft changed');
  if (code === '42501') throw new AppError('forbidden', 'Access denied');
  if (['22023', '22P02', '22007', '23514', '23503', '23505', '55000', '54000'].includes(code))
    throw new AppError('validation', 'Check request data');
  throw new AppError('internal', 'Operation unavailable');
}
export async function customerClient(writable = false) {
  const client = await createSupabaseServerClient(writable);
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('Customer session verification failed', {
      code: error.code ?? error.name,
      status: error.status,
    });
  }
  if (error || !data.user) throw new AppError('unauthenticated', 'Sign in required');
  const { data: customers, error: lookup } = await client
    .from('customers')
    .select('id,organization_id')
    .eq('profile_id', data.user.id);
  if (lookup) throw new AppError('internal', 'Customer lookup unavailable');
  const permitted = [];
  for (const c of customers ?? []) {
    const { data: allowed, error: denied } = await client.rpc('has_permission', {
      organization_id: c.organization_id,
      permission_code: 'account.access',
    });
    if (denied) throw new AppError('internal', 'Access lookup unavailable');
    if (allowed) permitted.push(c);
  }
  if (!permitted.length) throw new AppError('forbidden', 'Active customer membership required');
  return { client, user: data.user, customers: permitted };
}
export async function requestDetails(id: string, writable = false, guest = false) {
  z.uuid().parse(id);
  const { client, user } = guest
    ? { client: await guestSessionClient(), user: null }
    : await customerClient(writable);
  const { data: r, error } = await client.from('requests').select('*').eq('id', id).maybeSingle();
  if (error) databaseError(error.code);
  if (!r) throw new AppError('not_found', 'Request unavailable');
  const [marketResult, cities, coverage] = await Promise.all([
    client.from('markets').select('*').eq('id', r.market_id).single(),
    client
      .from('market_cities')
      .select('id,name_ar,name_en,region_id,market_regions(name_ar,name_en)')
      .eq('market_id', r.market_id)
      .order('name_en'),
    client
      .from('service_areas')
      .select('service_id,city_id')
      .eq('market_id', r.market_id)
      .eq('active', true),
  ]);
  if (marketResult.error || cities.error || coverage.error)
    throw new AppError('internal', 'Market context unavailable');
  const market = marketSchema.parse(marketResult.data);
  // Customer ownership remains explicit even when a principal has additional read permissions.
  const { data: owner } = await client
    .from('customers')
    .select('profile_id,identity_kind')
    .eq('id', r.customer_id)
    .single();
  if (!owner || (user ? owner.profile_id !== user.id : owner.identity_kind !== 'GUEST'))
    throw new AppError('not_found', 'Request unavailable');
  const [locations, items, additional, attachments, services, options] = await Promise.all([
    client.from('request_locations').select('*').eq('request_id', id),
    client
      .from('request_items')
      .select('description,quantity,notes')
      .eq('request_id', id)
      .order('position'),
    client.from('request_additional_services').select('additional_service_id').eq('request_id', id),
    client
      .from('request_attachments')
      .select('file_id,file_objects(id,mime_type,size_bytes,upload_state)')
      .eq('request_id', id),
    client
      .from('market_services')
      .select('active,services(id,name_ar,name_en,property_required,active)')
      .eq('market_id', r.market_id)
      .eq('organization_id', r.organization_id),
    client
      .from('additional_services')
      .select('id,name_ar,name_en,active')
      .eq('organization_id', r.organization_id)
      .order('code'),
  ]);
  for (const result of [locations, items, additional, attachments, services, options])
    if (result.error) databaseError(result.error.code);
  const draft = blankDraft();
  for (const l of locations.data ?? [])
    if (l.kind === 'pickup' || l.kind === 'delivery')
      draft[l.kind] = {
        city: l.city,
        city_id: l.city_id ?? '',
        postal_code: l.postal_code,
        building: l.building,
        unit: l.unit,
        district: l.district,
        address: l.address,
        notes: l.notes,
        floor: l.floor,
        elevator: l.elevator,
        access_notes: l.access_notes,
      };
  const payload = draftInput.parse({
    ...draft,
    service_id: r.service_id ?? '',
    description: r.description,
    notes: r.notes,
    items: items.data ?? [],
    additional_service_ids: additional.data?.map((a) => a.additional_service_id) ?? [],
    preferred_date: r.preferred_date ?? '',
    time_window: r.time_window ?? '',
    contact_name: r.contact_name,
    contact_phone: r.contact_phone,
    contact_email: r.contact_email,
    contact_notes: r.contact_notes,
  });
  return {
    market,
    cities: cities.data,
    coverage: coverage.data,
    request: {
      id: r.id,
      revision: r.revision,
      status: r.status,
      reference: r.reference,
      created_at: r.created_at,
      submitted_at: r.submitted_at,
    },
    payload,
    attachments: (attachments.data ?? []).flatMap((a) => (a.file_objects ? [a.file_objects] : [])),
    services: (services.data ?? []).flatMap((s) =>
      s.services ? [{ ...s.services, active: s.active && s.services.active }] : [],
    ),
    options: options.data ?? [],
  };
}
export type RequestDetails = Awaited<ReturnType<typeof requestDetails>>;
export async function createDraft(key: unknown, marketId: unknown) {
  const mutation = z.uuid().parse(key);
  const { client } = await customerClient(true);
  const { data, error } = await client.rpc('create_customer_request', {
    p_key: mutation,
    p_market_id: z.uuid().parse(marketId),
  });
  if (error) databaseError(error.code);
  return commandResult.parse(data);
}
export async function mutateRequest(id: string, input: unknown, guest = false) {
  z.uuid().parse(id);
  const command = commandInput.parse(input);
  const client = guest ? await guestSessionClient() : (await customerClient(true)).client;
  const { data, error } = await client.rpc('request_command', {
    p_operation: command.operation,
    p_request_id: id,
    p_revision: command.revision,
    p_mutation_id: command.mutationId,
    p_payload: command.operation === 'save' ? command.payload : {},
  });
  if (error) databaseError(error.code);
  return commandResult.parse(data);
}
const fileResult = z.object({ id: z.uuid(), path: z.string(), state: z.string() });
export async function removeAttachment(requestId: string, fileId: string, guest = false) {
  z.uuid().parse(requestId);
  z.uuid().parse(fileId);
  const client = guest ? await guestSessionClient() : (await customerClient(true)).client;
  const { data, error } = await client.rpc('request_file_command', {
    p_operation: 'remove',
    p_request_id: requestId,
    p_file_id: fileId,
  });
  if (error) databaseError(error.code);
  const file = fileResult.parse(data);
  const { error: storageError } = await client.storage.from('attachments').remove([file.path]);
  if (storageError) throw new AppError('internal', 'File removal pending');
  const result = await client.rpc('request_file_command', {
    p_operation: 'finish_remove',
    p_request_id: requestId,
    p_file_id: fileId,
  });
  if (result.error) databaseError(result.error.code);
  return { removed: true };
}
export async function uploadAttachment(
  requestId: string,
  fileId: string,
  file: File,
  guest = false,
) {
  z.uuid().parse(requestId);
  z.uuid().parse(fileId);
  if (file.size < 1 || file.size > 3 * 1024 * 1024)
    throw new AppError('validation', 'Image size invalid');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = imageMime(bytes);
  if (!mime || mime !== file.type) throw new AppError('validation', 'Image type invalid');
  const client = guest ? await guestSessionClient() : (await customerClient(true)).client;
  const { data, error } = await client.rpc('request_file_command', {
    p_operation: 'reserve',
    p_request_id: requestId,
    p_file_id: fileId,
    p_mime: mime,
    p_size: file.size,
  });
  if (error) databaseError(error.code);
  const reserved = fileResult.parse(data);
  if (reserved.state === 'ready') return reserved;
  const { error: uploadError } = await client.storage
    .from('attachments')
    .upload(reserved.path, bytes, { contentType: mime, upsert: false });
  if (uploadError) {
    // A lost response can leave a valid immutable upload. Finalize verifies stored MIME/size.
    const retry = await client.rpc('request_file_command', {
      p_operation: 'finalize',
      p_request_id: requestId,
      p_file_id: fileId,
    });
    if (!retry.error) return fileResult.parse(retry.data);
    throw new AppError('internal', 'Upload incomplete; remove or retry the reservation');
  }
  const finished = await client.rpc('request_file_command', {
    p_operation: 'finalize',
    p_request_id: requestId,
    p_file_id: fileId,
  });
  if (finished.error) databaseError(finished.error.code);
  return fileResult.parse(finished.data);
}
