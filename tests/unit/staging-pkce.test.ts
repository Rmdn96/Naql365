import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ origin: 'https://staging.example' }),
}));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: provider }),
}));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: () => ({}) }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('https://staging.example'),
}));
import { smokePkceLogin } from '@/app/auth/actions';

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('STAGING_AUTH_SMOKE_ENABLED', 'true');
  vi.clearAllMocks();
  provider.signInWithOtp.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

it.each(['ar', 'en'])(
  'starts a server-owned %s callback without creating users',
  async (locale) => {
    const form = new FormData();
    form.set('email', 'controlled@example.test');
    form.set('redirect', 'https://evil.example');
    await expect(smokePkceLogin(locale, { submitted: false }, form)).resolves.toEqual({
      submitted: true,
    });
    expect(provider.signInWithOtp).toHaveBeenCalledWith({
      email: 'controlled@example.test',
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `https://staging.example/auth/callback?locale=${locale}`,
      },
    });
  },
);
it('refuses invalid inputs before contacting the provider', async () => {
  const form = new FormData();
  form.set('email', 'invalid');
  expect((await smokePkceLogin('ar', { submitted: false }, form)).submitted).toBe(false);
  expect(provider.signInWithOtp).not.toHaveBeenCalled();
});
it('never initiates staging links in Production', async () => {
  vi.stubEnv('APP_ENV', 'production');
  const form = new FormData();
  form.set('email', 'controlled@example.test');
  expect((await smokePkceLogin('ar', { submitted: false }, form)).submitted).toBe(false);
  expect(provider.signInWithOtp).not.toHaveBeenCalled();
});
it('does not reveal whether an account exists', async () => {
  provider.signInWithOtp.mockResolvedValue({ error: { message: 'Unknown account' } });
  const form = new FormData();
  form.set('email', 'controlled@example.test');
  expect(await smokePkceLogin('ar', { submitted: false }, form)).toEqual({ submitted: true });
});
