import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Brand, BrandMark } from '@/components/design-system/brand';
import { DesignFoundation } from '@/components/design-system/foundation';
import { Brand as CommerceBrand } from '@/components/lovable/brand';
import { BrandLink } from '@/components/shell/brand-link';
import { chooseTheme, readTheme, subscribeTheme } from '@/components/design-system/theme';
import { StaffShell } from '@/components/shell/staff-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/portal',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

it('retains the exact approved logo geometry in every layout size and locale', () => {
  const mark = renderToStaticMarkup(createElement(BrandMark));
  expect(mark).toContain('viewBox="0 0 40 40"');
  expect(mark).toContain('d="M4 30V10h8l16 20h8V10h-8v13L17 10H4m0 20h8V17"');
  expect(mark).toContain('d="M22 35h14"');
  expect(mark).toContain('stroke="currentColor"');
  expect(mark).toContain('aria-hidden="true"');
  for (const locale of ['ar', 'en'] as const)
    for (const size of ['public', 'auth', 'customer', 'staff', 'driver', 'mobile'] as const) {
      const html = renderToStaticMarkup(
        createElement(Brand, { locale, size, href: `/${locale}`, label: 'Home' }),
      );
      expect(html).toContain(mark);
      expect(html).toContain(`href="/${locale}"`);
      expect(html).toContain('aria-label="Home"');
      expect(html).toContain(locale === 'ar' ? 'نقل ' : 'Naql');
      expect(html).toContain('<em>365</em>');
      expect(html).not.toMatch(/brand-symbol|<i|onClick|role="button"/);
    }
});

it('keeps Commerce logo markup while legacy wrappers use the same official mark', () => {
  const mark = renderToStaticMarkup(createElement(BrandMark));
  const source = renderToStaticMarkup(createElement(CommerceBrand, { locale: 'en' }));
  const legacy = renderToStaticMarkup(createElement(BrandLink, { href: '/ar', label: 'الرئيسية' }));
  expect(source).toContain('class="brand"');
  expect(source).toContain('class="brand-word"');
  expect(source).toContain('class="brand-sub"');
  expect(source).toContain(mark);
  expect(legacy).toContain(mark);
  expect(legacy).toContain('aria-label="الرئيسية"');
  const drawer = renderToStaticMarkup(createElement(Brand, { locale: 'en', size: 'mobile' }));
  expect(drawer).toContain(mark);
  expect(drawer).toContain('role="img"');
  expect(drawer).not.toMatch(/<a|href=|tabIndex=/);
});

it('visual layout families preserve children and semantics without introducing authority', () => {
  for (const family of ['public', 'auth', 'customer', 'staff', 'driver'] as const) {
    const html = renderToStaticMarkup(
      createElement(
        DesignFoundation,
        { family, className: 'existing-layout', lang: 'ar', dir: 'rtl' },
        createElement('button', { disabled: true }, 'Existing command'),
      ),
    );
    expect(html).toContain(`data-design-family="${family}"`);
    expect(html).toContain('class="existing-layout"');
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('<button disabled="">Existing command</button>');
    expect(html).not.toMatch(/data-permission|data-role|onClick/);
  }
});

it.each(['ar', 'en'] as const)(
  'shares the official Staff logo without adding module links or a mobile focus target (%s)',
  (locale) => {
    const props = {
      locale,
      country: 'EG' as const,
      themeMode: 'system' as const,
      links: [{ href: `/${locale}/portal/quotes`, label: 'Authorized quotes', symbol: '▤' }],
      logout: createElement('button', null, 'Existing logout'),
      children: createElement('p', null, 'Existing workspace'),
    };
    const html = renderToStaticMarkup(createElement(StaffShell, props));
    expect(html.match(/viewBox="0 0 40 40"/g)).toHaveLength(2);
    expect(html).toContain('data-design-family="staff"');
    expect(html).toContain('Authorized quotes');
    expect(html).toContain('Existing logout');
    expect(html).toContain('Existing workspace');
    expect(html).not.toMatch(/\/portal\/finance|\/portal\/store/);
    const drawerHeading = html.split('class="staff-drawer-heading"')[1]!.split('</button>')[0]!;
    expect(drawerHeading).toContain('role="img"');
    expect(drawerHeading).not.toContain('href=');
    expect(drawerHeading).toContain('<button');
  },
);

it.each(['light', 'dark', 'system'] as const)(
  'shares %s preference with persistent cookie and subscribable cleanup, without network access',
  (mode) => {
    const document = { documentElement: { dataset: { theme: 'unknown' } }, cookie: '' };
    const window = new EventTarget();
    const listener = vi.fn();
    vi.stubGlobal('document', document);
    vi.stubGlobal('window', window);
    vi.stubGlobal('location', { protocol: 'https:' });
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    expect(readTheme()).toBe('system');
    const unsubscribe = subscribeTheme(listener);
    chooseTheme(mode);
    expect(readTheme()).toBe(mode);
    expect(document.cookie).toBe(
      `naql365_theme=${mode}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    chooseTheme(mode);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  },
);

it('uses the same local preference without an invalid Secure cookie over loopback HTTP', () => {
  const document = { documentElement: { dataset: {} }, cookie: '' };
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('location', { protocol: 'http:' });
  chooseTheme('light');
  expect(document.cookie).toBe('naql365_theme=light; Path=/; Max-Age=31536000; SameSite=Lax');
});

it('uses the approved palette and accessible action color through scoped compatibility aliases', () => {
  const foundation = readFileSync('src/styles/foundation.css', 'utf8');
  const commerce = readFileSync('src/styles/lovable.css', 'utf8');
  expect(foundation).toContain('--naql-color-brand: oklch(0.63 0.21 261)');
  expect(foundation).toContain('--naql-color-brand: oklch(0.52 0.21 262)');
  expect(foundation).toContain('--naql-color-action: oklch(0.52 0.21 262)');
  expect(foundation).toContain("html[data-theme='light']");
  expect(foundation).toContain("html[data-theme='system']");
  expect(foundation).toContain('prefers-color-scheme: light');
  expect(commerce).toContain('--background: var(--naql-color-background)');
  expect(commerce).toContain('--primary: var(--naql-color-action)');
  expect(foundation).not.toMatch(/body\s*\{|button\s*\{|input\s*\{/);
});
