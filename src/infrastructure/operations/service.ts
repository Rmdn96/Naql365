import 'server-only';
import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import {
  operationInput,
  operationResult,
  podInput,
  progressSchema,
} from '@/domain/operations/model';
import { portalAccess } from '@/infrastructure/identity/access';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { customerClient } from '@/infrastructure/requests/service';
import { marketSchema } from '@/domain/markets/model';
import { normalizeSignature } from './signature';

function dbError(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Operational access denied');
  if (['40001', '23505'].includes(code))
    throw new AppError('conflict', 'Operational state changed');
  if (['22023', '22P02', '23514', '23502', '55000', '22007', '22008'].includes(code))
    throw new AppError('validation', 'Invalid operational action');
  throw new AppError('internal', 'Operation unavailable');
}
async function staffClient(
  permission = 'operations.manage',
  organizationId?: string,
  writable = false,
) {
  const access = await portalAccess(permission, organizationId);
  if (access.status === 'unauthenticated')
    throw new AppError('unauthenticated', 'Sign in required');
  if (access.status !== 'authorized')
    throw new AppError('forbidden', 'Operational permission required');
  return {
    client: await createSupabaseServerClient(writable),
    organizationId: access.principal.organizationId,
  };
}
export async function executeOperation(input: unknown) {
  const command = operationInput.parse(input);
  const permission =
    command.action.includes('driver') || command.action.includes('vehicle')
      ? 'fleet.manage'
      : ['create_job', 'create_trip', 'plan'].includes(command.action)
        ? 'operations.manage'
        : 'dispatch.manage';
  const { client } = await staffClient(permission, command.organizationId, true);
  const { data, error } = await client.rpc('operations_command', {
    p_organization_id: command.organizationId,
    p_action: command.action,
    p_entity_id: command.entityId,
    p_revision: command.revision,
    p_mutation_id: command.mutationId,
    p_payload: command.payload,
  });
  if (error) dbError(error.code);
  return operationResult.parse(data);
}
export async function operationsWorkspace() {
  const { client, organizationId } = await staffClient();
  const marketResult = await client
    .from('markets')
    .select('*')
    .eq('organization_id', organizationId);
  if (marketResult.error) dbError(marketResult.error.code);
  const markets = marketSchema.array().parse(marketResult.data);
  const [orders, jobs, trips, drivers, vehicles, assignments] = await Promise.all([
    client
      .from('orders')
      .select('id,market_id,currency,reference,operational_status,accepted_at,jobs(id)')
      .eq('organization_id', organizationId)
      .not('accepted_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('jobs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('trips')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(200),
    client
      .from('drivers')
      .select('id,market_id,display_name,driver_type,active')
      .eq('organization_id', organizationId)
      .order('display_name')
      .limit(500),
    client
      .from('vehicles')
      .select('id,market_id,identifier,vehicle_type,active')
      .eq('organization_id', organizationId)
      .order('identifier')
      .limit(500),
    client
      .from('assignments')
      .select('id,trip_id,driver_id,vehicle_id,execution_active')
      .eq('organization_id', organizationId)
      .is('ended_at', null)
      .limit(500),
  ]);
  for (const result of [orders, jobs, trips, drivers, vehicles, assignments])
    if (result.error) dbError(result.error.code);
  return {
    organizationId,
    markets,
    orders: orders.data ?? [],
    jobs: jobs.data ?? [],
    trips: trips.data ?? [],
    drivers: drivers.data ?? [],
    vehicles: vehicles.data ?? [],
    assignments: assignments.data ?? [],
  };
}
export type OperationsWorkspace = Awaited<ReturnType<typeof operationsWorkspace>>;
export async function operationalJob(id: string) {
  z.uuid().parse(id);
  const { client, organizationId } = await staffClient();
  const { data: job, error } = await client
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) dbError(error.code);
  if (!job) throw new AppError('not_found', 'Job unavailable');
  const { data: trips, error: tripError } = await client
    .from('trips')
    .select('*')
    .eq('job_id', id)
    .order('created_at');
  if (tripError) dbError(tripError.code);
  const summary = await client.rpc('operational_job_summary', { p_job_id: id });
  if (summary.error) dbError(summary.error.code);
  const route = z
    .object({
      orderReference: z.string().nullable(),
      requestReference: z.string().nullable(),
      serviceAr: z.string().nullable(),
      serviceEn: z.string().nullable(),
      locations: z.array(
        z.object({ kind: z.string(), city: z.string(), district: z.string(), address: z.string() }),
      ),
    })
    .parse(summary.data);
  return { job, trips: trips ?? [], route };
}
export async function operationalTrip(id: string) {
  z.uuid().parse(id);
  const { client, organizationId } = await staffClient();
  const { data: trip, error } = await client
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) dbError(error.code);
  if (!trip) throw new AppError('not_found', 'Trip unavailable');
  const [marketResult, cities] = await Promise.all([
    client.from('markets').select('*').eq('id', trip.market_id).single(),
    client
      .from('market_cities')
      .select('id,name_ar,name_en')
      .eq('market_id', trip.market_id)
      .order('name_en'),
  ]);
  if (marketResult.error || cities.error) throw new AppError('internal', 'Trip market unavailable');
  const market = marketSchema.parse(marketResult.data);
  const [stops, dependencies, assignments, events, pod, drivers, vehicles] = await Promise.all([
    client.from('trip_stops').select('*').eq('trip_id', id).order('position'),
    client.from('trip_stop_dependencies').select('*').eq('trip_id', id),
    client
      .from('assignments')
      .select('*,drivers(display_name,driver_type),vehicles(identifier)')
      .eq('trip_id', id)
      .order('created_at'),
    client
      .from('trip_events')
      .select('id,event_type,occurred_at,actor_id')
      .eq('trip_id', id)
      .order('occurred_at', { ascending: false })
      .limit(100),
    client
      .from('trip_pods')
      .select('id,state,recipient_name,captured_at,actor_id')
      .eq('trip_id', id)
      .maybeSingle(),
    client
      .from('drivers')
      .select('id,display_name,driver_type')
      .eq('market_id', trip.market_id)
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('display_name')
      .limit(500),
    client
      .from('vehicles')
      .select('id,identifier,vehicle_type')
      .eq('market_id', trip.market_id)
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('identifier')
      .limit(500),
  ]);
  for (const result of [stops, dependencies, assignments, events, pod, drivers, vehicles])
    if (result.error) dbError(result.error.code);
  return {
    trip,
    market,
    cities: cities.data,
    stops: stops.data ?? [],
    dependencies: dependencies.data ?? [],
    assignments: assignments.data ?? [],
    events: events.data ?? [],
    pod: pod.data,
    drivers: drivers.data ?? [],
    vehicles: vehicles.data ?? [],
  };
}
export type OperationalTrip = Awaited<ReturnType<typeof operationalTrip>>;
const fileResult = z.object({
  id: z.uuid(),
  path: z.string(),
  state: z.enum(['PENDING', 'REMOVING', 'FINAL']),
});
export async function uploadTripPod(input: unknown, file: File) {
  const data = podInput.parse(input);
  if (file.size < 1 || file.size > 2097152)
    throw new AppError('validation', 'Signature size invalid');
  const bytes = await normalizeSignature(new Uint8Array(await file.arrayBuffer()), file.type);
  const mime = 'image/png';
  const { client } = await staffClient('dispatch.manage', undefined, true);
  const reserved = await client.rpc('trip_pod_command', {
    p_trip_id: data.tripId,
    p_file_id: data.fileId,
    p_action: 'reserve',
    p_recipient: data.recipient,
    p_mime: mime,
    p_size: bytes.length,
    p_notes: data.notes,
  });
  if (reserved.error) dbError(reserved.error.code);
  const reservation = fileResult.parse(reserved.data);
  if (reservation.state === 'FINAL') return reservation;
  // An immutable existing object after a lost response may still be finalized safely.
  await client.storage
    .from('pod-files')
    .upload(reservation.path, bytes, { contentType: mime, upsert: false });
  const finished = await client.rpc('trip_pod_command', {
    p_trip_id: data.tripId,
    p_file_id: data.fileId,
    p_action: 'finalize',
  });
  if (finished.error) dbError(finished.error.code);
  return fileResult.parse(finished.data);
}
export async function abortTripPod(tripId: string, fileId: string) {
  z.uuid().parse(tripId);
  z.uuid().parse(fileId);
  const { client } = await staffClient('dispatch.manage', undefined, true);
  const aborted = await client.rpc('trip_pod_command', {
    p_trip_id: tripId,
    p_file_id: fileId,
    p_action: 'abort',
  });
  if (aborted.error) dbError(aborted.error.code);
  const f = fileResult.parse(aborted.data);
  const removed = await client.storage.from('pod-files').remove([f.path]);
  if (removed.error) throw new AppError('internal', 'Signature removal pending');
  const finished = await client.rpc('trip_pod_command', {
    p_trip_id: tripId,
    p_file_id: fileId,
    p_action: 'finish_abort',
  });
  if (finished.error) dbError(finished.error.code);
  return { removed: true };
}
export async function privatePodUrl(tripId: string) {
  z.uuid().parse(tripId);
  const { client } = await staffClient('pod.read');
  const { data, error } = await client
    .from('trip_pods')
    .select('object_name')
    .eq('trip_id', tripId)
    .eq('state', 'FINAL')
    .maybeSingle();
  if (error) dbError(error.code);
  if (!data) throw new AppError('not_found', 'POD unavailable');
  const signed = await client.storage.from('pod-files').createSignedUrl(data.object_name, 60);
  if (signed.error) throw new AppError('forbidden', 'Signature unavailable');
  return { url: signed.data.signedUrl };
}
export async function customerProgress(orderId: string) {
  z.uuid().parse(orderId);
  const { client } = await customerClient();
  const { data, error } = await client.rpc('customer_order_progress', { p_order_id: orderId });
  if (error) dbError(error.code);
  return progressSchema.parse(data);
}
