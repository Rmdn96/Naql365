import { expect, test } from 'vitest';
import { manualQuoteInput } from '@/domain/pricing/model';
const input = {
  requestId: '51000000-0000-4000-8000-000000000001',
  expectedRevision: 2,
  subtotalMinor: 12345,
  distanceKm: 12.5,
  sourceNote: 'verified',
  validitySeconds: 1000,
  mutationId: '71000000-0000-4000-8000-000000000001',
};
test('manual quote input rejects authority forgery and unsafe numeric values', () => {
  expect(manualQuoteInput.safeParse(input).success).toBe(true);
  for (const fields of [
    { marketId: input.requestId },
    { organizationId: input.requestId },
    { currency: 'EGP' },
    { tax: 0 },
    { subtotalMinor: -1 },
    { subtotalMinor: 0.5 },
    { subtotalMinor: 900000000001 },
    { expectedRevision: -1 },
    { distanceKm: 1.0001 },
  ])
    expect(manualQuoteInput.safeParse({ ...input, ...fields }).success).toBe(false);
});
