import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSameOrigin, smokeSignIn } from '@/application/identity/smoke-auth';
import {
  deploymentEnvironment,
  preventIndexing,
  stagingAuthEnabled,
} from '@/infrastructure/config/deployment-env';

afterEach(() => vi.unstubAllEnvs());
describe('staging environment safety', () => {
  it('disables smoke authentication unless explicitly enabled', () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('STAGING_AUTH_SMOKE_ENABLED', '');
    expect(stagingAuthEnabled()).toBe(false);
    expect(preventIndexing()).toBe(true);
  });
  it('never enables smoke endpoints for production', () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('STAGING_AUTH_SMOKE_ENABLED', 'true');
    expect(stagingAuthEnabled()).toBe(false);
  });
  it('rejects a preview accidentally using production configuration', () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(() => deploymentEnvironment()).toThrow();
  });
  it('requires an explicit valid environment', () => {
    vi.stubEnv('APP_ENV', 'stagin');
    expect(() => deploymentEnvironment()).toThrow();
  });
  it.each(['local', 'staging'])('rejects Vercel Production for %s', (environment) => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('APP_ENV', environment);
    expect(() => deploymentEnvironment()).toThrow('Refusing a non-production application');
  });
});
describe('technical authentication boundary', () => {
  it.each([null, 'https://evil.example', 'https://staging.example.evil.test'])(
    'rejects foreign origin %s',
    (origin) => {
      expect(() => assertSameOrigin(origin, 'https://staging.example')).toThrow();
    },
  );
  it('accepts only the configured origin', () => {
    expect(() =>
      assertSameOrigin('https://staging.example', 'https://staging.example'),
    ).not.toThrow();
  });
  it('validates before provider calls', async () => {
    const signIn = vi.fn();
    await expect(
      smokeSignIn({ signIn, signOut: async () => true }, { email: 'invalid', password: '' }),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(signIn).not.toHaveBeenCalled();
  });
  it('does not accept client role fields', async () => {
    const signIn = vi.fn();
    await expect(
      smokeSignIn(
        { signIn, signOut: async () => true },
        { email: 'fixture@example.test', password: 'synthetic-fixture-only', role: 'SUPER_ADMIN' },
      ),
    ).rejects.toMatchObject({ code: 'validation' });
    expect(signIn).not.toHaveBeenCalled();
  });
  it('fails closed for invalid provider credentials', async () => {
    await expect(
      smokeSignIn(
        { signIn: async () => false, signOut: async () => true },
        { email: 'fixture@example.test', password: 'synthetic-fixture-only' },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});
