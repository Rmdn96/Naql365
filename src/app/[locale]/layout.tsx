import type { Metadata } from 'next';
import { Alexandria, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { isLocale, direction, locales } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { PublicChrome } from '@/components/shell/public-chrome';
import { HistoryRefresh } from '@/components/shell/history-refresh';
import { Header, Footer } from '@/components/shell/public-shell';
import { appUrl } from '@/infrastructure/config/server-env';
import { cookies, headers } from 'next/headers';
import { preventIndexing } from '@/infrastructure/config/deployment-env';
import '../globals.css';
import '../../styles/stage1.css';
import '../../styles/customer-experience.css';
import '../../styles/staff-experience.css';
import '../../styles/customer-v2.css';
import '../../styles/staff-v2.css';
import '../../styles/driver-v2.css';
const arabic = Alexandria({ subsets: ['arabic'], display: 'swap', variable: '--font-arabic' });
const english = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-english' });

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
    ...(preventIndexing() ? { robots: { index: false, follow: false } } : {}),
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
  const theme = (await cookies()).get('naql365_theme')?.value;
  const themeMode = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      dir={direction(locale)}
      className={`${arabic.variable} ${english.variable}`}
      data-theme={themeMode}
    >
      <body>
        <HistoryRefresh />
        <PublicChrome>
          <Header locale={locale} themeMode={themeMode} />
        </PublicChrome>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <PublicChrome>
          <Footer locale={locale} />
        </PublicChrome>
      </body>
    </html>
  );
}
