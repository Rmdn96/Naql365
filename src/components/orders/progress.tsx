import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { customerProgress } from '@/infrastructure/operations/service';
import type { PaymentDetails } from '@/domain/payments/model';
import { InAppNotifications } from '@/components/tracking/notifications';
import { TrackingView } from '@/components/tracking/view';
import { formatMoney } from '@/domain/markets/model';
import { paymentDictionary } from '@/i18n/payments';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import { Badge, EmptyState } from '@/components/ui/primitives';
export function OrderProgress({
  data,
  payment,
  locale,
  guest = false,
}: {
  data: Awaited<ReturnType<typeof customerProgress>>;
  payment: PaymentDetails;
  locale: Locale;
  guest?: boolean;
}) {
  const t = operationsDictionary(locale);
  const id = data.id;
  const pt = paymentDictionary(locale);
  return (
    <div className="container page">
      <h1>{t.tracking}</h1>
      <p>
        {locale === 'ar' ? data.market.nameAr : data.market.nameEn} ·{' '}
        <bdi>{data.market.currency}</bdi>
      </p>
      <p>
        <bdi>{data.reference}</bdi>
      </p>
      <Badge>{operationalStatus(data.status, locale)}</Badge>
      <p>{t.trackingHelp}</p>
      <section aria-labelledby="payment-summary-title" className="card">
        <h2 id="payment-summary-title">{pt.title}</h2>
        <dl>
          <dt>{pt.method}</dt>
          <dd>
            {payment.method === 'CASH'
              ? pt.cash
              : payment.method === 'BANK_TRANSFER'
                ? pt.transfer
                : pt.states.PENDING}
          </dd>
          <dt>{pt.status}</dt>
          <dd>{pt.states[payment.status]}</dd>
          <dt>{pt.total}</dt>
          <dd>{formatMoney(payment.totalMinor, payment.currency, locale)}</dd>
          <dt>{pt.currency}</dt>
          <dd>
            <bdi>{payment.currency}</bdi>
          </dd>
        </dl>
      </section>
      <Link
        className="button button--primary"
        href={`/${locale}/${guest ? 'guest' : 'account'}/orders/${id}/payment`}
      >
        {paymentDictionary(locale).title}
      </Link>
      {!guest && <TrackingView locale={locale} orderId={id} />}
      {!guest && <InAppNotifications locale={locale} />}
      {data.trips.length ? (
        <ul className="request-list">
          {data.trips.map((trip, index) => (
            <li key={trip.reference ?? index}>
              <div>
                <h2>
                  <bdi>{trip.reference}</bdi>
                </h2>
                <Badge>{operationalStatus(trip.status, locale)}</Badge>
                <p>
                  {t.completedStops}: {trip.completedStops} / {trip.totalStops}
                </p>
                <p>{trip.podCaptured ? t.podCaptured : t.pendingPod}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t.trips}>{t.empty}</EmptyState>
      )}
    </div>
  );
}
