import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { appUrl } from '@/infrastructure/config/server-env';
import { headers } from 'next/headers';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const t = dictionary(locale);
  return { alternates: { canonical: `/${locale}`, languages: { ar: '/ar', en: '/en', 'x-default': '/ar' } }, openGraph: { type: 'website', siteName: 'Naql365', title: t.brand, description: t.description, url: `/${locale}`, locale: locale === 'ar' ? 'ar_SA' : 'en_US', alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA' } };
}
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const t = dictionary(locale);
  const schema = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Naql365', alternateName: 'نقل 365', url: appUrl().origin, inLanguage: ['ar','en'] };
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <><script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} /><section className="hero container"><div className="hero-grid"><div><p className="eyebrow">{t.positioning}</p><h1>{t.message}</h1><p className="hero-copy">{t.introBody}</p><p className="hero-footnote">{t.foundation}</p></div><aside className="journey" aria-label={t.journey}><h2>{t.journey}</h2><ol>{[t.request,t.quote,t.order,t.job,t.trip].map((step,index)=><li key={step}><span className="step-number" aria-hidden="true">0{index+1}</span><span>{step}</span><span className="step-line" aria-hidden="true" /></li>)}</ol></aside></div></section><section className="principles container" aria-label={t.intro}>{[[t.clarity,t.clarityBody],[t.control,t.controlBody],[t.ready,t.readyBody]].map(([title,body],index)=><article key={title}><span className="principle-number" aria-hidden="true">0{index+1} /</span><h2>{title}</h2><p>{body}</p></article>)}</section></>;
}
