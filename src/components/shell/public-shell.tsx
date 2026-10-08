import Link from 'next/link';
import { LocaleLink } from './locale-link';
import { MobileMenu } from './mobile-menu';
import { legalContent } from '@/domain/legal/content';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { MarketSelector } from './market-selector';
import { PublicContact } from './public-contact';
import { loginDestination } from '@/infrastructure/identity/login-destination';
import { getPublicEnv } from '@/infrastructure/config/public-env';

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

export async function Header({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const p = publicDictionary(locale);
  const country = await selectedPublicCountry();

  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link href={`/${locale}`} className="brand" aria-label={t.brand}>
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span dir="ltr">
              Naql<span>365</span>
            </span>
          </Link>
          <nav className="desktop-header-nav" aria-label={t.home}>
            <Link href={`/${locale}`}>{t.home}</Link>
            <Link className="desktop-nav" href={`/${locale}#services`}>
              {p.services}
            </Link>
            <Link className="desktop-nav" href={`/${locale}#how`}>
              {p.how}
            </Link>
            <Link className="desktop-nav" href={`/${locale}#tracking`}>
              {p.track}
            </Link>
            <Link className="desktop-nav" href={`/${locale}#contact`}>
              {p.contact}
            </Link>
            <IdentityLink locale={locale} />
            <Link className="button button--primary header-request" href={`/${locale}/request`}>
              {p.request}
            </Link>
            <LocaleLink locale={locale} label={t.language} />
          </nav>
          <div className="header-market">
            <MarketSelector country={country} locale={locale} />
          </div>
          <MobileMenu
            label={locale === 'ar' ? 'القائمة' : 'Menu'}
            close={locale === 'ar' ? 'إغلاق' : 'Close'}
          >
            <Link href={`/${locale}`}>{t.home}</Link>
            <Link href={`/${locale}#services`}>{p.services}</Link>
            <Link href={`/${locale}#how`}>{p.how}</Link>
            <Link href={`/${locale}#tracking`}>{p.track}</Link>
            <Link href={`/${locale}#contact`}>{p.contact}</Link>
            <IdentityLink locale={locale} />
            <LocaleLink locale={locale} label={t.language} />
            <Link className="button button--primary" href={`/${locale}/request`}>
              {p.request}
            </Link>
          </MobileMenu>
        </div>
      </header>
    </>
  );
}
export async function Footer({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const p = publicDictionary(locale);
  const country = await selectedPublicCountry();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>{t.rights}</p>
        <nav aria-label={t.positioning}>
          <Link href={`/${locale}/request`}>{p.request}</Link>
          <IdentityLink locale={locale} />
          <Link href={`/${locale}#contact`}>{p.contact}</Link>
          {(['privacy', 'terms'] as const).map((kind) => {
            const copy = legalContent(kind, locale);
            return copy ? (
              <Link key={kind} href={`/${locale}/legal/${kind}`}>
                {copy.title}
              </Link>
            ) : null;
          })}
        </nav>
      </div>
      <PublicContact country={country} locale={locale} />
    </footer>
  );
}
