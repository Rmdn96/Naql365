import { quoteCatalog, quoteCategoryImages, quoteMode } from '@/infrastructure/store/quotes';
import { catalogReview } from '@/infrastructure/store/catalog-review';
import { SourceCommerce } from './commerce';
import { storeShop, storeCategories } from '@/infrastructure/store/service';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';
import type { Locale } from './types';
import type { ReactNode } from 'react';
import '@/styles/lovable.css';
import '@/styles/lovable-store.css';
const categoryOrder = ['box', 'bbl', 'str', 'tap', 'rol', 'bag', 'twi', 'kit'];
const rank = (slug: string) => {
  const index = categoryOrder.indexOf(slug);
  if (slug === 'kit') return categoryOrder.length;
  return index < 0 ? categoryOrder.length - 1 : index;
};

export async function CommerceSurface({
  locale,
  view = 'home',
  productId = '',
  query = {},
  children,
}: {
  locale: Locale;
  view?: string;
  productId?: string;
  query?: { search?: string; category?: string; after?: string };
  children?: ReactNode;
}) {
  if (quoteMode() && !children) {
    const catalog = await quoteCatalog();
    const review =
      !catalog.enabled && ['home', 'catalog', 'categories', 'product'].includes(view)
        ? await catalogReview()
        : null;
    const images =
      review?.images ?? (catalog.enabled && view !== 'product' ? await quoteCategoryImages() : {});
    const items = (review?.items ?? catalog.items).toSorted(
      (a, b) =>
        rank(a.category) - rank(b.category) || a.sku.localeCompare(b.sku, 'en', { numeric: true }),
    );
    const search = query.search?.trim().toLowerCase();
    const category = query.category;
    const filtered = items.filter(
      (p) =>
        (!category || category === p.category) &&
        (!search ||
          [p.sku, p.content.title_ar, p.content.title_en].some((part) =>
            part.toLowerCase().includes(search),
          )),
    );
    const selected = view === 'product' ? items.find((p) => p.slug === productId) : undefined;
    const visible =
      view === 'product'
        ? selected
          ? [
              selected,
              ...items
                .filter((p) => p.category === selected.category && p.id !== selected.id)
                .slice(0, 3),
            ]
          : []
        : filtered;
    const products = visible.map((p) => ({
      id: p.id,
      sku: p.sku,
      slug: p.slug,
      revision: p.revision,
      category: p.category,
      name: { ar: p.content.title_ar, en: p.content.title_en },
      spec: { ar: p.content.description_ar ?? '', en: p.content.description_en ?? '' },
      image: p.media[0]?.src ?? '',
      media: p.media,
      specifications: p.content.specifications ?? [],
      retail: p.price,
    }));
    const categories = Array.from(
      new Map(
        items.map((p) => [
          p.category,
          {
            slug: p.category,
            title: locale === 'ar' ? p.categoryAr : p.categoryEn,
            image: images[p.category],
          },
        ]),
      ).values(),
    );
    return (
      <SourceCommerce
        quote
        initialLocale={locale}
        initialMarket="EG"
        view={view}
        productId={productId}
        products={products}
        categories={categories}
        available={catalog.enabled}
        review={review !== null}
        initialQuery={query.search ?? ''}
        initialCategory={category ?? 'all'}
      />
    );
  }
  const [country, catalog, categories] = await Promise.all([
    selectedPublicCountry(),
    storeShop(view === 'product' ? { slug: productId } : query),
    ['home', 'catalog', 'categories'].includes(view) ? storeCategories() : Promise.resolve([]),
  ]);
  catalogTrace({
    stage: 'render',
    available: catalog.status === 'AVAILABLE',
    items: catalog.items.length,
  });
  const products = catalog.items.map((p) => ({
    id: p.listingId,
    slug: p.slug,
    revision: p.revision,
    category: p.category,
    name: { ar: p.content.title_ar, en: p.content.title_en },
    spec: { ar: p.content.description_ar ?? '', en: p.content.description_en ?? '' },
    image: p.media[0]?.src ?? '',
    media: p.media,
    specifications: p.content.specifications ?? [],
    retail: p.amountMinor,
  }));
  return (
    <SourceCommerce
      key={[view, productId, query.search, query.category, query.after].join(':')}
      initialLocale={locale}
      initialQuery={query.search ?? ''}
      initialCategory={query.category || 'all'}
      nextCursor={catalog.nextCursor}
      initialMarket={country}
      view={view}
      productId={productId}
      products={products}
      categories={categories.map((c) => ({
        slug: c.slug,
        title: locale === 'ar' ? c.content.title_ar : c.content.title_en,
      }))}
      available={catalog.status === 'AVAILABLE'}
    >
      {children}
    </SourceCommerce>
  );
}
