import { blankDraft } from '@/domain/requests/intake';
import type { RequestDetails } from '@/infrastructure/requests/service';

// Synthetic component-test data only; never seeded into an application database.
export const requestId = '10000000-0000-4000-8000-000000000001';
export const serviceId = '10000000-0000-4000-8000-000000000002';
export const cityId = '10000000-0000-4000-8000-000000000003';
export function transportFixture(): RequestDetails {
  return {
    market: {
      id: requestId,
      organization_id: requestId,
      country_code: 'EG',
      name_ar: 'مصر — اختبار',
      name_en: 'Egypt — TEST',
      active: true,
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      phone_country_code: '+20',
    },
    request: {
      id: requestId,
      revision: 0,
      status: 'DRAFT',
      reference: null,
      created_at: '2026-10-22T00:00:00Z',
      submitted_at: null,
    },
    payload: blankDraft(),
    cities: [
      {
        id: cityId,
        name_ar: 'القاهرة — اختبار',
        name_en: 'Cairo — TEST',
        region_id: requestId,
        market_regions: { name_ar: 'اختبار', name_en: 'TEST' },
      },
    ],
    coverage: [
      { service_id: serviceId, city_id: cityId, pickup_eligible: true, delivery_eligible: true },
    ],
    services: [
      {
        id: serviceId,
        name_ar: 'نقل تجريبي',
        name_en: 'TEST Transport',
        active: true,
        property_required: false,
      },
    ],
    applicability: [],
    options: [],
    attachments: [],
  };
}
