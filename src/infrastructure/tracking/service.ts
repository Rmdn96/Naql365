import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
import {
  locationPublication,
  trackingQuery,
  trackingPolicy,
  trackingTrip,
} from '@/domain/tracking/model';
async function client(writable = false) {
  const c = await createSupabaseServerClient(writable);
  const u = await c.auth.getUser();
  if (u.error || !u.data.user) throw new AppError('unauthenticated', 'Sign in required');
  return c;
}
function failure(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Tracking unavailable');
  if (['22023', '22P02', '22007', '22008', '23514', '23505'].includes(code))
    throw new AppError('validation', 'Invalid tracking command');
  throw new AppError('internal', 'Tracking unavailable');
}
export async function publishLocation(input: unknown) {
  const p = locationPublication.parse(input),
    c = await client(true);
  const { data, error } = await c.rpc('publish_trip_location', {
    p_trip: p.tripId,
    p_sample: p.sampleId,
    p_location: p.location,
  });
  if (error) failure(error.code);
  return data;
}
export async function getTracking(input: unknown) {
  const q = trackingQuery.parse(input),
    c = await client();
  if (q.mode === 'driver') {
    if (!q.tripId) throw new AppError('validation', 'Trip required');
    const authority = await c.rpc('driver_trip', { p_trip: q.tripId });
    if (authority.error) failure(authority.error.code);
  }
  const { data, error } = await c.rpc('tracking_feed', {
    ...(q.orderId ? { p_order: q.orderId } : {}),
    ...(q.marketId ? { p_market: q.marketId } : {}),
    ...(q.tripId ? { p_trip: q.tripId } : {}),
    ...(q.driverId ? { p_driver: q.driverId } : {}),
    p_offset: q.offset,
  });
  if (error) failure(error.code);
  const policy = await c.rpc('tracking_policy');
  if (policy.error) failure(policy.error.code);
  return {
    trips: trackingTrip.array().max(50).parse(data),
    policy: trackingPolicy.parse(policy.data),
  };
}
export const notification = z.object({
  id: z.uuid(),
  trip_id: z.uuid().nullable(),
  market_id: z.uuid(),
  event_code: z.enum([
    'TRIP_STARTED',
    'TRIP_COMPLETED',
    'TRIP_REASSIGNED',
    'ISSUE_REPORTED',
    'TRANSFER_PROOF_RECEIVED',
    'TRANSFER_CONFIRMED',
    'TRANSFER_REJECTED',
    'CASH_RECEIVED',
  ]),
  created_at: z.string(),
  read_at: z.string().nullable(),
});
export async function getNotifications() {
  const c = await client();
  const { data, error } = await c
    .from('notifications')
    .select('id,trip_id,market_id,event_code,created_at,read_at')
    .not('event_code', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) failure(error.code);
  const rows = notification.array().parse(data);
  const markets = await c
    .from('markets')
    .select('id,timezone')
    .in('id', [...new Set(rows.map((r) => r.market_id))]);
  if (markets.error) failure(markets.error.code);
  return rows.map((r) => {
    const market = markets.data.find((m) => m.id === r.market_id);
    if (!market) throw new AppError('forbidden', 'Market unavailable');
    return { ...r, timezone: market.timezone };
  });
}
export async function markNotification(input: unknown) {
  const p = z.strictObject({ id: z.uuid() }).parse(input),
    c = await client(true);
  const { error } = await c.rpc('read_notification', { p_notification: p.id });
  if (error) failure(error.code);
  return { read: true };
}
