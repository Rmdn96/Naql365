import Link from 'next/link';
import { dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export function Header({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const other = locale === 'ar' ? 'en' : 'ar';
  return <><a className="skip-link" href="#main">{t.skip}</a><header className="site-header"><div className="container header-inner"><Link href={`/${locale}`} className="brand" aria-label={t.brand}><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span dir="ltr">Naql<span>365</span></span></Link><nav aria-label={t.home}><Link href={`/${locale}/account`} prefetch={false}>{t.account}</Link><Link className="language-link" href={`/${other}`} lang={other} hrefLang={other}>{t.language}<span aria-hidden="true"> ↗</span></Link></nav></div></header></>;
}
export function Footer({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  return <footer className="site-footer"><div className="container footer-inner"><p>{t.rights}</p><nav aria-label={t.positioning}><Link href={`/${locale}/portal`} prefetch={false}>{t.portal}</Link><Link href={`/${locale}/driver`} prefetch={false}>{t.driver}</Link></nav></div></footer>;
}
