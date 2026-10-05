import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { customerQuoteDetails } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { QuoteDetailView } from '@/components/pricing/quote-detail-view';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  let quote;
  try {
    quote = await customerQuoteDetails(id, true, true);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/guest`);
    if (error instanceof AppError && (error.code === 'forbidden' || error.code === 'not_found'))
      notFound();
    throw error;
  }
  return <QuoteDetailView locale={locale} quote={quote} guest />;
}
