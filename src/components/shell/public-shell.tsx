import Link from 'next/link';
import { legalContent } from '@/domain/legal/content';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { MarketSelector } from './market-selector';
import { PublicContact } from './public-contact';

export async function Header({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const p = publicDictionary(locale);
  const country = await selectedPublicCountry();
  const other = locale === 'ar' ? 'en' : 'ar';
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
          <nav aria-label={t.home}>
            <Link className="desktop-nav" href={`/${locale}#services`}>
              {p.services}
            </Link>
            <Link className="desktop-nav" href={`/${locale}#how`}>
              {p.how}
            </Link>
            <Link className="desktop-nav" href={`/${locale}#tracking`}>
              {p.track}
            </Link>
            <MarketSelector country={country} locale={locale} />
            <Link className="desktop-nav" href={`/${locale}/login`} prefetch={false}>
              {p.signIn}
            </Link>
            <Link className="button button--primary header-request" href={`/${locale}/request`}>
              {p.request}
            </Link>
            <Link className="language-link" href={`/${other}`} lang={other} hrefLang={other}>
              {t.language}
              <span aria-hidden="true"> ↗</span>
            </Link>
          </nav>
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
          <Link href={`/${locale}/login`} prefetch={false}>
            {p.signIn}
          </Link>
          <Link href={`/${locale}#contact`}>{p.contact}</Link>
          {(['privacy', 'terms'] as const).map((kind) => {
            const copy = legalContent(kind, locale);
            return copy ? (
              <Link key={kind} href={`/${locale}/legal/${kind}`}>
                {copy.title}
              </Link>
            ) : null;
          })}
          <Link href={`/${locale}/portal`} prefetch={false}>
            {t.portal}
          </Link>
          <Link href={`/${locale}/driver`} prefetch={false}>
            {t.driver}
          </Link>
        </nav>
      </div>
      <PublicContact country={country} locale={locale} />
    </footer>
  );
}
