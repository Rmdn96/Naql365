import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import { operationalJob } from '@/infrastructure/operations/service';
import { AppError } from '@/domain/shared/errors';
import { Badge } from '@/components/ui/primitives';
import { OperationButton } from '@/components/operations/command';
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
    data = await operationalJob(id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && ['forbidden', 'not_found'].includes(error.code)) notFound();
    throw error;
  }
  const route = data.route;
  return (
    <main className="container page operations">
      <Link href={`/${locale}/portal/operations`}>{t.back}</Link>
      <h1>
        {t.job} <bdi>{data.job.reference}</bdi>
      </h1>
      <Badge>{operationalStatus(data.job.status, locale)}</Badge>
      <p>
        {t.order}: <bdi>{route.orderReference}</bdi>
      </p>
      <section>
        <h2>{t.route}</h2>
        <p>{locale === 'ar' ? route.serviceAr : route.serviceEn}</p>
        <ul>
          {route.locations.map((l) => (
            <li key={l.kind}>
              {l.kind === 'pickup' ? t.pickup : t.delivery}: {l.city} — {l.district} — {l.address}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{t.trips}</h2>
        {data.job.status !== 'COMPLETED' && (
          <OperationButton
            locale={locale}
            organizationId={data.job.organization_id}
            entityId={data.job.id}
            revision={data.job.revision}
            action="create_trip"
            destination="trip"
          />
        )}
        <ul className="request-list">
          {data.trips.map((trip) => (
            <li key={trip.id}>
              <bdi>{trip.reference}</bdi>
              <Badge>{operationalStatus(trip.status, locale)}</Badge>
              <Link href={`/${locale}/portal/operations/trips/${trip.id}`}>{t.open}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
