import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  origin: 'https://staging.example',
  signUp: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: mocks.origin }) }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('https://staging.example'),
}));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: mocks, rpc: mocks.rpc }),
}));
import { customerAuth, customerProfile, customerLogout } from '@/app/auth/customer-actions';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.origin = 'https://staging.example';
  mocks.signUp.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
});
it('registration never forwards role metadata or a browser redirect', async () => {
  const f = new FormData();
  f.set('email', 'fixture@example.test');
  f.set('password', 'Long-fixture-password');
  f.set('role', 'SUPER_ADMIN');
  f.set('redirect', 'https://evil.example');
  await customerAuth('ar', 'register', { status: 'idle' }, f);
  expect(mocks.signUp).toHaveBeenCalledWith({
    email: 'fixture@example.test',
    password: 'Long-fixture-password',
    options: { emailRedirectTo: 'https://staging.example/auth/callback?locale=ar' },
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects cross-origin registration before provider interaction', async () => {
  mocks.origin = 'https://evil.example';
  expect(await customerAuth('ar', 'register', { status: 'idle' }, new FormData())).toEqual({
    status: 'error',
    code: 'server',
  });
  expect(mocks.signUp).not.toHaveBeenCalled();
});

it.each([
  ['invalid_credentials', 'credentials'],
  ['email_not_confirmed', 'confirmation'],
  ['unexpected_failure', 'server'],
])('safely classifies password login failure %s', async (providerCode, visibleCode) => {
  mocks.signInWithPassword.mockResolvedValue({ error: { code: providerCode } });
  const form = new FormData();
  form.set('email', 'fixture@example.test');
  // Login accepts existing provider credentials independently of new-password policy.
  form.set('password', 'short');
  expect(await customerAuth('en', 'login', { status: 'idle' }, form)).toEqual({
    status: 'error',
    code: visibleCode,
  });
});
it('keeps existing-account signup indistinguishable but exposes recoverable service failure', async () => {
  mocks.signUp.mockResolvedValue({ error: { code: 'user_already_exists' } });
  const f = new FormData();
  f.set('email', 'fixture@example.test');
  f.set('password', 'Long-fixture-password');
  expect(await customerAuth('en', 'register', { status: 'idle' }, f)).toEqual({ status: 'sent' });
  mocks.signUp.mockResolvedValue({ error: { code: 'unexpected_failure' } });
  expect(await customerAuth('en', 'register', { status: 'idle' }, f)).toEqual({
    status: 'error',
    code: 'server',
  });
});
it('requires provider-verified identity before onboarding', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const f = new FormData();
  f.set('name', 'Fixture');
  f.set('phone', '+966500000001');
  f.set('locale', 'ar');
  expect(await customerProfile('ar', { status: 'idle' }, f)).toEqual({ status: 'error' });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('constructs a locale-safe recovery callback', async () => {
  const f = new FormData();
  f.set('email', 'fixture@example.test');
  await customerAuth('en', 'recover', { status: 'idle' }, f);
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('fixture@example.test', {
    redirectTo: 'https://staging.example/auth/callback?locale=en&next=/en/password',
  });
});

it('returns field-level validation without calling the database', async () => {
  const f = new FormData();
  f.set('name', 'Fixture');
  f.set('phone', 'invalid');
  f.set('locale', 'en');
  expect(await customerProfile('en', { status: 'idle' }, f)).toEqual({
    status: 'error',
    code: 'validation',
    fields: ['phone'],
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('normal logout terminates the local session without any staging flag', async () => {
  vi.stubEnv('STAGING_AUTH_SMOKE_ENABLED', 'false');
  mocks.signOut.mockResolvedValue({ error: null });
  await expect(customerLogout('ar')).rejects.toMatchObject({
    digest: expect.stringContaining('/ar/login'),
  });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  vi.unstubAllEnvs();
});
it('logout refuses cross-origin and does not claim success after provider failure', async () => {
  mocks.origin = 'https://evil.example';
  await expect(customerLogout('en')).rejects.toThrow();
  expect(mocks.signOut).not.toHaveBeenCalled();
  mocks.origin = 'https://staging.example';
  mocks.signOut.mockResolvedValue({ error: { message: 'Unavailable' } });
  await expect(customerLogout('en')).rejects.toThrow('Sign-out failed');
});
