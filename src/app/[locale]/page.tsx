import { homeStep } from '@/infrastructure/markets/home-trace';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';
import { CommerceSurface } from '@/components/lovable/surface';
import { selectedPublicCountry, publicCatalogue } from '@/infrastructure/markets/public';
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
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: '/ar', en: '/en', 'x-default': '/ar' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Naql365',
      title: t.brand,
      description: t.description,
      url: `/${locale}`,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
    },
  };
}
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  catalogTrace({ stage: 'home-entry', outcome: 'started' });
  const locale = await homeStep('home-locale', async () => {
    const { locale } = await params;
    catalogTrace({ stage: 'home-locale', locale: isLocale(locale) ? locale : 'invalid' });
    if (!isLocale(locale)) notFound();
    return locale;
  });
  const [country] = await Promise.all([
    homeStep('home-market', selectedPublicCountry),
    homeStep('home-catalogue', publicCatalogue),
  ]);
  catalogTrace({ stage: 'home-market', country });
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
        <CommerceSurface locale={locale} />
      </>
    );
  });
}
