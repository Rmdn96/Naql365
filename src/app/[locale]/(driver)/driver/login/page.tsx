import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { driverDictionary } from '@/i18n/driver';
import { DriverLogin } from '@/components/driver/login';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = driverDictionary(locale);
  return (
    <div className="container page narrow">
      <h1>{t.login}</h1>
      <p>{t.loginHelp}</p>
      <DriverLogin locale={locale} />
    </div>
  );
}
