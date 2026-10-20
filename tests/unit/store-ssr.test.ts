import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), country: vi.fn(), env: vi.fn(), client: vi.fn() }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock('@/infrastructure/markets/public', () => ({ selectedPublicCountry: mocks.country }));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: mocks.env }));
import { storeShop } from '@/infrastructure/store/service';
import { storeCatalog } from '@/domain/store/model';
const product = {
  slug: 'synthetic-box',
  listingId: '98000000-0000-4000-8000-000000000003',
  revision: 1,
  category: 'packing',
  content: { title_ar: 'صندوق', title_en: 'Box' },
  amountMinor: 1250,
  currency: 'EGP',
  media: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.env.mockReturnValue({ url: 'http://127.0.0.1:55321', publishableKey: 'synthetic-only' });
  mocks.country.mockResolvedValue('EG');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('reports the actual implicit loopback HTTP port without printing endpoint or key material', async () => {
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  mocks.env.mockReturnValue({ url: 'http://127.0.0.1', publishableKey: 'synthetic-only' });
  mocks.rpc.mockResolvedValue({
    data: { status: 'NOT_AVAILABLE', items: [], nextCursor: null },
    error: null,
    status: 200,
  });
  await storeShop();
  expect(log).toHaveBeenCalledWith(expect.stringContaining('"backendPort":80'));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/127\.0\.0\.1|synthetic-only/);
});
it('uses the same explicit anonymous EG RPC arguments and validated projection', async () => {
  const data = { status: 'AVAILABLE', items: [product], nextCursor: null };
  mocks.rpc.mockResolvedValue({ data, error: null, status: 200 });
  expect(await storeShop()).toEqual(storeCatalog.parse(data));
  expect(mocks.rpc).toHaveBeenCalledWith('store_shop_v1', { p_country: 'EG' });
});
it.each(['EG', 'SA'])(
  'preserves the request Market without a shared catalog cache (%s)',
  async (country) => {
    mocks.country.mockResolvedValue(country);
    mocks.rpc.mockResolvedValue({
      data: { status: 'NOT_AVAILABLE', items: [], nextCursor: null },
      error: null,
      status: 200,
    });
    expect((await storeShop()).items).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledWith('store_shop_v1', { p_country: country });
  },
);
it('does not replace an RPC denial or malformed projection with purchasable products', async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: '42501' }, data: null, status: 403 });
  await expect(storeShop()).rejects.toMatchObject({ code: 'forbidden' });
  mocks.rpc.mockResolvedValueOnce({
    error: null,
    data: { status: 'AVAILABLE', items: [{ ...product, amountMinor: -1 }], nextCursor: null },
    status: 200,
  });
  await expect(storeShop()).rejects.toThrow();
});
it('retains the safe unavailable state without configuration and performs no RPC', async () => {
  mocks.env.mockReturnValue(null);
  expect(await storeShop()).toEqual({ status: 'NOT_AVAILABLE', items: [], nextCursor: null });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each(['client', 'rpc'] as const)(
  'classifies a thrown %s boundary without exposing or replacing the exception',
  async (boundary) => {
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const failure = Error('synthetic-private-exception');
    if (boundary === 'client') mocks.client.mockRejectedValueOnce(failure);
    else mocks.rpc.mockRejectedValueOnce(failure);
    await expect(storeShop()).rejects.toBe(failure);
    const records = log.mock.calls.map(([line]) => JSON.parse(line.slice('CATALOG_SSR '.length)));
    expect(records).toContainEqual(expect.objectContaining({ stage: boundary, outcome: 'threw' }));
    expect(JSON.stringify(records)).not.toContain('synthetic-private-exception');
  },
);
