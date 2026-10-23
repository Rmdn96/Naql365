import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { quotesDictionary, quoteStatusLabel } from '@/i18n/quotes';
import { salesQueue } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { StaffPageHeader as PageHeader, StaffTable } from '@/components/staff/presentation';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = quotesDictionary(locale);
  let data;
  try {
    data = await salesQueue();
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && error.code === 'forbidden') redirect(`/${locale}/portal`);
    throw error;
  }
  return (
    <div className="container page staff-page">
      <PageHeader
        eyebrow={locale === 'ar' ? 'المبيعات · مساحة العمل' : 'Sales · Workspace'}
        title={t.salesQuotes}
        description={
          locale === 'ar'
            ? 'راجع الطلبات وأكمل التسعير اليدوي وأرسل العرض التالي بوضوح.'
            : 'Review requests, complete manual pricing, and send the next quote with confidence.'
        }
      />
      <section className="staff-panel">
        <div className="staff-section-heading">
          <div>
            <p className="eyebrow">{locale === 'ar' ? 'قائمة العمل' : 'Work queue'}</p>
            <h2>{t.awaiting}</h2>
          </div>
          <span className="staff-count">
            {locale === 'ar' ? 'العناصر المعروضة' : 'Displayed items'}: {data.length} / 100
          </span>
        </div>
        {!data.length ? (
          <EmptyState title={t.awaiting}>{t.noRequests}</EmptyState>
        ) : (
          <StaffTable
            caption={t.awaiting}
            columns={[
              t.request,
              locale === 'ar' ? 'العميل' : 'Customer',
              locale === 'ar' ? 'المسار' : 'Route',
              locale === 'ar' ? 'الحالة' : 'Status',
              locale === 'ar' ? 'الإجراء التالي' : 'Next action',
            ]}
            rows={data.map((r) => [
              <bdi key="reference">{r.reference}</bdi>,
              r.contact_name,
              r.request_locations.map((l) => l.city).join(' → '),
              <Badge key="status">
                {quoteStatusLabel(
                  r.quotes.flatMap((q) => q.quote_versions).sort((a, b) => b.version - a.version)[0]
                    ?.status ?? r.status,
                  locale,
                )}
              </Badge>,
              <Link
                key="open"
                className="button button--primary"
                href={`/${locale}/portal/quotes/${r.id}`}
              >
                {t.open}
              </Link>,
            ])}
          />
        )}
      </section>
    </div>
  );
}
