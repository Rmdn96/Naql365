import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { customerProgress } from '@/infrastructure/operations/service';
import { getPayment } from '@/infrastructure/payments/service';
import { AppError } from '@/domain/shared/errors';
import { OrderProgress } from '@/components/orders/progress';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  let data, payment;
  try {
    [data, payment] = await Promise.all([customerProgress(id, true), getPayment(id, true)]);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/guest`);
    if (error instanceof AppError && ['forbidden', 'not_found'].includes(error.code)) notFound();
    throw error;
  }
  return <OrderProgress data={data} payment={payment} locale={locale} guest={true} />;
}
