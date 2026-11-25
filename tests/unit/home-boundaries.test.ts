import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  trace: vi.fn(),
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/infrastructure/store/catalog-trace', () => ({ catalogTrace: mocks.trace }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('http://localhost:3017'),
}));
vi.mock('@/components/lovable/surface', () => ({ CommerceSurface: () => null }));
import Home from '@/app/[locale]/page';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
});
it('passes only bounded product filters to the storefront', async () => {
  const home = await Home({
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve({
      search: 'boxes',
      category: 'packing',
      after: 'malformed cursor',
    }),
  });
  expect(home.props.children[1].props.query).toEqual({ search: 'boxes', category: 'packing' });
});
it('classifies composition failures and propagates them unchanged', async () => {
  const error = new Error('private');
  mocks.headers.mockRejectedValue(error);
  await expect(
    Home({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) }),
  ).rejects.toBe(error);
  expect(mocks.trace).toHaveBeenCalledWith({
    stage: 'home-compose',
    outcome: 'threw',
    exception: 'Error',
  });
});
