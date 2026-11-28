import { beforeEach, describe, expect, it, vi } from 'vitest';

const { access, rpc, admin, images } = vi.hoisted(() => ({
  access: vi.fn(),
  rpc: vi.fn(),
  admin: vi.fn(),
  images: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/infrastructure/identity/staff-context', () => ({ staffAccess: access }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ rpc }),
}));
vi.mock('@/infrastructure/store/catalog', () => ({
  storeCatalogAdmin: admin,
  storeCategoryImages: images,
}));
import { catalogReview } from '@/infrastructure/store/catalog-review';

const categoryId = 'ebbecb6e-19a1-4956-9b14-089740eb2999';
const productId = 'ad671616-9fff-425e-8b21-cbd41239ccdf';
const categoryImage = 'd32a7ad3-cf37-4410-889f-0b21b10e9003';

describe('private catalog review', () => {
  beforeEach(() => vi.resetAllMocks());

  it('keeps drafts out of an anonymous request without reading the admin catalog', async () => {
    access.mockResolvedValue({ status: 'unauthenticated' });
    await expect(catalogReview()).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(admin).not.toHaveBeenCalled();
  });

  it('rejects an authenticated staff session that is not a commercial admin', async () => {
    access.mockResolvedValue({ status: 'authorized' });
    rpc.mockResolvedValue({ data: false });
    await expect(catalogReview()).resolves.toBeNull();
    expect(admin).not.toHaveBeenCalled();
  });

  it('uses all pages and returns already linked private images and no price', async () => {
    access.mockResolvedValue({ status: 'authorized' });
    rpc.mockResolvedValue({ data: true });
    const content = { title_ar: 'منتج', title_en: 'Product' };
    admin.mockImplementation(async (kind, cursor) => ({
      page: {
        nextCursor: kind === 'products' && !cursor ? productId : null,
        items:
          kind === 'products'
            ? cursor
              ? [
                  {
                    id: productId,
                    sku: 'BOX-001',
                    slug: 'box-001',
                    state: 'ACTIVE',
                    categoryId,
                    revision: 2,
                    content,
                  },
                ]
              : []
            : kind === 'categories'
              ? [{ id: categoryId, slug: 'box', content }]
              : [{ productId, state: 'DRAFT', media: [] }],
      },
    }));
    images.mockResolvedValue({ [categoryId]: { id: categoryImage, approved: false } });
    await expect(catalogReview()).resolves.toMatchObject({
      items: [{ id: productId, sku: 'BOX-001', price: null, category: 'box' }],
      images: { box: categoryImage },
    });
    expect(admin).toHaveBeenCalledWith('products', productId);
    expect(rpc).toHaveBeenCalledWith('commercial_admin_session');
  });
});
