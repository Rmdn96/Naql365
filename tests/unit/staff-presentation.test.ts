import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { StaffState, StaffTable } from '@/components/staff/presentation';

it.each(['ar', 'en'] as const)(
  'keeps loading, errors and unavailable data distinguishable in %s',
  (locale) => {
    const title = locale === 'ar' ? 'مساحة العمل' : 'Workspace';
    const render = (state: Parameters<typeof StaffState>[0]['state']) =>
      renderToStaticMarkup(
        createElement(StaffState, { state, title }, createElement('p', null, 'No confirmed data')),
      );
    expect(render('loading')).toContain('role="status" aria-busy="true"');
    expect(render('loading')).toContain('sx-skeleton');
    expect(render('error')).toContain('role="alert"');
    expect(render('unavailable')).toContain('role="alert"');
    expect(render('empty')).not.toContain('aria-busy');
    expect(render('empty')).toContain('No confirmed data');
    expect(render('unavailable')).not.toMatch(/<form|<input|\/api\/|supplier|entitlement/);
  },
);

it('preserves accessible queue columns, authorized links and escaped record content', () => {
  const markup = renderToStaticMarkup(
    createElement(StaffTable, {
      caption: 'Authorized queue',
      columns: ['Reference', 'Next action'],
      rows: [
        [
          '<private script>',
          createElement('a', { href: '/en/portal/quotes/authorized' }, 'Review'),
        ],
      ],
    }),
  );
  expect(markup).toContain('role="region" aria-label="Authorized queue" tabindex="0"');
  expect(markup.match(/scope="col"/g)).toHaveLength(2);
  expect(markup).toContain('&lt;private script&gt;');
  expect(markup).toContain('href="/en/portal/quotes/authorized"');
  expect(markup).not.toContain('<private script>');
});
