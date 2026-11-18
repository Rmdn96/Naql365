import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const mock = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/infrastructure/store/catalog', async () => {
  const { z } = await import('zod');
  return {
    catalogKind: z.enum([
      'products',
      'categories',
      'listings',
      'prices',
      'references',
      'offers',
      'suppliers',
      'agreements',
      'policies',
    ]),
    storeCatalogAdmin: mock.read,
  };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { CatalogAdmin } from '@/components/store/catalog-admin';
it('labels approved product difference as provisional and keeps private management tabs permission-scoped', async () => {
  mock.read.mockResolvedValue({
    page: {
      items: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          revision: 2,
          state: 'APPROVED',
          amountMinor: 600,
          comparison: {
            retailMinor: 1000,
            entitlementMinor: 600,
            productDifferenceMinor: 400,
            retailVersion: 1,
            offerVersion: 1,
          },
        },
      ],
      nextCursor: null,
    },
    manage: false,
    publish: false,
    sourcing: true,
    policies: false,
  });
  const html = renderToStaticMarkup(await CatalogAdmin({ locale: 'en', kind: 'offers' }));
  expect(html).toContain('Provisional product difference');
  expect(html).toContain('before delivery/tax allocation');
  expect(html).toContain('not net profit');
  expect(html).not.toContain('?kind=policies');
  mock.read.mockResolvedValue({
    page: { items: [], nextCursor: null },
    manage: false,
    publish: false,
    sourcing: false,
    policies: false,
  });
  const publicStaff = renderToStaticMarkup(await CatalogAdmin({ locale: 'ar', kind: 'products' }));
  expect(publicStaff).not.toContain('?kind=references');
  expect(publicStaff).not.toContain('?kind=offers');
  expect(publicStaff).not.toContain('400');
});
it('offers named categories and retains required product fields in both languages', async () => {
  mock.read.mockImplementation(async (kind: string) => ({
    page: {
      items:
        kind === 'categories'
          ? [
              {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                revision: 1,
                state: 'DRAFT',
                content: { title_ar: 'صناديق', title_en: 'Boxes' },
              },
            ]
          : [],
      nextCursor: null,
    },
    manage: true,
    publish: false,
    sourcing: false,
    policies: false,
  }));
  for (const locale of ['ar', 'en'] as const) {
    const html = renderToStaticMarkup(await CatalogAdmin({ locale, kind: 'products' }));
    expect(html).toContain('<select');
    expect(html).toContain('name="category_id"');
    expect(html).toContain(locale === 'ar' ? 'صناديق' : 'Boxes');
    expect(html).toContain('name="sku"');
    expect(html).toContain('name="slug"');
    expect(html).not.toContain('name="supplier_id"');
  }
});
