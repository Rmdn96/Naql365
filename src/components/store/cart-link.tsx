'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CartAccessError, activeCartItems, cartChanged, readCart } from './cart-client';

export function CartLink({ locale }: { locale: 'ar' | 'en' }) {
  const pathname = usePathname();
  const [quantity, setQuantity] = useState<number | null>(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active: AbortController | undefined;
    async function refresh() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      try {
        const cart = await readCart(controller.signal);
        if (controller.signal.aborted) return;
        setQuantity(activeCartItems(cart).reduce((n, item) => n + item.quantity, 0));
        setState('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setQuantity(error instanceof CartAccessError && error.status === 401 ? 0 : null);
        setState(
          error instanceof CartAccessError && error.status === 401 ? 'guest' : 'unavailable',
        );
      }
    }
    void refresh();
    const refreshCart = () => void refresh();
    window.addEventListener(cartChanged, refreshCart);
    window.addEventListener('focus', refreshCart);
    return () => {
      active?.abort();
      window.removeEventListener(cartChanged, refreshCart);
      window.removeEventListener('focus', refreshCart);
    };
  }, [pathname]);
  const label = locale === 'ar' ? 'السلة' : 'Cart';
  const hint =
    state === 'guest'
      ? locale === 'ar'
        ? 'سجّل الدخول للسلة'
        : 'Sign in for your cart'
      : state === 'unavailable'
        ? locale === 'ar'
          ? 'السلة غير متاحة حاليًا'
          : 'Cart currently unavailable'
        : label;
  return (
    <Link
      href={`/${locale}/store/cart`}
      prefetch={false}
      className="commerce-cart"
      aria-label={`${label} (${quantity ?? '—'}) — ${hint}`}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          d="M2 3h3l3 12h10l3-9H6M9 20h.01M18 20h.01"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="commerce-cart-badge" aria-live="polite" aria-busy={state === 'loading'}>
        {quantity ?? (state === 'loading' ? '…' : '—')}
      </span>
    </Link>
  );
}
