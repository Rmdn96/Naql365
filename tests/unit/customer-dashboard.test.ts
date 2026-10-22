import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { CustomerDashboard } from '@/components/customer/dashboard';
import { customerFixture } from '../customer-ui/fixture';
import { customerDictionary } from '@/i18n/customer';

for (const locale of ['ar', 'en'] as const) {
  test(`${locale} dashboard keeps genuine localized request status distinct from route facts`, () => {
    const f = customerFixture();
    const html = renderToStaticMarkup(
      createElement(CustomerDashboard, {
        locale,
        saved: false,
        onboarding: false,
        permitted: true,
        requests: f.requests,
        actionQuotes: [],
        storeRecords: 'Store history',
        profileForm: 'Profile control',
        startRequest: 'Booking control',
        logout: 'Logout control',
      }),
    );
    expect(html).toContain(customerDictionary(locale).SUBMITTED);
    expect(html).toContain('Cairo — TEST');
    expect(html).toContain('Store history');
    expect(html).toContain('id="customer-profile"');
    expect(html).not.toContain('SUBMITTED');
    expect(html).not.toMatch(/supplierEntitlement|supplier_cost|net profit/);
  });
  test(`${locale} unavailable membership cannot render customer histories, profile or booking slots`, () => {
    const f = customerFixture();
    const html = renderToStaticMarkup(
      createElement(CustomerDashboard, {
        locale,
        saved: false,
        onboarding: false,
        permitted: false,
        requests: f.requests,
        actionQuotes: [{ id: 'test', reference: 'PRIVATE-TEST-Q' }],
        storeRecords: 'PRIVATE-TEST-STORE',
        profileForm: 'PRIVATE-TEST-PROFILE',
        startRequest: 'PRIVATE-TEST-BOOKING',
        logout: 'Logout control',
      }),
    );
    expect(html).toContain(customerDictionary(locale).forbiddenBody);
    expect(html).toContain('Logout control');
    expect(html).not.toContain('PRIVATE-TEST');
    expect(html).not.toContain('TEST-R');
    expect(html).not.toContain('N365-261022-900001');
  });
}
