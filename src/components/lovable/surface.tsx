import { quoteCatalog, quoteMode } from '@/infrastructure/store/quotes';
import { SourceCommerce } from './commerce';
import { storeShop, storeCategories } from '@/infrastructure/store/service';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';
import type { Locale } from './types';
import type { ReactNode } from 'react';
import '@/styles/lovable.css';
import '@/styles/lovable-store.css';
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
    const search = query.search?.trim().toLowerCase();
    const category = query.category;
    const filtered = catalog.items.filter(
      (p) =>
        (!category || category === p.category) &&
        (!search ||
          [p.sku, p.content.title_ar, p.content.title_en].some((part) =>
            part.toLowerCase().includes(search),
          )),
    );
    const products = filtered
      .filter((p) => view !== 'product' || p.slug === productId)
      .map((p) => ({
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
        catalog.items.map((p) => [
          p.category,
          { slug: p.category, title: locale === 'ar' ? p.categoryAr : p.categoryEn },
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
