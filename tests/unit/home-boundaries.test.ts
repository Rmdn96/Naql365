import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  market: vi.fn(),
  catalogue: vi.fn(),
  headers: vi.fn(),
  trace: vi.fn(),
}));
vi.mock('@/infrastructure/markets/public', () => ({
  selectedPublicCountry: mocks.market,
  publicCatalogue: mocks.catalogue,
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/infrastructure/store/catalog-trace', () => ({ catalogTrace: mocks.trace }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('http://localhost:3017'),
}));
vi.mock('@/components/public/landing', () => ({ Landing: () => null }));
vi.mock('@/components/store/introduction', () => ({ StoreIntroduction: () => null }));
import Home from '@/app/[locale]/page';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.market.mockResolvedValue('EG');
  mocks.catalogue.mockResolvedValue([]);
  mocks.headers.mockResolvedValue(new Headers());
});
it('composes only after both unchanged parallel prerequisites succeed', async () => {
  const result = await Home({ params: Promise.resolve({ locale: 'en' }) });
  expect(result).toBeTruthy();
  const events = mocks.trace.mock.calls.map(([event]) => event);
  expect(events).toContainEqual({ stage: 'home-market', country: 'EG' });
  const compose = events.findIndex((event) => event.stage === 'home-compose');
  for (const stage of ['home-market', 'home-catalogue'])
    expect(
      events.findIndex((event) => event.stage === stage && event.outcome === 'ready'),
    ).toBeLessThan(compose);
});
it.each(['market', 'catalogue'] as const)(
  'identifies failing %s before composition without replacing the exception',
  async (dependency) => {
    const error = new TypeError('private');
    mocks[dependency].mockRejectedValue(error);
    await expect(Home({ params: Promise.resolve({ locale: 'ar' }) })).rejects.toBe(error);
    expect(mocks.trace).toHaveBeenCalledWith({
      stage: 'home-' + dependency,
      outcome: 'threw',
      exception: 'TypeError',
    });
    expect(mocks.trace.mock.calls.some(([event]) => event.stage === 'home-compose')).toBe(false);
    expect(mocks.headers).not.toHaveBeenCalled();
  },
);
it('classifies composition failures and propagates them unchanged', async () => {
  const error = new Error('private');
  mocks.headers.mockRejectedValue(error);
  await expect(Home({ params: Promise.resolve({ locale: 'en' }) })).rejects.toBe(error);
  expect(mocks.trace).toHaveBeenCalledWith({
    stage: 'home-compose',
    outcome: 'threw',
    exception: 'Error',
  });
});
