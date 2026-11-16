import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  configured: true,
  writable: vi.fn(),
}));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('https://naql365-launch.vercel.app'),
}));
vi.mock('@/infrastructure/config/public-env', () => ({
  getPublicEnv: () => (auth.configured ? {} : undefined),
}));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async (writable: boolean) => {
    auth.writable(writable);
    return { auth };
  },
}));
import { GET } from '@/app/auth/callback/route';
beforeEach(() => {
  vi.clearAllMocks();
  auth.configured = true;
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
});
for (const locale of ['ar', 'en']) {
  it(`${locale} verifies an invitation server-side and opens password setup at the trusted origin`, async () => {
    const response = await GET(
      new NextRequest(
        `https://untrusted.example/auth/callback?locale=${locale}&token_hash=synthetic-invite&type=invite&next=https://untrusted.example`,
      ),
    );
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: 'synthetic-invite',
      type: 'invite',
    });
    expect(auth.writable).toHaveBeenCalledExactlyOnceWith(true);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      `https://naql365-launch.vercel.app/${locale}/password`,
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it(`${locale} rejected or consumed invitation fails closed without reflecting credentials`, async () => {
    auth.verifyOtp.mockResolvedValue({
      error: { message: 'synthetic private diagnostic' },
    });
    const response = await GET(
      new NextRequest(
        `https://naql365-launch.vercel.app/auth/callback?locale=${locale}&token_hash=synthetic-invite&type=invite`,
      ),
    );
    expect(response.headers.get('location')).toBe(
      `https://naql365-launch.vercel.app/${locale}/login?notice=confirmation-link`,
    );
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
}
for (const query of [
  'token_hash=synthetic&type=recovery',
  'token_hash=synthetic&type=email',
  'token_hash=synthetic',
  'token_hash=&type=invite',
  'token_hash=synthetic&type=invite&code=synthetic',
  'token_hash=synthetic&type=invite&code=',
  'token_hash=synthetic&token_hash=another&type=invite',
  'token_hash=synthetic&type=invite&type=recovery',
  `token_hash=${'x'.repeat(2049)}&type=invite`,
]) {
  it(`rejects unsupported or ambiguous token input: ${query.slice(0, 90)}`, async () => {
    const response = await GET(
      new NextRequest(`https://naql365-launch.vercel.app/auth/callback?${query}`),
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'https://naql365-launch.vercel.app/ar/login?notice=confirmation-link',
    );
  });
}
it('does not verify invitations without a configured backend', async () => {
  auth.configured = false;
  await GET(
    new NextRequest(
      'https://naql365-launch.vercel.app/auth/callback?token_hash=synthetic&type=invite',
    ),
  );
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(auth.writable).not.toHaveBeenCalled();
});
