import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { driverDictionary } from '@/i18n/driver';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import { getDriverTrip } from '@/infrastructure/driver/service';
import { DriverAccessError } from '@/components/driver/access';
import { DriverNavigation, driverTime } from '@/components/driver/views';
import {
  DriverExecution,
  DriverIssueForm,
  DriverPodForm,
  PrivateEvidence,
} from '@/components/driver/execution';
import { Alert, Badge } from '@/components/ui/primitives';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  let trip;
  try {
    trip = await getDriverTrip(id);
  } catch (error) {
    return <DriverAccessError locale={locale} error={error} />;
  }
  const t = driverDictionary(locale),
    ot = operationsDictionary(locale),
    completed = trip.status === 'COMPLETED';
  return (
    <div className="container page driver-shell">
      <DriverNavigation locale={locale} tripId={trip.id} />
      <h1>{trip.reference}</h1>
      <Badge>{operationalStatus(trip.status, locale)}</Badge>
      <p>
        {locale === 'ar' ? trip.market.nameAr : trip.market.nameEn} ·{' '}
        {driverTime(trip.plannedStart, trip, locale)}
      </p>
      <p>
        {t.vehicle}: <bdi>{trip.vehicle.identifier}</bdi>
      </p>
      {completed && <Alert>{t.history}</Alert>}
      {trip.contact && (
        <section>
          <h2>{t.contact}</h2>
          <p>{trip.contact.name}</p>
          <bdi>{trip.contact.phone}</bdi>
        </section>
      )}
      <h2>{t.stops}</h2>
      <ol className="driver-stops">
        {trip.stops.map((stop) => (
          <li key={stop.id} className="card">
            <h3>
              {stop.kind === 'PICKUP' ? ot.pickup : ot.delivery} {stop.position}
            </h3>
            <Badge>{operationalStatus(stop.status, locale)}</Badge>
            {stop.address && <p>{stop.address}</p>}
            {stop.instructions && (
              <p>
                {t.instructions}: {stop.instructions}
              </p>
            )}
            {stop.completedAt && (
              <time dateTime={stop.completedAt}>{driverTime(stop.completedAt, trip, locale)}</time>
            )}
          </li>
        ))}
      </ol>
      {!completed && (
        <DriverExecution key={`execution-${trip.revision}`} trip={trip} locale={locale} />
      )}
      <section>
        <h2>{t.issues}</h2>
        {trip.issues.length === 0 ? (
          <p>{t.empty}</p>
        ) : (
          trip.issues.map((issue) => (
            <article key={issue.id}>
              <h3>{t.categories[issue.category]}</h3>
              <p>{issue.reason}</p>
              <Badge>{issue.status === 'OPEN' ? t.pending : t.resolved}</Badge>
              {issue.photoState === 'FINAL' && (
                <PrivateEvidence kind="issue" id={issue.id} locale={locale} />
              )}
            </article>
          ))
        )}
      </section>
      {!completed && trip.stops.some((s) => s.status !== 'COMPLETED') && (
        <DriverIssueForm key={`issues-${trip.revision}`} trip={trip} locale={locale} />
      )}{' '}
      {trip.pod?.state === 'FINAL' ? (
        <Alert tone="success">{t.podDone}</Alert>
      ) : (
        !completed &&
        trip.status === 'DELIVERED' &&
        !trip.attention && <DriverPodForm trip={trip} locale={locale} />
      )}
    </div>
  );
}
