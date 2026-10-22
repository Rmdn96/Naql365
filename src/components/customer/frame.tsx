'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import type { PublicCountry } from '@/domain/markets/public-contact';
import { BrandLink } from '@/components/shell/brand-link';
import { LocaleLink } from '@/components/shell/locale-link';
import { MarketSelector } from '@/components/shell/market-selector';
import { ThemeControl } from '@/components/shell/theme-control';
import { CartLink } from '@/components/store/cart-link';
import { DesignFoundation } from '@/components/design-system/foundation';
import { CustomerWorkspaceNav } from '@/components/ui/customer-workspace';
import { isCustomerPath } from './paths';

/** Original CustomerPreview shell, with real links/preferences instead of lab view state. */
export function CustomerFrame({
  locale,
  country,
  themeMode,
  children,
}: {
  locale: Locale;
  country: PublicCountry;
  themeMode: 'light' | 'dark' | 'system';
  children: ReactNode;
}) {
  const path = usePathname();
  if (!isCustomerPath(path)) return children;
  const ar = locale === 'ar';
  const current = path.includes('/requests')
    ? 'requests'
    : path.includes('/quotes')
      ? 'quotes'
      : path.replace(/\/$/, '') === `/${locale}/account`
        ? 'account'
        : undefined;
  return (
    <DesignFoundation family="customer" className="cx customer-workspace transport-experience">
      <a className="skip-link" href="#customer-content">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <header className="cx-top">
        <Link href={`/${locale}`}>{ar ? 'الصفحة الرئيسية' : 'Homepage'}</Link>
        <Link href={`/${locale}/request`}>{ar ? 'طلب نقل جديد' : 'New transport request'}</Link>
        <div className="cx-top-controls">
          <MarketSelector country={country} locale={locale} id="customer-market" />
          <ThemeControl locale={locale} initialMode={themeMode} />
          <LocaleLink locale={locale} label={ar ? 'English' : 'العربية'} />
          <CartLink locale={locale} />
        </div>
      </header>
      <div className="cx-shell">
        <aside className="cx-nav">
          <BrandLink
            locale={locale}
            href={`/${locale}/account`}
            label={ar ? 'نقل 365 — حسابي' : 'Naql365 — My account'}
            size="customer"
          />
          <CustomerWorkspaceNav locale={locale} {...(current ? { current } : {})} />
        </aside>
        <div className="cx-main" id="customer-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </DesignFoundation>
  );
}
