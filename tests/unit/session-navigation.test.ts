import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ destination: vi.fn(), env: vi.fn() }));
vi.mock('@/infrastructure/identity/login-destination', () => ({
  loginDestination: mocks.destination,
}));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: mocks.env }));
import { IdentityLink } from '@/components/shell/public-shell';
import Login from '@/app/[locale]/(public)/login/page';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.mockReturnValue({ configured: true });
});
it.each(['ar', 'en'] as const)(
  'renders exactly the authorized role destination in %s',
  async (locale) => {
    for (const role of ['account', 'portal', 'driver']) {
      mocks.destination.mockResolvedValue(role);
      const link = await IdentityLink({ locale });
      expect(link.props.href).toBe(`/${locale}/${role}`);
      expect(link.props.children).not.toMatch(/Sign In|تسجيل الدخول/);
    }
    mocks.destination.mockResolvedValue('unauthenticated');
    const link = await IdentityLink({ locale });
    expect(link.props.href).toBe(`/${locale}/login`);
    expect(link.props.children).toMatch(/Sign In|تسجيل الدخول/);
  },
);
it('does not share a previous user role with the next render', async () => {
  mocks.destination.mockResolvedValueOnce('portal').mockResolvedValueOnce('unauthenticated');
  expect((await IdentityLink({ locale: 'ar' })).props.href).toBe('/ar/portal');
  expect((await IdentityLink({ locale: 'ar' })).props.href).toBe('/ar/login');
});
it.each(['account', 'portal', 'driver', 'membership', 'provisioning', 'server'])(
  'authenticated login-page request resolves %s before returning a form',
  async (destination) => {
    mocks.destination.mockResolvedValue(destination);
    const route = ['account', 'portal', 'driver'].includes(destination)
      ? destination
      : 'auth-complete';
    await expect(
      Login({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ notice: 'confirmation-link' }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(`/en/${route}`),
    });
  },
);
it('only an unauthenticated request gets the login form', async () => {
  mocks.destination.mockResolvedValue('unauthenticated');
  expect(
    await Login({ params: Promise.resolve({ locale: 'ar' }), searchParams: Promise.resolve({}) }),
  ).toBeTruthy();
});
