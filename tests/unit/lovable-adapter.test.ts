import { describe, expect, it } from 'vitest';
import { destination, publicProduct } from '@/components/lovable/adapter';
import type { StoreProduct } from '@/domain/store/model';

describe('Lovable canonical Store adapter', () => {
  it('retains search, category and pagination in canonical navigation', () => {
    const url = new URL(
      destination('catalog', 'ar', '', 'packing & moving', 'boxes', 'cursor/1'),
      'http://localhost',
    );
    expect(url.pathname).toBe('/ar/store');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: 'packing & moving',
      category: 'boxes',
      after: 'cursor/1',
    });
    expect(destination('transport', 'en')).toBe('/en/request');
    expect(destination('categories', 'ar')).toBe('/ar/store/categories');
    expect(destination('orders', 'ar')).toBe('/ar/store/orders');
  });
  it('projects approved customer content without leaking private extra fields', () => {
    const product = {
      listingId: '91000000-0000-4000-8000-000000000001',
      slug: 'test-carton',
      revision: 2,
      category: 'boxes',
      amountMinor: 1000,
      currency: 'EGP',
      content: {
        title_ar: 'اختبار',
        title_en: 'Test',
        specifications: [
          { label_ar: 'وحدة', label_en: 'Unit', value_ar: 'قطعة', value_en: 'Piece' },
        ],
      },
      media: [{ src: '/store-assets/packing-carton-test-v1.png', altAr: 'اختبار', altEn: 'Test' }],
      supplierEntitlementMinor: 400,
      supplierReferenceMinor: 800,
    } satisfies StoreProduct & { supplierEntitlementMinor: number; supplierReferenceMinor: number };
    const result = publicProduct(product);
    expect(result.retail).toBe(1000);
    expect(result.specifications).toEqual(product.content.specifications);
    expect(result.media).toEqual(product.media);
    expect(result).not.toHaveProperty('supplierEntitlementMinor');
    expect(result).not.toHaveProperty('supplierReferenceMinor');
  });
});
