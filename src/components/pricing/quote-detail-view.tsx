import { JourneyRoute } from '@/components/ui/customer-journey';
import { customerExperience } from '@/i18n/customer-experience';
import Link from 'next/link';
import { MvpView } from '@/components/public/analytics';
import type { Locale } from '@/i18n/config';
import { quotesDictionary, quoteStatusLabel } from '@/i18n/quotes';
import type { customerQuoteDetails } from '@/infrastructure/pricing/service';
import { Alert, Badge, Table } from '@/components/ui/primitives';
import { formatMoney } from '@/domain/markets/model';
import { QuoteActions } from '@/components/pricing/quote-actions';
import { operationsDictionary } from '@/i18n/operations';
export function QuoteDetailView({
  locale,
  quote,
  guest = false,
}: {
  locale: Locale;
  quote: Awaited<ReturnType<typeof customerQuoteDetails>>;
  guest?: boolean;
}) {
  const t = quotesDictionary(locale);
  const request = quote.quotes?.requests;
  return (
    <div className="container page customer-experience quote-page">
      <MvpView
        event="final_quote_viewed"
        market={request?.markets?.country_code ?? ''}
        context="quote"
      />
      <Link
        href={
          guest
            ? `/${locale}/guest/requests/${quote.quotes?.request_id}`
            : `/${locale}/account/quotes`
        }
      >
        {t.back}
      </Link>
      <header className="page-heading">
        <div>
          <h1>{t.quoteDetails}</h1>
          <p className="page-description">{customerExperience(locale).quoteIntro}</p>
        </div>
        <Badge>{quoteStatusLabel(quote.status, locale)}</Badge>
      </header>
      <p className="request-reference" dir="ltr">
        {quote.quotes?.reference}
      </p>
      {quote.status === 'ACCEPTED' && quote.orders[0]?.id && (
        <p>
          <Link href={`/${locale}/${guest ? 'guest' : 'account'}/orders/${quote.orders[0].id}`}>
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
      <JourneyRoute
        locale={locale}
        pickup={request?.request_locations.find((l) => l.kind === 'pickup')?.city ?? ''}
        delivery={request?.request_locations.find((l) => l.kind === 'delivery')?.city ?? ''}
      />
      <div className="quote-layout">
        <section className="quote-lines">
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
        </section>
        <section className="quote-total">
          <h2>{customerExperience(locale).finalPrice}</h2>
          <p className="final-amount">
            <bdi>{formatMoney(quote.total_minor, quote.currency, locale)}</bdi>
          </p>
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
        </section>
      </div>
      {(quote.status === 'SENT' || quote.status === 'VIEWED') && (
        <QuoteActions
          locale={locale}
          quoteVersionId={quote.id}
          guest={guest}
          country={request?.markets?.country_code ?? ''}
        />
      )}
    </div>
  );
}
