'use client';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { StoreProduct, StoreCart } from '@/domain/store/model';
import {
  activeCartItems,
  cartChanged,
  readCart,
  createCartWriter,
  CartAccessError,
} from '@/components/store/cart-client';
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
    catalog: '/store',
    categories: '/store/categories',
    product: '/store/products/' + encodeURIComponent(product),
    cart: '/store/cart',
    checkout: '/store/checkout',
    portal: '/account',
    orders: '/store/orders',
    requests: '/account/requests',
    transportRequests: '/account/requests',
    transport: '/request',
    settings: '/account',
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
export function useCommerce(locale: Locale) {
  const router = useRouter(),
    pathname = usePathname(),
    writer = useRef(createCartWriter()),
    lock = useRef(false);
  const [cart, setCart] = useState<StoreCart | null>(null),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [cartState, setCartState] = useState<'loading' | 'ready' | 'guest' | 'unavailable'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void readCart(controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) {
            setCart(next);
            setCartState('ready');
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setCart(null);
            setCartState(
              error instanceof CartAccessError && error.status === 401 ? 'guest' : 'unavailable',
            );
          }
        });
    };
    refresh();
    window.addEventListener(cartChanged, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener(cartChanged, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [pathname]);
  async function mutate(id: string, quantity: number, product?: CatalogProduct) {
    if (lock.current) return;
    lock.current = true;
    setBusy(id);
    setNotice('');
    try {
      const updated = await writer.current((c) => {
        let items = activeCartItems(c).map((i) => ({
          listingId: i.listingId,
          revision: i.savedRevision,
          quantity: i.quantity,
        }));
        const old = items.find((i) => i.listingId === id);
        if (product) {
          if (old) {
            old.quantity = Math.min(999, old.quantity + quantity);
            old.revision = product.revision;
          } else items.push({ listingId: id, revision: product.revision, quantity });
        } else {
          items = items
            .map((i) => (i.listingId === id ? { ...i, quantity } : i))
            .filter((i) => i.quantity > 0);
        }
        return { items };
      });
      setCart(updated);
      setCartState('ready');
      setNotice(locale === 'ar' ? 'تم تحديث السلة' : 'Cart updated');
      router.refresh();
    } catch (error) {
      if (error instanceof CartAccessError && error.status === 401)
        router.push('/' + locale + '/login');
      else
        setNotice(
          locale === 'ar'
            ? 'تعذر تأكيد التغيير. أعد المحاولة.'
            : 'Change unconfirmed. Please retry.',
        );
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  return {
    cart,
    cartState,
    lines: cart
      ? activeCartItems(cart).map((i) => ({ productId: i.listingId, quantity: i.quantity }))
      : [],
    busy,
    notice,
    setNotice,
    add: (p: CatalogProduct, q: number) => void mutate(p.id, q, p),
    change: (id: string, q: number) => void mutate(id, q),
  };
}
