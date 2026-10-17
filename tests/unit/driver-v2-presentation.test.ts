import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { DriverTrip } from '@/domain/driver/model';
vi.mock('@/app/auth/driver-actions', () => ({ driverLogout: vi.fn() }));
import { DriverTripCard, DriverSafety } from '@/components/driver/views';
import { driverDictionary } from '@/i18n/driver';

const trip: DriverTrip = {
  id: '14000000-0000-4000-8000-000000000001',
  reference: 'TEST-DRIVER-ONLY',
  status: 'IN_TRANSIT',
  revision: 3,
  plannedStart: null,
  plannedEnd: null,
  completedAt: null,
  market: {
    id: '14000000-0000-4000-8000-000000000002',
    countryCode: 'SA',
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    timezone: 'Asia/Riyadh',
  },
  vehicle: { identifier: 'TEST-VEHICLE', type: 'test' },
  contact: null,
  stops: [
    {
      id: '14000000-0000-4000-8000-000000000003',
      position: 1,
      kind: 'PICKUP',
      status: 'COMPLETED',
      address: 'Earlier pickup',
      instructions: '',
      arrivedAt: null,
      completedAt: null,
    },
    {
      id: '14000000-0000-4000-8000-000000000004',
      position: 2,
      kind: 'DELIVERY',
      status: 'PENDING',
      address: 'Synthetic next delivery',
      instructions: '',
      arrivedAt: null,
      completedAt: null,
    },
  ],
  attention: false,
  issues: [],
  pod: null,
};
for (const locale of ['ar', 'en'] as const) {
  it(`${locale} highlights the actual unfinished Stop, without showing the prior pickup as next`, () => {
    const html = renderToStaticMarkup(createElement(DriverTripCard, { locale, trip }));
    expect(html).toContain('Synthetic next delivery');
    expect(html).not.toContain('Earlier pickup');
    expect(html).toContain(driverDictionary(locale).unscheduled);
    expect(html).toContain(`href="/${locale}/driver/trips/${trip.id}"`);
    expect(html).toContain('<dl');
    expect(html).not.toMatch(/ETA|localStorage|latitude|longitude/);
  });
  it(`${locale} does not reconstruct redacted facts for completed history`, () => {
    const history: DriverTrip = {
      ...trip,
      status: 'COMPLETED',
      stops: trip.stops.map((s) => ({ ...s, status: 'COMPLETED', address: null })),
    };
    const html = renderToStaticMarkup(createElement(DriverTripCard, { locale, trip: history }));
    expect(html).not.toContain('driver-next-stop');
    expect(html).not.toContain('Synthetic next delivery');
    expect(html).not.toContain('Earlier pickup');
  });
  it(`${locale} provides a textual safe-stop note with a decorative symbol`, () => {
    const html = renderToStaticMarkup(createElement(DriverSafety, { locale }));
    expect(html).toContain('role="note"');
    expect(html).toContain(driverDictionary(locale).safety);
    expect(html).toContain('aria-hidden="true"');
  });
}
