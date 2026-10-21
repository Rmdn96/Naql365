import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/en',
}));
vi.mock('@/components/lovable/adapter', async (original) => ({
  ...(await original<object>()),
  useCommerce: () => ({
    cart: null,
    cartState: 'guest',
    lines: [],
    busy: '',
    notice: '',
    add: vi.fn(),
    change: vi.fn(),
    setNotice: vi.fn(),
  }),
}));
import { SourceCommerce } from '@/components/lovable/commerce';
import type { CatalogProduct } from '@/components/lovable/adapter';
const product: CatalogProduct = {
  id: '91000000-0000-4000-8000-000000000001',
  slug: 'test-carton',
  revision: 1,
  category: 'packing',
  name: { ar: 'صندوق اختبار', en: 'Test carton' },
  spec: { ar: '', en: '' },
  retail: 1000,
  specifications: [],
  image: '/store-assets/packing-carton-test-v1.png',
  media: [
    {
      src: '/store-assets/packing-carton-test-v1.png',
      altAr: 'صورة معتمدة',
      altEn: 'Approved image',
    },
  ],
};
it.each(['ar', 'en'] as const)(
  'renders governed products with approved media metadata (%s)',
  (locale) => {
    const html = renderToStaticMarkup(
      createElement(SourceCommerce, {
        initialLocale: locale,
        initialMarket: 'EG',
        view: 'home',
        products: [product],
        categories: [],
        available: true,
      }),
    );
    expect(html.match(/cm-product store-product/g)).toHaveLength(1);
    expect(html).toContain(`alt="${locale === 'ar' ? 'صورة معتمدة' : 'Approved image'}"`);
    expect(html).toContain('/' + locale + '/request');
    expect(html).toContain('/' + locale + '/store/products/test-carton');
    expect(html).not.toMatch(/supplierEntitlement|supplierReference|sessionStorage/);
  },
);
it('retains non-purchasable empty state and guest cart access', () => {
  const html = renderToStaticMarkup(
    createElement(SourceCommerce, {
      initialLocale: 'en',
      initialMarket: 'EG',
      view: 'home',
      products: [],
      categories: [],
      available: false,
    }),
  );
  expect(html).not.toContain('cm-product store-product');
  expect(html).toContain('Purchasing is currently unavailable');
  expect(html).toContain('/en/store');
});
