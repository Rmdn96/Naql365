import { renderToStaticMarkup } from 'react-dom/server';
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
vi.mock('@/app/auth/customer-actions', () => ({ customerLogout: async () => undefined }));
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw Error('Unexpected redirect');
  },
}));
import { CustomerAccount } from '../../src/components/requests/account';

for (const status of ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']) {
  test(`Customer next action retains only actionable ${status} Quote presentation`, async () => {
    fixture.status = status;
    const html = renderToStaticMarkup(await CustomerAccount({ locale: 'en' }));
    const panel = html.match(/<section class="customer-next-action"[\s\S]*?<\/section>/)?.[0];
    expect(panel).toBeDefined();
    if (status === 'SENT' || status === 'VIEWED') {
      expect(panel).toContain('href="/en/account/quotes/test-quote"');
      expect(panel).toContain('Review quote');
    } else {
      expect(panel).not.toContain('/account/quotes/test-quote');
      expect(panel).toContain('href="/en/request"');
    }
  });
}
