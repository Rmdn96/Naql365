import { z } from 'zod';
export const trackingPolicy = z.object({
  movingSeconds: z.number().int().min(10).max(120),
  stationarySeconds: z.number().int().min(120).max(900),
  staleSeconds: z.number().int().min(30).max(600),
  movementM: z.number().min(10).max(500),
  speedMps: z.number().min(0.5).max(10),
  maxAgeSeconds: z.number().int().min(30).max(300),
  futureSeconds: z.number().int().min(0).max(30),
});
export type TrackingPolicy = z.infer<typeof trackingPolicy>;
export const locationSample = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1000),
  speed: z.number().min(0).max(100).nullable().optional(),
  heading: z.number().min(0).lt(360).nullable().optional(),
  capturedAt: z.iso.datetime({ offset: true }),
  clientType: z.enum(['WEB', 'NATIVE']),
});
export const locationPublication = z.strictObject({
  tripId: z.uuid(),
  sampleId: z.uuid(),
  location: locationSample,
});
export type LocationSample = z.infer<typeof locationSample>;
export const trackingQuery = z.strictObject({
  mode: z.literal('driver').optional(),
  orderId: z.uuid().optional(),
  marketId: z.uuid().optional(),
  tripId: z.uuid().optional(),
  driverId: z.uuid().optional(),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const trackingTrip = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.string(),
  active: z.boolean(),
  market: z.object({ id: z.uuid(), countryCode: z.enum(['SA', 'EG']), timezone: z.string() }),
  nextStop: z.object({ kind: z.enum(['PICKUP', 'DELIVERY']), position: z.number() }).nullable(),
  location: locationSample
    .pick({ latitude: true, longitude: true, accuracy: true, capturedAt: true })
    .extend({ receivedAt: z.string() })
    .nullable(),
  eta: z.object({ status: z.literal('UNAVAILABLE'), reason: z.literal('PROVIDER_NOT_CONFIGURED') }),
});
export type TrackingTrip = z.infer<typeof trackingTrip>;
export function displacement(
  a: Pick<LocationSample, 'latitude' | 'longitude'>,
  b: Pick<LocationSample, 'latitude' | 'longitude'>,
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  return (
    6371000 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.min(
          1,
          Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
            Math.cos(rad(a.latitude)) *
              Math.cos(rad(b.latitude)) *
              Math.sin(rad(b.longitude - a.longitude) / 2) ** 2,
        ),
      ),
    )
  );
}
export function publicationDue(
  sample: LocationSample,
  last: { sample: LocationSample; receivedAt: number } | null,
  policy: TrackingPolicy,
  now: number,
) {
  const captured = Date.parse(sample.capturedAt);
  if (captured < now - policy.maxAgeSeconds * 1000 || captured > now + policy.futureSeconds * 1000)
    return false;
  if (!last) return true;
  if (captured <= Date.parse(last.sample.capturedAt)) return false;
  const moving =
    (sample.speed ?? 0) > policy.speedMps ||
    displacement(sample, last.sample) >=
      Math.max(policy.movementM, sample.accuracy, last.sample.accuracy);
  return now - last.receivedAt >= (moving ? policy.movingSeconds : policy.stationarySeconds) * 1000;
}
export function needsHeartbeatObservation(
  sample: LocationSample | null,
  last: { sample: LocationSample; receivedAt: number } | null,
  policy: TrackingPolicy,
  now: number,
) {
  return (
    !!last &&
    now - last.receivedAt >= policy.stationarySeconds * 1000 &&
    (!sample ||
      Date.parse(sample.capturedAt) <= Date.parse(last.sample.capturedAt) ||
      now - Date.parse(sample.capturedAt) > policy.maxAgeSeconds * 1000)
  );
}
export function freshness(
  active: boolean,
  receivedAt: string | null,
  policy: TrackingPolicy,
  now: number,
): 'LIVE' | 'STALE' | 'UNAVAILABLE' {
  if (!active || !receivedAt) return 'UNAVAILABLE';
  return now - Date.parse(receivedAt) >= policy.staleSeconds * 1000 ? 'STALE' : 'LIVE';
}
export interface EtaProvider {
  estimate(input: {
    location: LocationSample;
    destination: { latitude: number; longitude: number };
    market: 'SA' | 'EG';
    nextStopId: string;
  }): Promise<
    | {
        status: 'AVAILABLE';
        arrival: string;
        calculatedAt: string;
        validUntil: string;
        provider: string;
      }
    | { status: 'UNAVAILABLE'; reason: 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_ERROR' }
  >;
}
export const unavailableEta: EtaProvider = {
  async estimate() {
    return { status: 'UNAVAILABLE', reason: 'PROVIDER_NOT_CONFIGURED' };
  },
};
// Independent from GPS publication; no provider call is made by the unavailable adapter.
export const etaRefreshPolicy = { minimumSeconds: 300, movementM: 500, validSeconds: 600 } as const;
export type MapPoint = Readonly<{ id: string; latitude: number; longitude: number; label: string }>;
export interface MapViewport {
  center: { latitude: number; longitude: number };
  zoom: number;
  points: readonly MapPoint[];
}
