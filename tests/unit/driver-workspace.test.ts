import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { DriverState } from '@/components/driver/state';
const route = vi.hoisted(() => ({ path: '/en/driver' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
vi.mock('@/components/shell/theme-control', () => ({ ThemeControl: () => null }));
import { DriverFrame } from '@/components/driver/frame';
for (const locale of ['ar', 'en'] as const) {
  it(locale + ' Driver frame uses one official brand and preserves its child controls', () => {
    route.path = '/' + locale + '/driver/trips/test';
    const html = renderToStaticMarkup(
      createElement(
        DriverFrame,
        {
          locale,
          themeMode: 'system',
        },
        createElement('button', null, 'real command'),
      ),
    );
    expect(html).toContain('data-design-family="driver"');
    expect(html).toContain('dir="' + (locale === 'ar' ? 'rtl' : 'ltr') + '"');
    expect(html.match(/class="brand-mark"/g)).toHaveLength(1);
    expect(html).toContain('href="#driver-content"');
    expect(html).toContain('real command');
    expect(html).not.toMatch(/dx-labbar|localStorage|geolocation|latitude|longitude/);
  });
  it(locale + ' Driver login retains the independent Auth layout', () => {
    route.path = '/' + locale + '/driver/login';
    const html = renderToStaticMarkup(
      createElement(
        DriverFrame,
        {
          locale,
          themeMode: 'light',
        },
        createElement('form', { 'aria-label': 'real login' }),
      ),
    );
    expect(html).toBe('<form aria-label="real login"></form>');
  });
}
it('Driver state safely escapes content and separates loading/error semantics', () => {
  const pending = renderToStaticMarkup(
    createElement(DriverState, { state: 'loading', title: 'Loading <private>' }),
  );
  expect(pending).toContain('role="status"');
  expect(pending).toContain('aria-busy="true"');
  expect(pending).toContain('&lt;private&gt;');
  const error = renderToStaticMarkup(
    createElement(DriverState, { state: 'error', title: 'Unavailable' }),
  );
  expect(error).toContain('role="alert"');
  expect(error).toContain('aria-busy="false"');
  expect(error).not.toContain('Loading');
});
