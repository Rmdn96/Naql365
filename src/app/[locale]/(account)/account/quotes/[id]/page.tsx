import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { quotesDictionary, quoteStatusLabel } from '@/i18n/quotes';
import { customerQuoteDetails } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { Alert, Badge, Table } from '@/components/ui/primitives';
import { formatMoney } from '@/domain/markets/model';
import { QuoteActions } from '@/components/pricing/quote-actions';
import { operationsDictionary } from '@/i18n/operations';
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
    <div className="container page narrow">
      <Link href={`/${locale}/account/quotes`}>{t.back}</Link>
      <div className="wizard-top">
        <h1>{t.quoteDetails}</h1>
        <Badge>{quoteStatusLabel(quote.status, locale)}</Badge>
      </div>
      <p className="request-reference" dir="ltr">
        {quote.quotes?.reference}
      </p>
      {quote.status === 'ACCEPTED' && quote.orders[0]?.id && (
        <p>
          <Link href={`/${locale}/account/orders/${quote.orders[0].id}`}>
            {operationsDictionary(locale).tracking}
          </Link>
        </p>
      )}
      <p>
        {locale === 'ar' ? request?.markets?.name_ar : request?.markets?.name_en} ·{' '}
        <bdi>{quote.currency}</bdi>
      </p>
      <p>
        {t.relatedRequest}: <bdi>{request?.reference}</bdi>
      </p>
      {quote.status === 'ACCEPTED' && quote.orders[0]?.reference && (
        <Alert tone="success">
          {t.accepted} {t.orderCreated}: <bdi>{quote.orders[0].reference}</bdi>
        </Alert>
      )}
      <p>
        {t.service}: {locale === 'ar' ? request?.services?.name_ar : request?.services?.name_en}
      </p>
      <p>
        {t.route}:{' '}
        {['pickup', 'delivery']
          .map(
            (kind) =>
              request?.request_locations.find((location) => location.kind === kind)?.city ?? '—',
          )
          .join(' → ')}
      </p>
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
            <bdi key="a">{formatMoney(line.total_amount_minor, quote.currency, locale)}</bdi>,
          ])}
      />
      <dl className="commercial-summary">
        <dt>{t.finalSubtotal}</dt>
        <dd>
          <bdi>{formatMoney(quote.final_subtotal_minor, quote.currency, locale)}</bdi>
        </dd>
        <dt>
          {(locale === 'ar' ? quote.tax_label_ar : quote.tax_label_en) ?? t.vat} (
          {quote.vat_rate_bps / 100}%)
        </dt>
        <dd>
          <bdi>{formatMoney(quote.vat_amount_minor, quote.currency, locale)}</bdi>
        </dd>
        <dt>{t.total}</dt>
        <dd>
          <bdi>{formatMoney(quote.total_minor, quote.currency, locale)}</bdi>
        </dd>
        <dt>{t.validUntil}</dt>
        <dd>
          <time dateTime={quote.expires_at ?? undefined}>
            {quote.expires_at
              ? new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: request?.markets?.timezone,
                }).format(new Date(quote.expires_at))
              : '—'}
          </time>
        </dd>
      </dl>
      {(quote.status === 'SENT' || quote.status === 'VIEWED') && (
        <QuoteActions locale={locale} quoteVersionId={id} />
      )}
    </div>
  );
}
