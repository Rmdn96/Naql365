import 'server-only';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { storeCatalogAdmin, storeCategoryImages } from './catalog';
import { quoteProduct } from '@/domain/store/quote';

type Item = Awaited<ReturnType<typeof storeCatalogAdmin>>['page']['items'][number];

async function readCatalog(kind: 'products' | 'categories' | 'listings') {
  const items: Item[] = [];
  let cursor: string | undefined;
  do {
    const { page } = await storeCatalogAdmin(kind, cursor);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

/** Review uses the current administrator session and existing database grants. */
export async function catalogReview() {
  const access = await staffAccess('store.catalog.read');
  if (access.status !== 'authorized') return null;
  const client = await createSupabaseServerClient();
  const role = await client.rpc('commercial_admin_session');
  if (role.error || role.data !== true) return null;

  const [products, categories, listings] = await Promise.all([
    readCatalog('products'),
    readCatalog('categories'),
    readCatalog('listings'),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const mediaByProduct = new Map(
    listings
      .filter((listing) => listing.state !== 'SUSPENDED')
      .map((listing) => [listing.productId, listing.media]),
  );
  const items = products.flatMap((product) => {
    const category = categoryById.get(product.categoryId ?? '');
    if (
      product.state !== 'ACTIVE' ||
      !product.content ||
      !product.sku ||
      !product.slug ||
      !category?.content ||
      !category.slug
    )
      return [];
    return [
      quoteProduct.parse({
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        revision: product.revision,
        category: category.slug,
        categoryAr: category.content.title_ar,
        categoryEn: category.content.title_en,
        content: {
          ...product.content,
          description_ar: product.content.description_ar ?? null,
          description_en: product.content.description_en ?? null,
        },
        media: mediaByProduct.get(product.id) ?? [],
        price: null,
      }),
    ];
  });
  const assets = await storeCategoryImages(categories.map((category) => category.id));
  const images = Object.fromEntries(
    categories.flatMap(({ id, slug }) => (slug && assets?.[id] ? [[slug, assets[id].id]] : [])),
  );
  return { items, images };
}
