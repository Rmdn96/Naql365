import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { GuestExchange } from '@/components/guest/access';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <GuestExchange locale={locale} />;
}
