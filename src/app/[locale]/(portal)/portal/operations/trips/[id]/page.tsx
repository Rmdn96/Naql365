import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { operationsDictionary, operationalStatus, operationLabel } from '@/i18n/operations';
import { payloadSchemas, type OperationAction } from '@/domain/operations/model';
import { operationalTrip } from '@/infrastructure/operations/service';
import { AppError } from '@/domain/shared/errors';
import { Badge } from '@/components/ui/primitives';
import { TripPlanner } from '@/components/operations/planner';
import { TripControls } from '@/components/operations/trip-controls';
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
    data = await operationalTrip(id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && ['forbidden', 'not_found'].includes(error.code)) notFound();
    throw error;
  }
  return (
    <div className="container page operations">
      <Link href={`/${locale}/portal/operations/jobs/${data.trip.job_id}`}>{t.job}</Link>
      <h1>
        <bdi>{data.trip.reference}</bdi>
      </h1>
      <Badge>{operationalStatus(data.trip.status, locale)}</Badge>
      <p>{t.requiredStops}</p>
      {!data.trip.started_at && !['CANCELLED', 'FAILED', 'COMPLETED'].includes(data.trip.status) ? (
        <TripPlanner key={`plan-${data.trip.revision}`} locale={locale} data={data} />
      ) : (
        <section>
          <h2>{t.stops}</h2>
          <ol>
            {data.stops.map((s) => (
              <li key={s.id}>
                {s.kind === 'PICKUP' ? t.pickup : t.delivery} — {s.address}{' '}
                <Badge>{operationalStatus(s.status, locale)}</Badge>
              </li>
            ))}
          </ol>
        </section>
      )}
      <TripControls key={`controls-${data.trip.revision}`} locale={locale} data={data} />
      <section>
        <h2>{t.events}</h2>
        <ol>
          {data.events.map((e) => {
            const action = e.event_type.toLowerCase();
            return (
              <li key={e.id}>
                {action in payloadSchemas
                  ? operationLabel(action as OperationAction, locale)
                  : e.event_type === 'POD_CAPTURED'
                    ? t.pod
                    : t.createTrip}{' '}
                — {t.staffEvent} —{' '}
                <time dateTime={e.occurred_at}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Riyadh',
                  }).format(new Date(e.occurred_at))}
                </time>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
