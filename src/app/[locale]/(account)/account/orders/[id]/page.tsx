import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import { customerProgress } from '@/infrastructure/operations/service';
import { AppError } from '@/domain/shared/errors';
import { Badge, EmptyState } from '@/components/ui/primitives';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = operationsDictionary(locale);
  let data;
  try {
    data = await customerProgress(id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && ['forbidden', 'not_found'].includes(error.code)) notFound();
    throw error;
  }
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
