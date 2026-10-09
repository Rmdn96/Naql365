import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('https://staging.example'),
}));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: () => ({}) }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));
import { GET } from '@/app/auth/callback/route';
beforeEach(() => {
  auth.exchangeCodeForSession.mockReset();
});
for (const locale of ['ar', 'en']) {
  for (const kind of ['missing', 'rejected']) {
    it(`${locale} ${kind} email callback explains failure without reflecting a code`, async () => {
      auth.exchangeCodeForSession.mockResolvedValue({ error: { message: 'not disclosed' } });
      const r = await GET(
        new NextRequest(
          `https://staging.example/auth/callback?locale=${locale}${kind === 'rejected' ? '&code=synthetic-invalid-code' : ''}&next=https://untrusted.example`,
        ),
      );
      expect(r.headers.get('location')).toBe(
        `https://staging.example/${locale}/login?notice=confirmation-link`,
      );
      expect(r.headers.get('cache-control')).toBe('private, no-store');
      expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(kind === 'rejected' ? 1 : 0);
    });
  }
  it(`${locale} successful confirmation retains authoritative bootstrap destination`, async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const r = await GET(
      new NextRequest(
        `https://staging.example/auth/callback?locale=${locale}&code=synthetic&next=https://untrusted.example`,
      ),
    );
    expect(r.headers.get('location')).toBe(`https://staging.example/${locale}/auth-complete`);
  });
  it(`${locale} successful recovery retains exact allowlisted destination`, async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const r = await GET(
      new NextRequest(
        `https://staging.example/auth/callback?locale=${locale}&code=synthetic&next=/${locale}/password`,
      ),
    );
    expect(r.headers.get('location')).toBe(`https://staging.example/${locale}/password`);
  });
}
