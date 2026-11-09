import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { activeCountry, resolveActiveCountry } from '@/domain/markets/public-contact';
import { MarketSelector } from '@/components/shell/market-selector';
const mock = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mock.set }) }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('http://localhost:3000'),
}));
import { POST } from '@/app/api/public/market/route';
it.each([undefined, 'SA', 'EG'])('resolves %s to Egypt without changing identity', (value) =>
  expect(resolveActiveCountry(value)).toBe('EG'),
);
it.each(['SA', 'SAR', 'ZZ', { country: 'SA' }])('rejects direct active country %j', (value) =>
  expect(activeCountry.safeParse(value).success).toBe(false),
);
it.each(['ar', 'en'] as const)('renders Egypt without a market switch in %s', (locale) => {
  const html = renderToStaticMarkup(createElement(MarketSelector, { locale, country: 'EG' }));
  expect(html).not.toContain('<select');
  expect(html).not.toContain('🇸🇦');
  expect(html).toContain('🇪🇬');
});
it('rejects a direct SA market POST without writing a cookie', async () => {
  mock.set.mockClear();
  const r = await POST(
    new Request('http://localhost:3000/api/public/market', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ country: 'SA' }),
    }),
  );
  expect(r.status).toBe(400);
  expect(mock.set).not.toHaveBeenCalled();
});
it('accepts Egypt through the existing origin guard', async () => {
  const r = await POST(
    new Request('http://localhost:3000/api/public/market', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ country: 'EG' }),
    }),
  );
  expect(r.status).toBe(200);
  expect(mock.set).toHaveBeenCalledWith('naql365_market', 'EG', expect.any(Object));
});
