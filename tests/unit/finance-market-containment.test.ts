import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import FinancePage from '../../src/app/[locale]/(portal)/portal/finance/page';
import Dashboard from '../../src/app/[locale]/(portal)/portal/page';

const m = vi.hoisted(() => ({ access: vi.fn(), queue: vi.fn(), country: 'SA' }));
vi.mock('@/infrastructure/identity/staff-context', () => ({
  staffAccess: m.access,
  staffModules: async () => ({ context: { status: 'authorized' }, finance: true }),
}));
vi.mock('@/infrastructure/markets/public', () => ({
  selectedPublicCountry: async () => m.country,
}));
vi.mock('@/infrastructure/payments/service', () => ({ getFinanceQueue: m.queue }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Error('REDIRECT:' + url);
  },
  notFound: () => {
    throw Error('NOT_FOUND');
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({ status: 'authorized' });
  m.queue.mockImplementation(() => {
    throw Error('Unscoped Finance must not run');
  });
});
it.each(['ar', 'en'])(
  'server rendering %s Finance and dashboard never loads the unscoped queue',
  async (locale) => {
    for (const country of ['SA', 'EG']) {
      m.country = country;
      for (const page of [FinancePage, Dashboard]) {
        const view = await page({ params: Promise.resolve({ locale }) });
        const html = renderToStaticMarkup(createElement('div', null, view));
        expect(html).toContain(locale === 'ar' ? 'غير متاحة مؤقتًا' : 'temporarily unavailable');
        expect(html).not.toContain('finance-queue');
      }
    }
    expect(m.queue).not.toHaveBeenCalled();
  },
);
it('preserves denied staff routing before the containment presentation', async () => {
  m.access.mockResolvedValue({ status: 'forbidden' });
  await expect(FinancePage({ params: Promise.resolve({ locale: 'en' }) })).rejects.toThrow(
    'REDIRECT:/en/portal',
  );
  expect(m.queue).not.toHaveBeenCalled();
});
