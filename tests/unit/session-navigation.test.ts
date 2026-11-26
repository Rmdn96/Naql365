import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ destination: vi.fn(), env: vi.fn() }));
vi.mock('@/infrastructure/identity/login-destination', () => ({
  loginDestination: mocks.destination,
}));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: mocks.env }));
import { Header } from '@/components/shell/public-shell';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
vi.mock('@/components/shell/locale-link', () => ({ LocaleLink: () => null }));
vi.mock('@/components/shell/theme-control', () => ({ ThemeControl: () => null }));
vi.mock('@/components/store/cart-link', () => ({ CartLink: () => null }));
import Login from '@/app/[locale]/(public)/login/page';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.mockReturnValue({ configured: true });
});
it.each(['ar', 'en'] as const)('public header has no identity controls in %s', (locale) => {
  const html = renderToStaticMarkup(createElement(Header, { locale, themeMode: 'light' }));
  expect(html).not.toMatch(/href="[^"]*\/(?:login|register|account|portal)"/);
  expect(mocks.destination).not.toHaveBeenCalled();
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
