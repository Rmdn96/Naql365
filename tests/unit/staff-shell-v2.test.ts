import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { StaffShell } from '@/components/shell/staff-shell';
const renderShell = (props: Parameters<typeof StaffShell>[0]) =>
  renderToStaticMarkup(createElement(StaffShell, props));
const location = vi.hoisted(() => ({ path: '/ar/portal/finance/banks' }));
vi.mock('next/navigation', () => ({
  usePathname: () => location.path,
  useRouter: () => ({ refresh: vi.fn() }),
}));

it.each(['ar', 'en'] as const)(
  'renders only caller-authorized modules with specific current-page semantics in %s',
  (locale) => {
    location.path = `/${locale}/portal/finance/banks`;
    const root = `/${locale}/portal`,
      markup = renderShell({
        locale,
        country: 'SA',
        themeMode: 'dark',
        logout: createElement('button', null, 'Sign out'),
        links: [
          { href: root, label: 'Dashboard', symbol: 'D' },
          { href: root + '/finance', label: 'Finance', symbol: 'F' },
          { href: root + '/finance/banks', label: 'Banks', symbol: 'B' },
        ],
        children: createElement('h1', null, 'Authorized workspace'),
      });
    expect(markup).not.toContain('/portal/quotes');
    expect(markup).not.toContain('/portal/operations');
    expect(markup).not.toContain('/portal/support');
    // Desktop and mobile render the same permission-filtered navigation.
    expect(markup.match(/aria-current="page"/g)).toHaveLength(2);
    expect(
      (markup.match(/<a\b[^>]*>/g) ?? []).filter(
        (tag) =>
          tag.includes(`href="${root}/finance/banks"`) && tag.includes('aria-current="page"'),
      ),
    ).toHaveLength(2);
    expect(markup).toContain('value="dark" selected=""');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('href="#staff-content"');
    expect(markup).not.toMatch(/pricing.calculate|finance.accounts.manage|@/);
  },
);
it('does not invent additional staff modules from a sparse permitted link set', () => {
  location.path = '/en/portal/support';
  const markup = renderShell({
    locale: 'en',
    country: 'EG',
    themeMode: 'system',
    logout: null,
    links: [{ href: '/en/portal/support', label: 'Support', symbol: 'S' }],
    children: null,
  });
  expect(markup).not.toMatch(/\/portal\/(finance|quotes|operations)/);
  expect(markup).toContain('value="system" selected=""');
  expect(markup).toContain('value="EG" selected=""');
});
