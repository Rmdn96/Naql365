import Link from 'next/link';
import { Hand, Truck } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { dictionary } from '@/i18n/dictionaries';
import { driverDictionary } from '@/i18n/driver';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import { driverViews, type DriverTrip } from '@/domain/driver/model';
import { driverLogout } from '@/app/auth/driver-actions';
import { Card, Badge, Button } from '@/components/ui/primitives';
export function DriverNavigation({
  locale,
  view,
  tripId,
}: {
  locale: Locale;
  view?: string;
  tripId?: string;
}) {
  const t = driverDictionary(locale);
  return (
    <div className="driver-toolbar">
      <nav className="driver-nav dx-tabs" aria-label={t.title}>
        {driverViews.map((v) => (
          <Link
            key={v}
            aria-current={view === v ? 'page' : undefined}
            href={`/${locale}/driver?view=${v}`}
          >
            {t[v]}
          </Link>
        ))}
        <Link
          lang={locale === 'ar' ? 'en' : 'ar'}
          href={`/${locale === 'ar' ? 'en' : 'ar'}/driver${tripId ? `/trips/${tripId}` : view ? `?view=${view}` : ''}`}
        >
          {dictionary(locale).language}
        </Link>
      </nav>
      <form action={driverLogout.bind(null, locale)}>
        <Button variant="secondary">{dictionary(locale).logout}</Button>
      </form>
    </div>
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
    <Card className="driver-trip-card dx-card">
      <header className="driver-trip-heading">
        <Truck size={18} aria-hidden="true" />
        <h2>
          <Link href={`/${locale}/driver/trips/${trip.id}`}>
            <bdi>{trip.reference}</bdi>
          </Link>
        </h2>
        <Badge>{operationalStatus(trip.status, locale)}</Badge>
      </header>
      <dl className="driver-facts dx-grid">
        <div>
          <dt>{t.market}</dt>
          <dd>{locale === 'ar' ? trip.market.nameAr : trip.market.nameEn}</dd>
        </div>
        <div>
          <dt>{t.schedule}</dt>
          <dd>{driverTime(trip.plannedStart, trip, locale)}</dd>
        </div>
        <div>
          <dt>{t.vehicle}</dt>
          <dd>
            <bdi>{trip.vehicle.identifier}</bdi>
          </dd>
        </div>
        <div>
          <dt>{t.progress}</dt>
          <dd>
            <bdi dir="ltr">
              {trip.stops.filter((s) => s.status === 'COMPLETED').length} / {trip.stops.length}
            </bdi>
          </dd>
        </div>
      </dl>
      {next && (
        <div className="driver-next-stop">
          <span>{t.nextStop}</span>
          <strong>{next.kind === 'PICKUP' ? ot.pickup : ot.delivery}</strong>
          {next.address && <p>{next.address}</p>}
        </div>
      )}
      {trip.attention && <p role="status">{t.attention}</p>}
      <Link className="button button--secondary" href={`/${locale}/driver/trips/${trip.id}`}>
        {t.open}
      </Link>
    </Card>
  );
}

export function DriverSafety({ locale }: { locale: Locale }) {
  return (
    <p className="driver-safety" role="note">
      <Hand size={16} aria-hidden="true" />
      {driverDictionary(locale).safety}
    </p>
  );
}
