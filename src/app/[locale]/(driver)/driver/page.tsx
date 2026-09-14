import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import Link from 'next/link';
import { getDriverTrips } from '@/infrastructure/driver/service';
import { DriverAccessError } from '@/components/driver/access';
import { DriverTripCard, DriverNavigation } from '@/components/driver/views';
import { driverDictionary } from '@/i18n/driver';
import { driverViews } from '@/domain/driver/model';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; offset?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const view = driverViews.find((v) => v === query.view) ?? 'today';
  const raw = Number(query.offset ?? 0),
    offset = Number.isInteger(raw) && raw >= 0 && raw <= 10000 ? raw : 0;
  let trips;
  try {
    trips = await getDriverTrips(view, offset);
  } catch (error) {
    return <DriverAccessError error={error} locale={locale} />;
  }
  const t = driverDictionary(locale);
  return (
    <div className="container page driver-shell">
      <DriverNavigation locale={locale} view={view} />
      <h1>{t[view]}</h1>
      <p>{t.online}</p>
      {trips.length === 0 && <p role="status">{t.empty}</p>}
      <div className="stack">
        {trips.map((trip) => (
          <DriverTripCard key={trip.id} trip={trip} locale={locale} />
        ))}
      </div>
      <nav className="customer-links" aria-label={t.completed}>
        {offset > 0 && (
          <Link href={`/${locale}/driver?view=${view}&offset=${Math.max(0, offset - 20)}`}>
            {t.previous}
          </Link>
        )}
        {trips.length === 20 && offset < 10000 && (
          <Link href={`/${locale}/driver?view=${view}&offset=${offset + 20}`}>{t.next}</Link>
        )}
      </nav>
    </div>
  );
}
