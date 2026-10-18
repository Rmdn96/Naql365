import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync } from 'node:fs';
import ErrorState from '../../src/app/[locale]/(portal)/portal/error';
import LoadingState from '../../src/app/[locale]/(portal)/portal/loading';
const state = vi.hoisted(() => ({ pathname: '/ar/portal' }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
const routes = [
  '/portal',
  '/portal/quotes',
  '/portal/quotes/synthetic',
  '/portal/operations',
  '/portal/operations/jobs/synthetic',
  '/portal/operations/trips/synthetic',
  '/portal/finance',
  '/portal/finance/synthetic',
  '/portal/finance/banks',
  '/portal/support',
];
it('all implemented portal routes share exactly the same localized error/retry presentation', () => {
  const errorFiles = readdirSync('src/app/[locale]/(portal)/portal', { recursive: true }).filter(
    (p) => String(p).endsWith('error.tsx'),
  );
  expect(errorFiles).toEqual(['error.tsx']);
  for (const locale of ['ar', 'en']) {
    const rendered = routes.map((route) => {
      state.pathname = '/' + locale + route;
      return renderToStaticMarkup(createElement(ErrorState, { reset: () => undefined }));
    });
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toContain('role="alert"');
    expect(rendered[0]).toContain('<button');
    expect(rendered[0]).not.toContain('synthetic');
  }
});
it('all portal routes inherit the implemented non-interactive busy state without route-specific overrides', () => {
  const loadingFiles = readdirSync('src/app/[locale]/(portal)/portal', { recursive: true }).filter(
    (p) => String(p).endsWith('loading.tsx'),
  );
  expect(loadingFiles).toEqual(['loading.tsx']);
  const markup = renderToStaticMarkup(createElement(LoadingState));
  expect(markup).toContain('aria-busy="true"');
  expect(markup).toContain('role="status"');
  expect(markup).toContain('جارٍ تحميل مساحة العمل');
  expect(markup).toContain('Loading workspace');
  expect(markup).not.toMatch(/<button|<input|synthetic|token/);
});
