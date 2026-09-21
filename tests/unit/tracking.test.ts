import { expect, it } from 'vitest';
import {
  locationPublication,
  publicationDue,
  needsHeartbeatObservation,
  freshness,
  displacement,
  unavailableEta,
  type LocationSample,
  type TrackingPolicy,
} from '@/domain/tracking/model';
const p: TrackingPolicy = {
  movingSeconds: 30,
  stationarySeconds: 180,
  staleSeconds: 90,
  movementM: 25,
  speedMps: 1.5,
  maxAgeSeconds: 120,
  futureSeconds: 15,
};
const now = Date.parse('2026-09-19T12:00:00Z');
const sample = (time = now, speed: number | null = 0): LocationSample => ({
  latitude: 30.0444,
  longitude: 31.2357,
  accuracy: 5,
  speed,
  capturedAt: new Date(time).toISOString(),
  clientType: 'WEB',
});
it('separates moving transmission from stationary heartbeat and GPS observation', () => {
  const last = { sample: sample(now - 180000), receivedAt: now - 29000 };
  expect(publicationDue(sample(now, 3), last, p, now)).toBe(false);
  expect(publicationDue(sample(now, 3), { ...last, receivedAt: now - 30000 }, p, now)).toBe(true);
  expect(publicationDue(sample(), { ...last, receivedAt: now - 179000 }, p, now)).toBe(false);
  expect(publicationDue(sample(), { ...last, receivedAt: now - 180000 }, p, now)).toBe(true);
  expect(publicationDue(sample(now - 121000), null, p, now)).toBe(false);
  expect(publicationDue(sample(now + 16000), null, p, now)).toBe(false);
});
it('uses real displacement and labels stale/unavailable without fabricated movement', () => {
  expect(displacement(sample(), sample())).toBe(0);
  expect(displacement(sample(), { ...sample(), latitude: 30.045 })).toBeGreaterThan(25);
  expect(freshness(true, new Date(now - 89000).toISOString(), p, now)).toBe('LIVE');
  expect(freshness(true, new Date(now - 90000).toISOString(), p, now)).toBe('STALE');
  expect(freshness(false, new Date(now).toISOString(), p, now)).toBe('UNAVAILABLE');
  expect(freshness(true, null, p, now)).toBe('UNAVAILABLE');
});
it('rejects forged relationship fields and does not invent ETA', async () => {
  const id = '14000000-0000-4000-8000-000000000001';
  expect(
    locationPublication.safeParse({ tripId: id, sampleId: id, location: sample(), driverId: id })
      .success,
  ).toBe(false);
  expect(
    locationPublication.safeParse({
      tripId: id,
      sampleId: id,
      location: { ...sample(), latitude: 91 },
    }).success,
  ).toBe(false);
  expect(
    await unavailableEta.estimate({
      location: sample(),
      destination: sample(),
      market: 'EG',
      nextStopId: id,
    }),
  ).toEqual({ status: 'UNAVAILABLE', reason: 'PROVIDER_NOT_CONFIGURED' });
});

it('requests a fresh stationary observation without fabricating a timestamp or extra publication', () => {
  const last = { sample: sample(now - 180000), receivedAt: now - 180000 };
  expect(needsHeartbeatObservation(last.sample, last, p, now)).toBe(true);
  expect(
    needsHeartbeatObservation(last.sample, { ...last, receivedAt: now - 179000 }, p, now),
  ).toBe(false);
  expect(needsHeartbeatObservation(sample(), last, p, now)).toBe(false);
  expect(needsHeartbeatObservation(null, null, p, now)).toBe(false);
  expect(needsHeartbeatObservation(sample(now - 121000), null, p, now)).toBe(true);
  expect(needsHeartbeatObservation(sample(), null, p, now)).toBe(false);
  expect(publicationDue(last.sample, last, p, now)).toBe(false);
  expect(publicationDue(sample(), last, p, now)).toBe(true);
});
