import { afterEach, expect, it, vi } from 'vitest';
import { catalogIssueFields } from '@/infrastructure/store/catalog-trace';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it('reports only known schema field names, with no input values or arbitrary path identifiers', () => {
  expect(
    catalogIssueFields([
      { path: ['items', 0, 'amountMinor'] },
      { path: ['arbitrary-private-field'] },
      { path: ['items', 1, 'amountMinor'] },
    ]),
  ).toEqual(['amountMinor', 'root']);
});
it.each(['production', 'staging', 'local'])(
  'emits no diagnostics without explicit local opt-in (%s)',
  async (environment) => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubEnv('APP_ENV', environment);
    vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', environment === 'local' ? '0' : '1');
    const { catalogTrace } = await import('@/infrastructure/store/catalog-trace');
    catalogTrace({ stage: 'configuration', configured: true });
    expect(log).not.toHaveBeenCalled();
  },
);
it('bounds output and rejects payloads, identifiers and raw errors', async () => {
  vi.resetModules();
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
  const { catalogTrace } = await import('@/infrastructure/store/catalog-trace');
  // Runtime validation also protects against callers outside the TypeScript contract.
  catalogTrace({ stage: 'rpc', message: 'private payload' } as never);
  catalogTrace({ stage: 'rpc', code: 'private payload' });
  expect(log).not.toHaveBeenCalled();
  for (let i = 0; i < 140; i++) catalogTrace({ stage: 'projection', valid: true, items: 1 });
  expect(log).toHaveBeenCalledTimes(128);
  expect(JSON.parse(log.mock.calls[0]?.[0].slice('CATALOG_SSR '.length))).toMatchObject({
    stage: 'projection',
    items: 1,
    valid: true,
    version: 1,
    sequence: 1,
  });
});
