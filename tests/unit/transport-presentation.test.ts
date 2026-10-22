import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { isTransportPath } from '@/components/transport/paths';

const fixture = vi.hoisted(() => ({ country: 'EG', fail: false }));
vi.mock('@/infrastructure/markets/public', () => ({
  selectedPublicCountry: async () => fixture.country,
  publicCatalogue: async () => {
    if (fixture.fail) throw new Error('TEST_CATALOGUE_FAILURE');
    return [
      {
        country: 'EG',
        services: [{ id: 'eg', nameAr: 'نقل تجريبي', nameEn: 'Approved Egypt service' }],
        cities: [{ nameAr: 'القاهرة', nameEn: 'Cairo', pickupEligible: true }],
      },
      {
        country: 'SA',
        services: [{ id: 'sa', nameAr: 'خدمة أخرى', nameEn: 'Other market service' }],
        cities: [],
      },
    ];
  },
}));
vi.mock('@/components/transport/route-scene', () => ({ TransportRouteScene: () => null }));
import TransportPage from '@/app/[locale]/transport/page';

test('Transport visual frame is restricted to public and customer Transport route families', () => {
  for (const path of [
    '/ar/transport',
    '/en/request',
    '/ar/request/draft',
    '/en/guest/quotes/q',
    '/ar/account/requests/r',
    '/en/account/orders/o',
  ])
    expect(isTransportPath(path)).toBe(true);
  for (const path of [
    '/ar/login',
    '/en/account',
    '/ar/store',
    '/en/portal',
    '/ar/driver',
    '/en/requested',
    '/en/account/store-orders/o',
  ])
    expect(isTransportPath(path)).toBe(false);
});

test('landing uses the selected market catalogue without leaking other market service names', async () => {
  fixture.country = 'EG';
  const html = renderToStaticMarkup(
    await TransportPage({ params: Promise.resolve({ locale: 'en' }) }),
  );
  expect(html).toContain('Approved Egypt service');
  expect(html).toContain('Cairo');
  expect(html).not.toContain('Other market service');
  expect(html).toContain('href="/en/request"');
  expect(html).toContain('href="/en/guest"');
  expect(html).not.toMatch(/\b(?:SAR|EGP)\s*\d/);
});

test('stored Saudi preference is respected without inventing Egypt coverage', async () => {
  fixture.country = 'SA';
  const html = renderToStaticMarkup(
    await TransportPage({ params: Promise.resolve({ locale: 'en' }) }),
  );
  expect(html).toContain('Other market service');
  expect(html).not.toContain('Approved Egypt service');
  expect(html).not.toContain('Cairo');
});

test('catalogue errors propagate rather than fabricating available services', async () => {
  fixture.fail = true;
  try {
    await expect(TransportPage({ params: Promise.resolve({ locale: 'en' }) })).rejects.toThrow(
      'TEST_CATALOGUE_FAILURE',
    );
  } finally {
    fixture.fail = false;
  }
});
