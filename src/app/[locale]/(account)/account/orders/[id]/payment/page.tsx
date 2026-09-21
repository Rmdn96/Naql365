import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { paymentDictionary } from '@/i18n/payments';
import { getPayment } from '@/infrastructure/payments/service';
import { AppError } from '@/domain/shared/errors';
import { Checkout } from '@/components/payments/checkout';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  let data;
  try {
    data = await getPayment(id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && ['forbidden', 'not_found'].includes(error.code)) notFound();
    throw error;
  }
  return (
    <div className="container page">
      <h1>{paymentDictionary(locale).title}</h1>
      <Checkout data={data} locale={locale} />
    </div>
  );
}
