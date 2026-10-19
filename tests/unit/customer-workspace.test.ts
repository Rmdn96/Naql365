import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { CustomerWorkspaceNav } from '../../src/components/ui/customer-workspace';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} Customer navigation contains only existing local Customer destinations`, () => {
    const html = renderToStaticMarkup(
      createElement(CustomerWorkspaceNav, { locale, current: 'quotes' }),
    );
    expect(html).toContain(`href="/${locale}/account"`);
    expect(html).toContain(`href="/${locale}/account/requests"`);
    const currentLink = html.match(/<a\b[^>]*aria-current="page"[^>]*>/)?.[0];
    expect(currentLink).toContain(`href="/${locale}/account/quotes"`);
    expect(html).toContain(`href="/${locale}/store/orders"`);
    expect(html).toContain(`href="/${locale}/store/cart"`);
    expect(html).not.toMatch(/\/portal|\/driver|capability|token=/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
}
