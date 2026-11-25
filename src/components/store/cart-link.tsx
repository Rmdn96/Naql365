'use client';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useGuestBasket } from './guest-basket';
export function CartLink({ locale }: { locale: 'ar' | 'en' }) {
  const { lines } = useGuestBasket();
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Link href={'/' + locale + '/store/cart'} className="commerce-cart" prefetch={false}>
      <ShoppingCart size={19} aria-hidden="true" />
      {locale === 'ar' ? 'السلة' : 'Cart'}{' '}
      <span aria-live="polite" className="commerce-cart-badge">
        {quantity}
      </span>
    </Link>
  );
}
