'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Truck, ShoppingBag, UserRound } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { PublicCountry } from '@/domain/markets/public-contact';
import { BrandLink } from '@/components/shell/brand-link';
import { LocaleLink } from '@/components/shell/locale-link';
import { MarketSelector } from '@/components/shell/market-selector';
import { ThemeControl } from '@/components/shell/theme-control';
import { MobileMenu } from '@/components/shell/mobile-menu';
import { CartLink } from '@/components/store/cart-link';
import { isTransportPath } from './paths';
import { isCustomerPath } from '@/components/customer/paths';

/** Lovable Transport header composition; canonical links/preferences, no demo state. */
export function TransportFrame({
  locale,
  country,
  themeMode,
  identity,
  footerLinks,
  children,
}: {
  locale: Locale;
  country: PublicCountry;
  themeMode: 'light' | 'dark' | 'system';
  identity: ReactNode;
  footerLinks: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  if (!isTransportPath(path) || isCustomerPath(path)) return children;
  const ar = locale === 'ar';
  const links = (
    <>
      <Link href={`/${locale}/transport`}>
        <Truck size={16} aria-hidden="true" />
        {ar ? 'خدمات النقل' : 'Transport'}
      </Link>
      <Link href={`/${locale}/store`}>
        <ShoppingBag size={16} aria-hidden="true" />
        {ar ? 'المتجر' : 'Store'}
      </Link>
      <span className="transport-identity">
        <UserRound size={16} aria-hidden="true" />
        {identity}
      </span>
      <Link href={`/${locale}/guest`}>{ar ? 'متابعة آمنة' : 'Secure continuation'}</Link>
    </>
  );
  return (
    <div className="transport-experience" data-design-family="public">
      <a className="skip-link" href="#transport-content">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <header className="transport-header">
        <div className="transport-header-inner">
          <BrandLink
            locale={locale}
            href={`/${locale}`}
            label={ar ? 'نقل 365 — الرئيسية' : 'Naql365 — Home'}
          />
          <nav
            className="transport-desktop-nav"
            aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}
          >
            {links}
          </nav>
          <div className="transport-controls">
            <MarketSelector country={country} locale={locale} id="transport-market" />
            <ThemeControl locale={locale} initialMode={themeMode} />
            <LocaleLink locale={locale} label={ar ? 'English' : 'العربية'} />
            <CartLink locale={locale} />
            <MobileMenu label={ar ? 'القائمة' : 'Menu'} close={ar ? 'إغلاق' : 'Close'}>
              {links}
            </MobileMenu>
          </div>
        </div>
      </header>
      <div className="transport-content" id="transport-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="transport-footer">
        <BrandLink
          locale={locale}
          href={`/${locale}`}
          label={ar ? 'نقل 365 — الرئيسية' : 'Naql365 — Home'}
          size="mobile"
        />
        <Link href={`/${locale}/request`}>{ar ? 'اطلب نقل' : 'Book Transport'}</Link>
        <Link href={`/${locale}/store`}>{ar ? 'مستلزمات التغليف' : 'Packing supplies'}</Link>
        {footerLinks}
      </footer>
    </div>
  );
}
