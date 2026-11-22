import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { House, Truck, ShoppingBag, UserRound } from 'lucide-react';

export type CustomerSection = 'home' | 'transport' | 'store' | 'account';

/** Navigation only; destination loaders retain Customer/session authorization. */
export function CustomerWorkspaceNav({
  locale,
  current,
}: {
  locale: Locale;
  current?: CustomerSection;
}) {
  const ar = locale === 'ar';
  return (
    <nav className="customer-workspace-nav" aria-label={ar ? 'مساحة العميل' : 'Customer workspace'}>
      <ul>
        {(
          [
            ['home', '/account', ar ? 'الرئيسية' : 'Home', House],
            ['transport', '/account/requests', ar ? 'النقل' : 'Transport', Truck],
            ['store', '/store', ar ? 'المتجر' : 'Store', ShoppingBag],
            ['account', '/account/profile', ar ? 'حسابي' : 'My account', UserRound],
          ] as const
        ).map(([key, path, label, Icon]) => (
          <li key={key}>
            <Link href={`/${locale}${path}`} aria-current={current === key ? 'page' : undefined}>
              <Icon aria-hidden="true" size={16} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
