import type { Metadata } from 'next';
import { quoteCatalog, quoteMode } from '@/infrastructure/store/quotes';
import { CommerceSurface } from '@/components/lovable/surface';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { StoreExperience } from '@/components/store/experience';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; path?: string[] }>;
}): Promise<Metadata> {
  const hidden = { robots: { index: false, follow: false } };
  const { locale, path } = await params;
  if (!quoteMode() || !isLocale(locale) || path?.[0] !== 'products' || path.length !== 2)
    return hidden;
  const catalog = await quoteCatalog();
  const product = catalog.enabled && catalog.items.find((item) => item.slug === path[1]);
  if (!product) return hidden;
  const suffix = '/store/products/' + product.slug;
  return {
    title: product.content[('title_' + locale) as 'title_ar' | 'title_en'],
    description:
      product.content[('description_' + locale) as 'description_ar' | 'description_en'] ??
      undefined,
    alternates: {
      canonical: '/' + locale + suffix,
      languages: { ar: '/ar' + suffix, en: '/en' + suffix },
    },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();
  const q = await searchParams;
  if (!path?.length || path[0] === 'categories') {
    const params = new URLSearchParams();
    for (const field of ['search', 'category', 'after']) {
      if (typeof q[field] === 'string') params.set(field, q[field]);
    }
    redirect('/' + locale + (params.size ? '?' + params.toString() : ''));
  }
  if (path[0] === 'checkout') redirect('/' + locale + '/store/cart');
  if (path[0] === 'products') {
    if (path.length !== 2 || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(path[1] ?? '')) notFound();
    return <CommerceSurface locale={locale} view="product" productId={path[1]!} />;
  }
  if (path[0] === 'cart' && path.length === 1)
    return <CommerceSurface locale={locale} view="cart" />;
  return (
    <CommerceSurface locale={locale} view={path?.[0] ?? 'catalog'}>
      <StoreExperience
        locale={locale}
        path={path}
        query={{
          search: typeof q.search === 'string' ? q.search : undefined,
          category: typeof q.category === 'string' ? q.category : undefined,
          after: typeof q.after === 'string' ? q.after : undefined,
        }}
      />
    </CommerceSurface>
  );
}
