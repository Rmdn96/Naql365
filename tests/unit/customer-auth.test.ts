import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  origin: 'https://staging.example',
  signUp: vi.fn(),
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
import { customerAuth, customerProfile } from '@/app/auth/customer-actions';
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
  });
  expect(mocks.signUp).not.toHaveBeenCalled();
});
it('uses indistinguishable signup result for existing or unavailable accounts', async () => {
  mocks.signUp.mockResolvedValue({ error: { message: 'private provider detail' } });
  const f = new FormData();
  f.set('email', 'fixture@example.test');
  f.set('password', 'Long-fixture-password');
  expect(await customerAuth('en', 'register', { status: 'idle' }, f)).toEqual({ status: 'sent' });
});
it('requires provider-verified identity before onboarding', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const f = new FormData();
  f.set('name', 'Fixture');
  f.set('phone', '0501234567');
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
