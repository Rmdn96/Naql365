import { afterEach, expect, it, vi } from 'vitest';
const trace = vi.hoisted(() => vi.fn());
vi.mock('@/infrastructure/store/catalog-trace', () => ({ catalogTrace: trace }));
import { onRequestError } from '@/instrumentation';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const context = {
  routerKind: 'App Router',
  routePath: '/[locale]',
  routeType: 'render',
  renderSource: 'react-server-components',
  revalidateReason: undefined,
} as const;
it('observes only local opted-in homepage server errors without request data', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
  await onRequestError(
    new TypeError('private-message'),
    { path: '/en?private-query', method: 'GET', headers: { cookie: 'private-cookie' } },
    context,
  );
  expect(trace).toHaveBeenCalledExactlyOnceWith({
    stage: 'route-error',
    outcome: 'threw',
    exception: 'TypeError',
  });
  await onRequestError(
    new Error('private'),
    { path: '/en/store', method: 'GET', headers: {} },
    context,
  );
  expect(trace).toHaveBeenCalledTimes(1);
});
it.each(['staging', 'production'])('does not observe %s exceptions', async (environment) => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('APP_ENV', environment);
  vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
  await onRequestError(new Error('private'), { path: '/en', method: 'GET', headers: {} }, context);
  expect(trace).not.toHaveBeenCalled();
});
