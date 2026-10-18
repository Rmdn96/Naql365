import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { supportQueue } from '@/infrastructure/support/service';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { PageHeader } from '@/components/ui/presentation';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { quoteStatusLabel } from '@/i18n/quotes';
import { operationalStatus } from '@/i18n/operations';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === 'ar',
    country = await selectedPublicCountry();
  const data = await supportQueue(country, (await searchParams).before);
  const root = '/' + locale + '/portal/support';
  return (
    <>
      <PageHeader
        title={ar ? 'دعم العملاء' : 'Customer Support'}
        description={
          ar
            ? 'بيانات الطلب والتواصل للقراءة فقط. لا تتضمن هذه المساحة تعديل الأسعار أو المدفوعات أو روابط الضيوف.'
            : 'Read-only request and contact information. Pricing, payments and guest-link changes are not available here.'
        }
      />
      <p className="staff-window-note">
        {country} · {ar ? 'العناصر المعروضة' : 'Displayed items'}: {data?.items.length ?? 0} / 30
      </p>
      {!data?.items.length ? (
        <EmptyState title={ar ? 'لا توجد طلبات معروضة' : 'No requests displayed'}>
          {ar
            ? 'تحقق من السوق المحدد أو ارجع إلى أحدث الطلبات.'
            : 'Check the selected Market or return to the newest requests.'}
        </EmptyState>
      ) : (
        data.items.map((r) => (
          <article key={r.reference} className="staff-support-card">
            <header>
              <h2>
                <bdi>{r.reference}</bdi>
              </h2>
              <Badge>
                {['NOT_STARTED', 'IN_PROGRESS', 'EXCEPTION', 'COMPLETED'].includes(r.journey)
                  ? operationalStatus(r.journey, locale)
                  : quoteStatusLabel(r.journey, locale)}
              </Badge>
            </header>
            <dl>
              <div>
                <dt>{ar ? 'العميل' : 'Customer'}</dt>
                <dd>{r.contactName || (ar ? 'الاسم غير متاح' : 'Name unavailable')}</dd>
              </div>
              <div>
                <dt>{ar ? 'التواصل' : 'Contact'}</dt>
                <dd>
                  <bdi>{r.contactPhone}</bdi>
                  <br />
                  <bdi>{r.contactEmail}</bdi>
                </dd>
              </div>
              <div>
                <dt>{ar ? 'الخدمة' : 'Service'}</dt>
                <dd>{(ar ? r.serviceAr : r.serviceEn) ?? '—'}</dd>
              </div>
              <div>
                <dt>{ar ? 'المسار' : 'Route'}</dt>
                <dd>
                  {r.pickupCity} {ar ? '←' : '→'} {r.deliveryCity}
                </dd>
              </div>
              <div>
                <dt>{ar ? 'تاريخ الطلب' : 'Created'}</dt>
                <dd>
                  <time dateTime={r.createdAt}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: country === 'SA' ? 'Asia/Riyadh' : 'Africa/Cairo',
                    }).format(new Date(r.createdAt))}
                  </time>
                </dd>
              </div>
            </dl>
          </article>
        ))
      )}
      <nav className="actions" aria-label={ar ? 'صفحات الطلبات' : 'Request pages'}>
        <Link href={root}>{ar ? 'أحدث الطلبات' : 'Newest requests'}</Link>
        {data?.nextCursor && (
          <Link href={root + '?before=' + encodeURIComponent(JSON.stringify(data.nextCursor))}>
            {ar ? 'الطلبات الأقدم' : 'Older requests'}
          </Link>
        )}
      </nav>
    </>
  );
}
