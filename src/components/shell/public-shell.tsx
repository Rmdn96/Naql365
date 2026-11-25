import Link from 'next/link';
import { TransportFooterLinks } from '@/components/transport/footer-links';
import { LocaleLink } from './locale-link';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
import { loginDestination } from '@/infrastructure/identity/login-destination';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { BrandLink } from './brand-link';
import { ThemeControl } from './theme-control';
import { StoreSearch } from '@/components/store/search';
import { CartLink } from '@/components/store/cart-link';
import { ContactLinks } from './contact-links';

export async function IdentityLink({ locale }: { locale: Locale }) {
  const destination = getPublicEnv() ? await loginDestination() : 'unauthenticated';
  const t = dictionary(locale);
  const label =
    destination === 'portal'
      ? t.portal
      : destination === 'driver'
        ? t.driver
        : destination === 'unauthenticated'
          ? publicDictionary(locale).signIn
          : locale === 'ar'
            ? 'حسابي'
            : 'My account';
  const route =
    destination === 'unauthenticated'
      ? 'login'
      : ['portal', 'driver', 'account'].includes(destination)
        ? destination
        : 'auth-complete';
  return (
    <Link className="identity-link" href={`/${locale}/${route}`} prefetch={false}>
      {label}
    </Link>
  );
}

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
            <IdentityLink locale={locale} />
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
    </>
  );
}
export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="launch-footer container">
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
    </footer>
  );
}
