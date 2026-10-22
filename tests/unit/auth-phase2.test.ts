import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthChrome, PublicChrome, isAuthPath } from '@/components/shell/public-chrome';
import { AuthToolbar } from '@/components/auth/auth-toolbar';
import { AuthExperience } from '@/components/auth/auth-experience';

const publicProps = { children: 'public navigation' };
const authProps = { children: 'auth preferences' };
const state = vi.hoisted(() => ({ path: '/ar/login' }));
vi.mock('next/navigation', () => ({
  usePathname: () => state.path,
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('independent Auth presentation without authorization changes', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale} isolates only exact authentication routes`, () => {
      for (const route of [
        'login',
        'register',
        'recover',
        'password',
        'auth-complete',
        'driver/login',
      ]) {
        state.path = `/${locale}/${route}`;
        expect(isAuthPath(state.path)).toBe(true);
        expect(renderToStaticMarkup(createElement(PublicChrome, publicProps))).toBe('');
        expect(renderToStaticMarkup(createElement(AuthChrome, authProps))).toBe('auth preferences');
      }
      for (const route of [
        'request',
        'account/requests',
        'driver',
        'login/unsafe',
        'portal/users',
      ]) {
        state.path = `/${locale}/${route}`;
        expect(isAuthPath(state.path)).toBe(false);
        expect(renderToStaticMarkup(createElement(AuthChrome, authProps))).toBe('');
      }
    });
    it(`${locale} keeps locale switching on the path, theme and market controls without a role selector`, () => {
      state.path = `/${locale}/recover`;
      const html = renderToStaticMarkup(
        createElement(AuthToolbar, { locale, country: 'EG', themeMode: 'dark' }),
      );
      expect(html).toContain(`href="/${locale === 'ar' ? 'en' : 'ar'}/recover"`);
      expect(html).toContain('value="dark" selected=""');
      expect(html).toContain('value="EG" selected=""');
      expect(html).toContain('id="auth-market"');
      expect(html).not.toMatch(/role-switch|SUPER_ADMIN|<form|token=/);
    });
    it(`${locale} retains real feedback and loading semantics inside the original panel composition`, () => {
      const props = {
        locale,
        title: 'Confirmation',
        intro: 'Follow the secure link',
        children: createElement('div', { role: 'status', 'aria-live': 'polite' }, 'Pending'),
      };
      const html = renderToStaticMarkup(createElement(AuthExperience, props));
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('M18 126H100V38H222V100H400');
      expect(html).toContain('data-design-family="auth"');
      expect(html).not.toMatch(/preview-screen|preview-state|safeDemoResult|<form/);
    });
  }
});
