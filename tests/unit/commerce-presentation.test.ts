import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { activeCartItems } from '@/components/store/cart-client';
import { storeCart, storeProduct } from '@/domain/store/model';
const mock = vi.hoisted(() => ({ shop: vi.fn(), categories: vi.fn() }));
vi.mock('@/infrastructure/store/service', () => ({
  storeShop: mock.shop,
  storeCategories: mock.categories,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { StoreIntroduction } from '@/components/store/introduction';
const product = storeProduct.parse({
  listingId: '98000000-0000-4000-8000-000000000003',
  revision: 1,
  slug: 'synthetic-box',
  category: 'packing',
  amountMinor: 1250,
  currency: 'EGP',
  content: { title_ar: 'صندوق تجريبي', title_en: 'Synthetic box' },
  media: [],
  supplierCost: 400,
  margin: 850,
});
it.each(['ar', 'en'] as const)(
  'renders only approved public products and a real cart action (%s)',
  async (locale) => {
    mock.shop.mockResolvedValue({ status: 'AVAILABLE', items: [product], nextCursor: null });
    mock.categories.mockResolvedValue([
      { slug: 'packing', content: { title_ar: 'تغليف', title_en: 'Packing' } },
    ]);
    const html = renderToStaticMarkup(await StoreIntroduction({ locale }));
    expect(html).toContain('/' + locale + '/store/products/synthetic-box');
    expect(html).toContain('/' + locale + '/store?category=packing');
    expect(html).toContain(locale === 'ar' ? 'أضف للسلة' : 'Add to cart');
    expect(html).toContain(locale === 'ar' ? '١٢٫٥٠' : '12.50');
    expect(html).not.toMatch(/supplierCost|margin|demo cart|rehearsal|in stock/);
  },
);
it('renders no mock product, amount or purchase action for an unapproved Store', async () => {
  mock.shop.mockResolvedValue({ status: 'NOT_AVAILABLE', items: [], nextCursor: null });
  mock.categories.mockResolvedValue([]);
  const html = renderToStaticMarkup(await StoreIntroduction({ locale: 'en' }));
  expect(html).toContain('Purchasing is currently unavailable');
  expect(html).not.toContain('Add to cart');
  expect(html).not.toContain('Synthetic box');
});
it('never carries consumed order items into a new cart or its badge', () => {
  const cart = storeCart.parse({
    revision: 4,
    checkedOutOrderId: '99000000-0000-4000-8000-000000000004',
    items: [{ ...product, savedRevision: 1, quantity: 7, available: true }],
    contracts: [],
    destinations: [],
  });
  expect(activeCartItems(cart)).toEqual([]);
  expect(cart.items[0]?.quantity).toBe(7);
  expect(activeCartItems({ ...cart, checkedOutOrderId: null })).toHaveLength(1);
});
