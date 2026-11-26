import seo from '@/i18n/commercial-quote-seo.json';
import { quoteMode } from '@/infrastructure/store/quotes';
import { homeStep } from '@/infrastructure/markets/home-trace';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';
import { CommerceSurface } from '@/components/lovable/surface';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { appUrl } from '@/infrastructure/config/server-env';
import { headers } from 'next/headers';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dictionary(locale);
  const copy = quoteMode() ? seo.home[locale] : { title: t.brand, description: t.description };
  return {
    ...(quoteMode() ? { title: { absolute: copy.title }, description: copy.description } : {}),
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: '/ar', en: '/en', 'x-default': '/ar' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Naql365',
      ...copy,
      url: `/${locale}`,
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_EG',
    },
  };
}
export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  catalogTrace({ stage: 'home-entry', outcome: 'started' });
  const locale = await homeStep('home-locale', async () => {
    const { locale } = await params;
    catalogTrace({ stage: 'home-locale', locale: isLocale(locale) ? locale : 'invalid' });
    if (!isLocale(locale)) notFound();
    return locale;
  });
  const raw = await searchParams;
  const query = {
    ...(typeof raw.search === 'string' ? { search: raw.search.slice(0, 120) } : {}),
    ...(typeof raw.category === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(raw.category)
      ? { category: raw.category }
      : {}),
    ...(typeof raw.after === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(raw.after)
      ? { after: raw.after }
      : {}),
  };
  return homeStep('home-compose', async () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Naql365',
      alternateName: 'نقل 365',
      url: appUrl().origin,
      inLanguage: ['ar', 'en'],
    };
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    return (
      <>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
        <CommerceSurface locale={locale} query={query} />
      </>
    );
  });
}
