import { describe, expect, it } from 'vitest';
import { planInput, operationInput, nextStopAction } from '@/domain/operations/model';
const plan = {
  plannedStart: '2026-10-01T10:00:00Z',
  plannedEnd: '2026-10-01T12:00:00Z',
  stops: [
    { cityId: '33500000-0000-4000-8000-000000000001', kind: 'PICKUP', address: 'A', pickups: [] },
    {
      cityId: '33500000-0000-4000-8000-000000000001',
      kind: 'DELIVERY',
      address: 'B',
      pickups: [0],
    },
  ],
};
describe('operational command validation', () => {
  it('validates stop-level dependency and schedule facts', () => {
    expect(planInput.safeParse(plan).success).toBe(true);
    expect(planInput.safeParse({ ...plan, plannedEnd: plan.plannedStart }).success).toBe(false);
    expect(
      planInput.safeParse({
        ...plan,
        stops: [plan.stops[0], { kind: 'DELIVERY', address: 'B', pickups: [1] }],
      }).success,
    ).toBe(false);
    expect(
      planInput.safeParse({
        ...plan,
        stops: [plan.stops[0], { kind: 'DELIVERY', address: 'B', pickups: [] }],
      }).success,
    ).toBe(false);
  });
  it('does not expose free-form status mutation or unconfirmed reassignment', () => {
    const id = '13000000-0000-4000-8000-000000000001';
    const base = { organizationId: id, entityId: id, mutationId: id, revision: 0 };
    expect(
      operationInput.safeParse({ ...base, action: 'set_status', payload: { status: 'COMPLETED' } })
        .success,
    ).toBe(false);
    expect(
      operationInput.safeParse({
        ...base,
        action: 'reassign',
        payload: { driverId: id, vehicleId: id, reason: 'Emergency' },
      }).success,
    ).toBe(false);
    expect(
      operationInput.safeParse({
        ...base,
        action: 'reassign',
        payload: { driverId: id, vehicleId: id, reason: 'Emergency', confirmed: true },
      }).success,
    ).toBe(true);
  });
  it('only suggests the next explicit stop action', () => {
    expect(nextStopAction('ARRIVED')).toBe('start_service');
    expect(nextStopAction('COMPLETED')).toBe(null);
  });
});
