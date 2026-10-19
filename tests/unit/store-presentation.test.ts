import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckoutForm, CartForm } from '@/components/store/controls';
import type { StoreCart } from '@/domain/store/model';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const cart: StoreCart = {
  revision: 1,
  checkedOutOrderId: null,
  items: [
    {
      listingId: '98000000-0000-4000-8000-000000000003',
      revision: 2,
      savedRevision: 2,
      quantity: 2,
      content: {
        title_ar: 'منتج تجريبي عربي طويل للتغليف والنقل',
        title_en: 'Synthetic packing product',
      },
      amountMinor: 1000,
      available: true,
      slug: 'synthetic',
    },
  ],
  contracts: [],
  destinations: [],
};
it.each(['ar', 'en'] as const)(
  'keeps %s checkout closed without approved commercial configuration',
  (locale) => {
    const html = renderToStaticMarkup(createElement(CheckoutForm, { cart, locale }));
    expect(html).toContain('disabled');
    expect(html).not.toContain('supplierEntitlement');
    expect(html).not.toContain('unit_cost');
    expect(html).toContain('name="phone"');
    expect(html).toContain('name="line"');
  },
);
it('does not enable checkout after an already-consumed cart revision', () => {
  const full: StoreCart = {
    ...cart,
    checkedOutOrderId: '99000000-0000-4000-8000-000000000004',
    contracts: [
      {
        id: '99000000-0000-4000-8000-000000000001',
        revision: 1,
        regions: ['SYNTHETIC'],
        deliveryMinor: 200,
        taxMode: 'ADDITIVE',
        taxBps: 0,
        taxDelivery: false,
        destinationIds: [],
        codRelease: true,
        termsAr: 'تجريبي',
        termsEn: 'Synthetic',
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(CheckoutForm, { cart: full, locale: 'en' }));
  expect(html).toMatch(/<button[^>]+disabled/);
});
it('presents actual quantities and warns when a saved product version is stale', () => {
  const html = renderToStaticMarkup(
    createElement(CartForm, {
      cart: { ...cart, items: cart.items.map((i) => ({ ...i, revision: 3 })) },
      locale: 'en',
    }),
  );
  expect(html).toContain('product changed');
  expect(html).toContain('max="999"');
  expect(html).not.toMatch(/\d+ in stock|free delivery|ETA/);
});
