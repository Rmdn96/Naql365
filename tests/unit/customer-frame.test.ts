import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ path: '/en/account' }));
vi.mock('next/navigation', () => ({
  usePathname: () => state.path,
  useRouter: () => ({ refresh() {} }),
}));
import { CustomerFrame } from '@/components/customer/frame';
import { isCustomerPath } from '@/components/customer/paths';
import { PublicChrome } from '@/components/shell/public-chrome';
import { TransportFrame } from '@/components/transport/frame';

test('Customer layout ownership is bounded to account descendants, never Auth, Staff, Driver or Store', () => {
  for (const path of ['/en/account', '/ar/account/quotes/x', '/en/account/orders/x/payment'])
    expect(isCustomerPath(path)).toBe(true);
  for (const path of [
    '/en/accounts',
    '/en/login',
    '/ar/request',
    '/en/portal',
    '/ar/driver',
    '/en/store/orders',
    'https://example.test/en/account',
  ])
    expect(isCustomerPath(path)).toBe(false);
});
for (const locale of ['ar', 'en'] as const) {
  test(`${locale} Customer shell keeps the official brand, canonical links and independent domain histories`, () => {
    state.path = `/${locale}/account/quotes/test`;
    const html = renderToStaticMarkup(
      createElement(
        CustomerFrame,
        {
          locale,
          country: 'EG',
          themeMode: 'dark',
        } as Parameters<typeof CustomerFrame>[0],
        createElement('p', null, 'Authorized child'),
      ),
    );
    expect(html).toContain('data-design-family="customer"');
    expect(html.match(/class="brand-mark"/g)).toHaveLength(1);
    const current = html.match(/<a\b[^>]*aria-current="page"[^>]*>/)?.[0];
    expect(current).toContain(`href="/${locale}/account/quotes"`);
    for (const route of [
      'account/requests',
      'store/orders',
      'store/cart',
      'request',
      'account#customer-profile',
    ])
      expect(html).toContain(`href="/${locale}/${route}"`);
    expect(html).toContain('Authorized child');
    expect(html).not.toMatch(/\/portal|\/driver|role=SUPER_ADMIN|token=/);
    expect(renderToStaticMarkup(createElement(PublicChrome, null, 'legacy'))).toBe('');
    expect(
      renderToStaticMarkup(
        createElement(
          TransportFrame,
          {
            locale,
            country: 'EG',
            themeMode: 'dark',
            identity: null,
            footerLinks: null,
          } as Parameters<typeof TransportFrame>[0],
          'retained',
        ),
      ),
    ).toBe('retained');
  });
}
test('Accepted Public/Auth/Store presentation passes through without another shell', () => {
  for (const path of ['/ar', '/en/login', '/ar/store/orders', '/en/guest']) {
    state.path = path;
    expect(
      renderToStaticMarkup(
        createElement(
          CustomerFrame,
          {
            locale: 'en',
            country: 'EG',
            themeMode: 'system',
          } as Parameters<typeof CustomerFrame>[0],
          'accepted',
        ),
      ),
    ).toBe('accepted');
  }
});
test('Tracking detail has no invented history route or misleading current Overview link', () => {
  state.path = '/en/account/orders/10000000-0000-4000-8000-000000000001';
  const html = renderToStaticMarkup(
    createElement(
      CustomerFrame,
      { locale: 'en', country: 'EG', themeMode: 'light' } as Parameters<typeof CustomerFrame>[0],
      'Authorized tracking',
    ),
  );
  expect(html).not.toContain('aria-current="page"');
  expect(html).not.toContain('href="/en/account/orders"');
  expect(html).toContain('Authorized tracking');
});
