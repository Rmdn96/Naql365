import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), trace: vi.fn() }));
vi.mock('@/infrastructure/guest/session', () => ({ guestDatabase: () => ({ rpc: mock.rpc }) }));
vi.mock('@/infrastructure/config/public-env', () => ({
  getPublicEnv: () => ({ configured: true }),
}));
vi.mock('@/infrastructure/store/catalog-trace', () => ({ catalogTrace: mock.trace }));
import { publicCatalogue } from '@/infrastructure/markets/public';
beforeEach(() => vi.clearAllMocks());
it('distinguishes response parse rejection from RPC error without exposing payload', async () => {
  mock.rpc.mockResolvedValue({ data: [{ private: 'not-a-catalogue' }], error: null, status: 200 });
  await expect(publicCatalogue()).rejects.toHaveProperty('name', 'ZodError');
  expect(mock.trace).toHaveBeenCalledWith({
    stage: 'public-catalogue-rpc',
    rpcError: false,
    httpStatus: 200,
  });
  expect(mock.trace).toHaveBeenCalledWith({
    stage: 'public-catalogue-parse',
    outcome: 'threw',
    exception: 'ZodError',
  });
  expect(JSON.stringify(mock.trace.mock.calls)).not.toContain('not-a-catalogue');
});
it('preserves the existing RPC failure and empty catalogue contracts', async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'private' }, status: 403 });
  await expect(publicCatalogue()).rejects.toMatchObject({ code: 'internal' });
  expect(mock.trace.mock.calls.some(([event]) => event.stage === 'public-catalogue-parse')).toBe(
    false,
  );
  mock.rpc.mockResolvedValueOnce({ data: [], error: null, status: 200 });
  await expect(publicCatalogue()).resolves.toEqual([]);
});
