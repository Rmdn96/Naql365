import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import FinancePage from '@/app/[locale]/(portal)/portal/finance/page';

const mocks = vi.hoisted(() => ({ access: vi.fn(), queue: vi.fn() }));
vi.mock('@/infrastructure/identity/staff-context', () => ({ staffAccess: mocks.access }));
vi.mock('@/infrastructure/payments/staff-views', () => ({ staffFinanceQueue: mocks.queue }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error('REDIRECT:' + path);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ status: 'authorized' });
  mocks.queue.mockResolvedValue({
    marketId: '13000000-0000-4000-8000-000000000003',
    nextCursor: null,
    items: [
      {
        orderId: '13000000-0000-4000-8000-000000000004',
        reference: 'O-N365-202610-980002',
        customerName: 'SYNTHETIC FINANCE EG',
        status: 'CASH_DUE',
        method: 'CASH',
        amountMinor: 0,
        currency: 'EGP',
      },
    ],
  });
});

it.each(['ar', 'en'] as const)(
  'renders the Egypt Finance fixture and filters in %s',
  async (locale) => {
    const html = renderToStaticMarkup(
      await FinancePage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain(locale === 'ar' ? 'العناصر المعروضة' : 'Displayed items');
    expect(html).toContain('SYNTHETIC FINANCE EG');
    expect(html).not.toContain('SYNTHETIC FINANCE SA');
    expect(html).toContain('id="finance-status"');
    expect(html).toContain('/' + locale + '/portal/finance/13000000-0000-4000-8000-000000000004');
    expect(mocks.access).toHaveBeenCalledWith('finance.read');
    expect(mocks.queue).toHaveBeenCalledWith({});
  },
);

it.each(['ar', 'en'] as const)('retains empty PAID filtering in %s', async (locale) => {
  mocks.queue.mockResolvedValue({ items: [], nextCursor: null });
  const html = renderToStaticMarkup(
    await FinancePage({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({ status: 'PAID' }),
    }),
  );
  expect(html).toContain(locale === 'ar' ? 'لا توجد دفعات' : 'No payments match');
  expect(html).not.toContain('SYNTHETIC FINANCE');
  expect(mocks.queue).toHaveBeenCalledWith({ status: 'PAID' });
});

it('denies unauthorized Finance before reading the queue', async () => {
  mocks.access.mockResolvedValue({ status: 'forbidden' });
  await expect(
    FinancePage({ params: Promise.resolve({ locale: 'ar' }), searchParams: Promise.resolve({}) }),
  ).rejects.toThrow('REDIRECT:/ar/portal');
  expect(mocks.queue).not.toHaveBeenCalled();
});

it('keeps the browser Finance assertions consistent with the Egypt-only fixture', () => {
  const harness = readFileSync('scripts/test-staff-workspace.mjs', 'utf8');
  const initialQueueAssertions = harness.slice(
    harness.indexOf("if (workspaceModule === 'finance')"),
    harness.indexOf("await page.locator('#finance-status').selectOption('PAID')"),
  );
  expect(initialQueueAssertions).toMatch(/\)\)\.toContainText\(\s*'SYNTHETIC FINANCE EG'/);
  expect(initialQueueAssertions).toMatch(/\.not\.toContainText\(\s*'SYNTHETIC FINANCE SA'/);
});
