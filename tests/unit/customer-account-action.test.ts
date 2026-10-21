import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ status: 'SENT' }));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: () => ({}) }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'test-customer' } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { display_name: 'TEST Customer', phone: '', locale: 'en' },
            error: null,
          }),
        }),
      }),
    }),
    rpc: async () => ({ data: 'active', error: null }),
  }),
}));
vi.mock('@/infrastructure/requests/list', () => ({ customerRequests: async () => [] }));
vi.mock('@/infrastructure/pricing/service', () => ({
  customerQuotes: async () => [
    { reference: 'TEST-Q', quote_versions: [{ id: 'test-quote', status: fixture.status }] },
  ],
}));
vi.mock('@/infrastructure/markets/service', () => ({ availableMarkets: async () => [] }));
vi.mock('@/components/auth/customer-form', () => ({ CustomerProfileForm: () => null }));
vi.mock('@/components/requests/wizard', () => ({ StartRequest: () => null }));
// Static rendering cannot resolve nested async Server Components. These two
// boundaries fetch unrelated Store presentation data; retain the real account
// children, quote selection, CustomerNavigation and customer-facing actions.
vi.mock('@/components/lovable/surface', () => ({
  CommerceSurface: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/lovable/customer-store-records', () => ({
  CustomerStoreRecords: () => null,
}));
vi.mock('@/app/auth/customer-actions', () => ({ customerLogout: async () => undefined }));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw Error('Unexpected redirect');
  },
}));
import { CustomerAccount } from '../../src/components/requests/account';

function links(html: string) {
  return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href = '', content = '']) => ({ href, text: content.replace(/<[^>]*>/g, '').trim() }),
  );
}

for (const locale of ['en', 'ar'] as const) {
  for (const status of ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']) {
    test(`Customer next action retains only actionable ${status} Quote presentation (${locale})`, async () => {
      fixture.status = status;
      const html = renderToStaticMarkup(await CustomerAccount({ locale }));
      const reviewText = locale === 'ar' ? 'راجع عرض السعر' : 'Review quote';
      const quoteLinks = links(html).filter(({ href }) => href.includes('/account/quotes/'));
      if (status === 'SENT' || status === 'VIEWED') {
        expect(quoteLinks).toEqual([
          { href: `/${locale}/account/quotes/test-quote`, text: reviewText },
        ]);
        expect(html).toContain('<strong>TEST-Q</strong>');
      } else {
        expect(quoteLinks).toEqual([]);
        expect(html).not.toContain(reviewText);
        expect(html).not.toContain('TEST-Q');
      }
      // The imported dashboard keeps booking available, including when there is
      // no actionable quote. Select its semantic nav, not the removed CSS panel.
      const label = locale === 'ar' ? 'لوحة العميل' : 'Customer dashboard';
      const navigation = html.match(
        new RegExp(`<nav\\b[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)<\\/nav>`),
      )?.[1];
      expect(navigation).toBeDefined();
      expect(links(navigation!).filter(({ href }) => href.endsWith('/request'))).toEqual([
        { href: `/${locale}/request`, text: locale === 'ar' ? 'اطلب نقل' : 'Book Transport' },
      ]);
    });
  }
}
