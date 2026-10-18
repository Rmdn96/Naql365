import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { Checkout } from '@/components/payments/checkout';
import type { PaymentDetails } from '@/domain/payments/model';
import { paymentDictionary } from '@/i18n/payments';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const id = '13000000-0000-4000-8000-000000000001';
const data: PaymentDetails = {
  orderId: id,
  organizationId: id,
  reference: 'TEST ORDER',
  marketId: id,
  country: 'SA',
  timezone: 'Asia/Riyadh',
  currency: 'SAR',
  subtotalMinor: 10000,
  taxMinor: 1500,
  totalMinor: 11500,
  taxLabelAr: null,
  taxLabelEn: null,
  paymentId: null,
  revision: 0,
  method: null,
  status: 'PENDING',
  executionAllowed: false,
  canSwitch: true,
  transferAvailable: true,
  destinations: [{ id, type: 'BANK', nameAr: 'اختبار', nameEn: 'TEST' }],
  bank: null,
  attempts: [],
  receipt: null,
};
for (const locale of ['ar', 'en'] as const)
  test(`${locale} payment method decoration is hidden from assistive technology and pending is not confirmed`, () => {
    const html = renderToStaticMarkup(createElement(Checkout, { data, locale }));
    const buttons = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((x) =>
      x[1]!
        .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim(),
    );
    const t = paymentDictionary(locale);
    expect(buttons).toContain(t.cash);
    expect(buttons).toContain(t.transfer);
    expect(html).toContain(t.states.PENDING);
    expect(html).not.toContain(t.states.PAID);
    expect(html).not.toContain('IBAN');
  });

for (const locale of ['ar', 'en'] as const)
  test(
    locale + ' identifies Egypt transfer channels independently without configuring destinations',
    () => {
      const t = paymentDictionary(locale);
      const html = renderToStaticMarkup(
        createElement(Checkout, {
          locale,
          data: {
            ...data,
            country: 'EG',
            currency: 'EGP',
            destinations: [
              { id, type: 'VODAFONE_CASH', nameAr: 'اختبار فقط', nameEn: 'TEST ONLY' },
              {
                id: '13000000-0000-4000-8000-000000000002',
                type: 'INSTAPAY',
                nameAr: 'اختبار آخر',
                nameEn: 'OTHER TEST ONLY',
              },
            ],
          },
        }),
      );
      expect(html).toContain(t.vodafone);
      expect(html).toContain(t.instapay);
      expect(html).toContain(t.cash);
      expect(html).not.toContain('TEST-DESTINATION');
      expect(html).not.toContain(t.states.PAID);
    },
  );
