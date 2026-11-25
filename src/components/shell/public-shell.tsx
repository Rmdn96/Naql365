import Link from 'next/link';
import { TransportFooterLinks } from '@/components/transport/footer-links';
import { LocaleLink } from './locale-link';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { BrandLink } from './brand-link';
import { ThemeControl } from './theme-control';
import { StoreSearch } from '@/components/store/search';
import { CartLink } from '@/components/store/cart-link';
import { ContactLinks } from './contact-links';

export function Header({
  locale,
  themeMode,
}: {
  locale: Locale;
  themeMode: 'light' | 'dark' | 'system';
}) {
  const ar = locale === 'ar';
  return (
    <>
      <a className="skip-link" href="#main">
        {dictionary(locale).skip}
      </a>
      <header className="launch-header">
        <div className="launch-header-inner">
          <BrandLink href={`/${locale}`} locale={locale} label={dictionary(locale).brand} />
          <StoreSearch locale={locale} />
          <div className="launch-header-tools">
            <LocaleLink locale={locale} label={ar ? 'English' : 'العربية'} />
            <ThemeControl locale={locale} initialMode={themeMode} />
          </div>
          <nav className="launch-main-nav" aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
            <Link href={`/${locale}`}>{ar ? 'الرئيسية' : 'Home'}</Link>
            <CartLink locale={locale} />
            <Link href={`/${locale}/request`}>{ar ? 'طلب نقل' : 'Request transport'}</Link>
            <Link href={`/${locale}#contact`}>{ar ? 'تواصل معنا' : 'Contact us'}</Link>
          </nav>
        </div>
      </header>
      <aside className="launch-quick-contact" aria-label={ar ? 'التواصل السريع' : 'Quick contact'}>
        <ContactLinks locale={locale} compact />
      </aside>
    </>
  );
}
export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="launch-footer">
      <div className="launch-footer-inner">
        <BrandLink
          href={`/${locale}`}
          locale={locale}
          label={dictionary(locale).brand}
          size="mobile"
        />
        <nav aria-label={locale === 'ar' ? 'روابط التذييل' : 'Footer links'}>
          <Link href={`/${locale}`}>{locale === 'ar' ? 'المتجر' : 'Shop'}</Link>
          <Link href={`/${locale}/request`}>{locale === 'ar' ? 'النقل' : 'Transport'}</Link>
          <TransportFooterLinks locale={locale} />
          <ContactLinks locale={locale} footer />
        </nav>
        <small>{dictionary(locale).rights}</small>
      </div>
    </footer>
  );
}
