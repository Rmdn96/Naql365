import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import {
  LayoutDashboard,
  ListOrdered,
  Receipt,
  Package,
  ShoppingBag,
  ShoppingCart,
  UserRound,
} from 'lucide-react';

/** Navigation only; destination loaders retain Customer/session authorization. */
export function CustomerWorkspaceNav({
  locale,
  current,
}: {
  locale: Locale;
  current?: 'account' | 'requests' | 'quotes';
}) {
  const ar = locale === 'ar';
  return (
    <nav className="customer-workspace-nav" aria-label={ar ? 'مساحة العميل' : 'Customer workspace'}>
      <ul>
        {(
          [
            ['account', '', ar ? 'نظرة عامة' : 'Overview', LayoutDashboard],
            ['requests', '/requests', ar ? 'طلبات النقل' : 'Transport requests', ListOrdered],
            ['quotes', '/quotes', ar ? 'عروض السعر' : 'Quotes', Receipt],
            ['store', '/store/orders', ar ? 'طلبات المتجر' : 'Store orders', Package],
            ['profile', '#customer-profile', ar ? 'الملف الشخصي' : 'Profile', UserRound],
            ['shop', '/store', ar ? 'تسوّق مجددًا' : 'Shop again', ShoppingBag],
            ['cart', '/store/cart', ar ? 'السلة' : 'Cart', ShoppingCart],
          ] as const
        ).map(([key, path, label, Icon]) => (
          <li key={key}>
            <Link
              href={`/${locale}${path.startsWith('/store') ? path : '/account' + path}`}
              aria-current={current === key ? 'page' : undefined}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
