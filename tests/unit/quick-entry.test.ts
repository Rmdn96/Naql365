import { expect, test } from 'vitest';
import { blankDraft } from '@/domain/requests/intake';
import { quickEntry, quickEntryQuery, prefillQuickEntry } from '@/domain/requests/quick-entry';

const service = '43500000-0000-4000-8000-000000000001';
const city = '33500000-0000-4000-8000-000000000001';
const entry = quickEntry.parse({ country: 'SA', service, pickupCity: city, deliveryCity: city });
const context = {
  country: 'SA',
  revision: 0,
  services: [{ id: service, active: true }],
  cities: [{ id: city, name_ar: 'مدينة اختبار', name_en: 'TEST city' }],
  coverage: [{ service_id: service, city_id: city }],
};
test('quick entry only carries public catalogue identifiers and uses the existing draft', () => {
  const payload = blankDraft();
  const result = prefillQuickEntry(payload, entry, context, 'ar');
  expect(result.service_id).toBe(service);
  expect(result.pickup.city_id).toBe(city);
  expect(result.delivery.city).toBe('مدينة اختبار');
  expect(payload.service_id).toBe('');
  expect(result.pickup.address).toBe('');
  expect(quickEntryQuery(entry)).toContain('country=SA');
  expect(quickEntry.safeParse({ ...entry, pickupCity: 'private-address' }).success).toBe(false);
});
test('forged/inactive/out-of-coverage/cross-Market selections cannot override stored drafts', () => {
  const payload = blankDraft();
  for (const invalid of [
    { ...context, country: 'EG' },
    { ...context, revision: 1 },
    { ...context, cities: [] },
    { ...context, services: [{ id: service, active: false }] },
    { ...context, coverage: [] },
    { ...context, coverage: [{ service_id: service, city_id: null }] },
  ])
    expect(prefillQuickEntry(payload, entry, invalid, 'en')).toBe(payload);
});
