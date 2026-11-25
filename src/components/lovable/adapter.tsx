'use client';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';
import type { StoreProduct } from '@/domain/store/model';
import type { Locale, Market } from './types';
export type CatalogProduct = {
  id: string;
  slug: string;
  revision: number;
  category: string;
  name: Record<Locale, string>;
  spec: Record<Locale, string>;
  image: string;
  retail: number;
  media: StoreProduct['media'];
  specifications: NonNullable<StoreProduct['content']['specifications']>;
};
export function publicProduct(p: StoreProduct): CatalogProduct {
  return {
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
  };
}
export function destination(
  view: string,
  locale: Locale,
  product = '',
  query = '',
  category = '',
  after = '',
) {
  const root = '/' + locale;
  const paths: Record<string, string> = {
    home: '',
    catalog: '',
    categories: '',
    product: '/store/products/' + encodeURIComponent(product),
    cart: '/store/cart',
    checkout: '/store/cart',
    portal: '/account',
    orders: '/store/orders',
    requests: '/account/requests',
    transportRequests: '/account/requests',
    transport: '/request',
    settings: '/account/profile',
    confirmation: '/store/orders',
  };
  const params = new URLSearchParams();
  if (query) params.set('search', query);
  if (category && category !== 'all') params.set('category', category);
  if (after) params.set('after', after);
  return root + (paths[view] ?? '/store') + (params.size ? '?' + params.toString() : '');
}
type Search = {
  view?: string;
  product?: string;
  locale?: Locale;
  market?: Market;
  query?: string;
  category?: string;
  after?: string;
};
export function Link({
  to,
  search,
  ...props
}: Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string; search?: Search }) {
  const locale = search?.locale ?? 'ar';
  const href =
    to === '/'
      ? destination(
          search?.view ?? 'home',
          locale,
          search?.product,
          search?.query,
          search?.category,
          search?.after,
        )
      : to === '/auth-preview'
        ? '/' + locale + '/login'
        : to === '/store-admin-preview'
          ? '/' + locale + '/portal/store/catalog'
          : '/' + locale;
  return <NextLink {...props} href={href} />;
}
export { themeModes, parseThemeMode, type ThemeMode } from '@/components/design-system/theme';
