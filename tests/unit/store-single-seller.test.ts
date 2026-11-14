import { expect, it, vi } from 'vitest';
import { renderToReadableStream, renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { storeLabel, storeText } from '@/i18n/store';
import { commerceContent } from '@/components/lovable/commerce-content';
import { commerceExtra } from '@/components/lovable/commerce-extra-content';
import type { StoreOrder } from '@/domain/store/model';
const mocks = vi.hoisted(() => ({ read: vi.fn(), shop: vi.fn(), categories: vi.fn() }));
vi.mock('@/infrastructure/store/service', () => ({
  storeRead: mocks.read,
  storeShop: mocks.shop,
  storeCategories: mocks.categories,
}));
vi.mock('@/infrastructure/store/access', () => ({
  storeStaffModules: async () => ({
    orders: true,
    finance: true,
    reconciliation: true,
    catalog: true,
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
import { StoreExperience } from '@/components/store/experience';
import { StoreIntroduction } from '@/components/store/introduction';
import { CheckoutForm } from '@/components/store/controls';
const id = '99000000-0000-4000-8000-000000000010';
const order: StoreOrder = {
  id,
  reference: 'SYNTHETIC-ORDER',
  revision: 1,
  orderState: 'ACCEPTED',
  fulfillmentState: 'SENT_TO_SUPPLIER',
  createdAt: '2026-01-01T00:00:00Z',
  address: { name: 'Synthetic', phone: 'Synthetic', region: 'Synthetic', line: 'Synthetic' },
  subtotalMinor: 1000,
  deliveryMinor: 200,
  taxMinor: 0,
  totalMinor: 1200,
  currency: 'EGP',
  termsAr: 'شروط تجريبية',
  termsEn: 'Synthetic terms',
  supplierEntitlementMinor: 700,
  items: [],
  payment: { method: 'CASH', status: 'CASH_DUE', collector: 'SUPPLIER', destination: null },
  proofs: [],
  events: [
    { action: 'send', at: '2026-01-01T00:00:00Z' },
    { action: 'recover', at: '2026-01-01T00:00:00Z' },
  ],
  entries: [
    { id, kind: 'SUPPLIER_PAYABLE', holder: 'SUPPLIER', amountMinor: 700, reversesId: null },
  ],
  moneyOperations: [
    {
      id,
      kind: 'SETTLEMENT',
      state: 'PENDING',
      amountMinor: 700,
      reference: 'PRIVATE-FINANCE-REFERENCE',
    },
  ],
  permissions: {},
};
it.each(['ar', 'en'] as const)(
  'identifies Naql365 as seller in %s without a supplier or an unapproved delivery promise',
  async (locale) => {
    mocks.shop.mockResolvedValue({ status: 'NOT_AVAILABLE', items: [], nextCursor: null });
    mocks.categories.mockResolvedValue([]);
    const html = renderToStaticMarkup(await StoreIntroduction({ locale }));
    expect(html).toContain('Naql365');
    expect(html).toContain(locale === 'ar' ? 'هو البائع' : 'is your seller');
    for (const text of [
      html,
      commerceContent[locale].supplierNote,
      commerceExtra[locale].shippingNote,
      storeText[locale].cash,
    ]) {
      expect(text).not.toMatch(/supplier|المورد/i);
      expect(text).toContain('Naql365');
    }
    expect(commerceExtra[locale].shippingNote).toContain(
      locale === 'ar' ? 'لا نَعِد بموعد' : 'no delivery date is promised',
    );
    const checkout = renderToStaticMarkup(
      createElement(CheckoutForm, {
        locale,
        cart: {
          revision: 0,
          checkedOutOrderId: null,
          items: [],
          contracts: [
            {
              id,
              revision: 1,
              regions: ['Synthetic'],
              deliveryMinor: 200,
              taxMode: 'ADDITIVE',
              taxBps: 0,
              taxDelivery: false,
              destinationIds: [],
              codRelease: true,
              termsAr: 'شروط',
              termsEn: 'Terms',
            },
          ],
          destinations: [],
        },
      }),
    );
    expect(checkout).toContain(storeText[locale].cash);
    expect(checkout).not.toMatch(/collected by supplier|التحصيل لدى المورد/);
  },
);
it.each(['ar', 'en'] as const)(
  'separates %s customer labels from staff labels without changing state codes',
  (locale) => {
    expect(storeLabel('SENT_TO_SUPPLIER', locale)).toBe(
      locale === 'ar' ? 'جارٍ تجهيز الطلب' : 'Your order is being prepared',
    );
    expect(storeLabel('SENT_TO_SUPPLIER', locale, 'staff')).toBe(
      locale === 'ar' ? 'أُرسل للمورد' : 'Sent to supplier',
    );
    for (const code of ['send', 'recover', 'report_cash'])
      expect(storeLabel(code, locale, 'customer')).not.toMatch(/supplier|المورد/i);
    expect(storeLabel('DELIVERED', locale, 'customer')).toBe(
      storeLabel('DELIVERED', locale, 'staff'),
    );
  },
);
for (const locale of ['ar', 'en'] as const)
  for (const staff of [false, true])
    for (const detail of [false, true]) {
      it(`renders ${locale} ${staff ? 'staff' : 'customer'} ${detail ? 'detail/history' : 'list'} with audience-specific labels`, async () => {
        mocks.read.mockResolvedValue(
          detail
            ? order
            : {
                items: [{ ...order, method: 'CASH', paymentStatus: 'CASH_DUE' }],
                nextCursor: null,
              },
        );
        const stream = await renderToReadableStream(
          await StoreExperience({
            locale,
            staff,
            path: detail ? ['orders', id] : ['orders'],
            query: {},
          }),
        );
        await stream.allReady;
        const html = await new Response(stream).text();
        expect(html).toContain(
          storeLabel('SENT_TO_SUPPLIER', locale, staff ? 'staff' : 'customer'),
        );
        if (!staff) {
          expect(html).not.toMatch(
            /Sent to supplier|أُرسل للمورد|Agreed supplier entitlement|الاستحقاق المتفق عليه للمورد|PRIVATE-FINANCE-REFERENCE/,
          );
          expect(html).not.toMatch(/Resume with supplier|استئناف لدى المورد/);
        } else if (detail) {
          expect(html).toContain('PRIVATE-FINANCE-REFERENCE');
          expect(html).toContain(storeText[locale].supplier);
          expect(html).toContain(storeText[locale].staffCash);
        }
        expect(order.fulfillmentState).toBe('SENT_TO_SUPPLIER');
      });
    }
