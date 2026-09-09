import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, direction, locales } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { Header, Footer } from '@/components/shell/public-shell';
import { appUrl } from '@/infrastructure/config/server-env';
import { headers } from 'next/headers';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dictionary(locale);
  return {
    metadataBase: appUrl(),
    title: { default: `${t.brand} | ${t.positioning}`, template: `%s | ${t.brand}` },
    description: t.description,
  };
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await headers(); // Per-request CSP nonces require dynamic rendering.
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={direction(locale)}>
      <body>
        <Header locale={locale} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
