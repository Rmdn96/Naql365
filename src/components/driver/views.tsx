import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { driverDictionary } from '@/i18n/driver';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import { driverViews, type DriverTrip } from '@/domain/driver/model';
import { driverLogout } from '@/app/auth/driver-actions';
import { Card, Badge, Button } from '@/components/ui/primitives';
export function DriverNavigation({ locale, view }: { locale: Locale; view?: string }) {
  const t = driverDictionary(locale);
  return (
    <>
      <nav className="driver-nav" aria-label={t.title}>
        {driverViews.map((v) => (
          <Link
            key={v}
            aria-current={view === v ? 'page' : undefined}
            href={`/${locale}/driver?view=${v}`}
          >
            {t[v]}
          </Link>
        ))}
      </nav>
      <form action={driverLogout.bind(null, locale)}>
        <Button variant="secondary">{dictionary(locale).logout}</Button>
      </form>
    </>
  );
}
export function driverTime(value: string | null, trip: DriverTrip, locale: Locale) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        timeZone: trip.market.timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : driverDictionary(locale).unscheduled;
}
export function DriverTripCard({ trip, locale }: { trip: DriverTrip; locale: Locale }) {
  const t = driverDictionary(locale),
    ot = operationsDictionary(locale),
    next = trip.stops.find((s) => s.status !== 'COMPLETED');
  return (
    <Card>
      <h2>
        <Link href={`/${locale}/driver/trips/${trip.id}`}>{trip.reference}</Link>
      </h2>
      <Badge>{operationalStatus(trip.status, locale)}</Badge>
      <p>
        {t.market}: {locale === 'ar' ? trip.market.nameAr : trip.market.nameEn}
      </p>
      <p>
        {t.schedule}: {driverTime(trip.plannedStart, trip, locale)}
      </p>
      <p>
        {t.vehicle}: <bdi>{trip.vehicle.identifier}</bdi>
      </p>
      <p>
        {t.progress}: {trip.stops.filter((s) => s.status === 'COMPLETED').length} /{' '}
        {trip.stops.length}
      </p>
      {next && (
        <p>
          {next.kind === 'PICKUP' ? ot.pickup : ot.delivery}: {next.address}
        </p>
      )}
      {trip.attention && <p role="status">{t.attention}</p>}
      <Link className="button button--secondary" href={`/${locale}/driver/trips/${trip.id}`}>
        {t.open}
      </Link>
    </Card>
  );
}
