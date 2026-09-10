import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { quotesDictionary } from '@/i18n/quotes';
import { customerQuoteDetails } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { Alert, Badge, Table } from '@/components/ui/primitives';
import { formatSar } from '@/domain/pricing/model';
import { QuoteActions } from '@/components/pricing/quote-actions';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = quotesDictionary(locale);
  let quote;
  try {
    quote = await customerQuoteDetails(id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && (error.code === 'forbidden' || error.code === 'not_found'))
      notFound();
    throw error;
  }
  const request = quote.quotes?.requests;
  return (
    <main className="container page narrow">
      <Link href={`/${locale}/account/quotes`}>{t.back}</Link>
      <div className="wizard-top">
        <h1>{t.quoteDetails}</h1>
        <Badge>{quote.status}</Badge>
      </div>
      <p className="request-reference" dir="ltr">
        {quote.quotes?.reference}
      </p>
      <p>
        {t.relatedRequest}: <bdi>{request?.reference}</bdi>
      </p>
      {quote.status === 'ACCEPTED' && quote.orders[0]?.reference && (
        <Alert tone="success">
          {t.accepted} {t.orderCreated}: <bdi>{quote.orders[0].reference}</bdi>
        </Alert>
      )}
      <p>{request?.request_locations.map((l) => l.city).join(' → ')}</p>
      <p>
        {t.distanceKm}: <bdi>{quote.distance_km} km</bdi> · {t.manualVerified}
      </p>
      <Table
        caption={t.quoteDetails}
        columns={[t.breakdown, t.quantity, t.amount]}
        rows={[...quote.quote_items]
          .sort((a, b) => a.position - b.position)
          .map((line) => [
            locale === 'ar' ? line.label_ar : line.label_en,
            <bdi key="q">{line.quantity}</bdi>,
            <bdi key="a">{formatSar(line.total_amount_minor, locale)}</bdi>,
          ])}
      />
      <dl className="commercial-summary">
        <dt>{t.finalSubtotal}</dt>
        <dd>
          <bdi>{formatSar(quote.final_subtotal_minor, locale)}</bdi>
        </dd>
        <dt>
          {t.vat} ({quote.vat_rate_bps / 100}%)
        </dt>
        <dd>
          <bdi>{formatSar(quote.vat_amount_minor, locale)}</bdi>
        </dd>
        <dt>{t.total}</dt>
        <dd>
          <bdi>{formatSar(quote.total_minor, locale)}</bdi>
        </dd>
        <dt>{t.validUntil}</dt>
        <dd>
          <time dateTime={quote.expires_at ?? undefined}>
            {quote.expires_at
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Asia/Riyadh',
                }).format(new Date(quote.expires_at))
              : '—'}
          </time>
        </dd>
      </dl>
      {(quote.status === 'SENT' || quote.status === 'VIEWED') && (
        <QuoteActions locale={locale} quoteVersionId={id} />
      )}
    </main>
  );
}
