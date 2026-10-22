import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { driverDictionary } from '@/i18n/driver';
import { DriverLogin } from '@/components/driver/login';
import { AuthExperience } from '@/components/auth/auth-experience';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = driverDictionary(locale);
  return (
    <AuthExperience locale={locale} title={t.login} intro={t.loginHelp}>
      <DriverLogin locale={locale} />
    </AuthExperience>
  );
}
