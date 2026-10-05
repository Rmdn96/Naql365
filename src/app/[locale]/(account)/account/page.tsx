import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { CustomerAccount } from '@/components/requests/account';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ profile?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CustomerAccount locale={locale} saved={(await searchParams).profile === 'saved'} />;
}
