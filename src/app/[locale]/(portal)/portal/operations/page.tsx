import { TrackingView } from '@/components/tracking/view';
import { InAppNotifications } from '@/components/tracking/notifications';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { operationsDictionary } from '@/i18n/operations';
import { operationsWorkspace } from '@/infrastructure/operations/service';
import { AppError } from '@/domain/shared/errors';
import { PageHeader } from '@/components/ui/presentation';
import Link from 'next/link';
import { Workspace } from '@/components/operations/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = operationsDictionary(locale);
  let data;
  try {
    data = await operationsWorkspace();
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && error.code === 'forbidden') redirect(`/${locale}/portal`);
    throw error;
  }
  return (
    <div className="container page operations">
      <PageHeader
        title={t.title}
        eyebrow={locale === 'ar' ? 'مساحة العمل · Naql365' : 'Workspace · Naql365'}
        description={
          locale === 'ar'
            ? 'رتّب التنفيذ وتابع الرحلات والموارد المصرح لك بها.'
            : 'Coordinate execution and review your authorized trips and resources.'
        }
        actions={
          <Link href={`/${locale}/portal`}>
            {locale === 'ar' ? 'بوابة العمليات' : 'Operations portal'}
          </Link>
        }
      />
      <Workspace locale={locale} data={data} />
      <TrackingView
        locale={locale}
        operations
        options={{
          markets: data.markets.map((m) => ({
            id: m.id,
            label: locale === 'ar' ? m.name_ar : m.name_en,
          })),
          drivers: data.drivers
            .filter((d) => d.active)
            .map((d) => ({ id: d.id, label: d.display_name ?? '' })),
          trips: data.trips
            .filter((t) => !['COMPLETED', 'CANCELLED', 'FAILED'].includes(t.status))
            .map((t) => ({ id: t.id, label: t.reference ?? '' })),
        }}
      />
      <InAppNotifications locale={locale} />
    </div>
  );
}
