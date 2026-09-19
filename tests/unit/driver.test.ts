import { expect, it } from 'vitest';
import { driverCommand, driverIssue, eventLocation } from '@/domain/driver/model';
import { marketDate } from '@/domain/markets/model';
const id = '14000000-0000-4000-8000-000000000001';
it('permits only explicit Driver commands with strict payloads', () => {
  const command = { tripId: id, action: 'dispatch', revision: 0, mutationId: id, payload: {} };
  expect(driverCommand.parse(command).action).toBe('dispatch');
  for (const action of ['assign', 'reassign', 'ready', 'fail', 'cancel', 'plan', 'setTripStatus'])
    expect(driverCommand.safeParse({ ...command, action }).success).toBe(false);
  expect(driverCommand.safeParse({ ...command, driverId: id }).success).toBe(false);
  expect(driverCommand.safeParse({ ...command, payload: { status: 'COMPLETED' } }).success).toBe(
    false,
  );
  expect(
    driverCommand.safeParse({
      ...command,
      location: { latitude: 24, longitude: 46, capturedAt: new Date().toISOString() },
    }).success,
  ).toBe(false);
});
it('requires bounded issue facts and rejects forged scope fields', () => {
  const issue = {
    tripId: id,
    stopId: id,
    category: 'OTHER',
    reason: 'Road blocked',
    mutationId: id,
  };
  expect(driverIssue.safeParse(issue).success).toBe(true);
  for (const reason of ['', '   ', 'x'.repeat(1001)])
    expect(driverIssue.safeParse({ ...issue, reason }).success).toBe(false);
  expect(driverIssue.safeParse({ ...issue, organizationId: id }).success).toBe(false);
  expect(driverIssue.safeParse({ ...issue, category: 'CANCEL_AND_REFUND' }).success).toBe(false);
});
it('validates optional milestone coordinates without fabricating a location', () => {
  const location = { latitude: 24.7, longitude: 46.6, capturedAt: new Date().toISOString() };
  expect(eventLocation.safeParse(location).success).toBe(true);
  for (const extra of [
    { latitude: 91 },
    { longitude: -181 },
    { accuracy: -1 },
    { eventId: id },
    { tripId: id },
  ])
    expect(eventLocation.safeParse({ ...location, ...extra }).success).toBe(false);
  expect(
    driverCommand.parse({
      tripId: id,
      action: 'arrive',
      revision: 2,
      mutationId: id,
      payload: { stopId: id },
    }).location,
  ).toBeNull();
});
it('uses each Market IANA date at the winter UTC boundary', () => {
  const instant = new Date('2026-01-10T21:30:00Z');
  expect(marketDate(instant, 'Asia/Riyadh')).toBe('2026-01-11');
  expect(marketDate(instant, 'Africa/Cairo')).toBe('2026-01-10');
});
