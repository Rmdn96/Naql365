import { Landing } from '@/components/public/landing';
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
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [country, catalogue] = await Promise.all([selectedPublicCountry(), publicCatalogue()]);
  const services = catalogue.find((m) => m.country === country)?.services ?? [];
  const cities = catalogue.find((m) => m.country === country)?.cities ?? [];
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
      <Landing locale={locale} country={country} services={services} cities={cities} />
    </>
  );
}
