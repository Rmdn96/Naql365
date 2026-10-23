import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { staffModules } from '@/infrastructure/identity/staff-context';
import { salesQueue } from '@/infrastructure/pricing/service';
import { operationsWorkspace } from '@/infrastructure/operations/service';
import { StaffFinanceUnavailable } from '@/components/payments/staff-market-unavailable';
import { quoteStatusLabel } from '@/i18n/quotes';
import { operationalStatus } from '@/i18n/operations';
import { StaffPageHeader as PageHeader } from '@/components/staff/presentation';
import { Badge, EmptyState } from '@/components/ui/primitives';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === 'ar',
    m = await staffModules();
  if (m.context.status !== 'authorized') return null;
  const [sales, ops] = await Promise.all([
    m.sales ? salesQueue() : null,
    m.operations ? operationsWorkspace() : null,
  ]);
  const country = await selectedPublicCountry();
  const currency = country === 'SA' ? 'SAR' : 'EGP';
  const marketIds = new Set(
    ops?.markets.filter((market) => market.country_code === country).map((market) => market.id),
  );
  const root = '/' + locale + '/portal';
  const panel = (
    title: string,
    href: string,
    rows: { label: string; status: string; href: string }[],
    limit: number,
  ) => (
    <section className="staff-dashboard-panel">
      <header>
        <h2>{title}</h2>
        <Link href={href}>{ar ? 'فتح القائمة' : 'Open queue'}</Link>
      </header>
      <p className="staff-window-note">
        {ar ? 'العناصر المعروضة' : 'Displayed items'}: {Math.min(rows.length, 8)} ·{' '}
        {ar
          ? 'من نافذة محدودة، وليست إجمالي المؤسسة'
          : 'From a bounded window, not an organization total'}{' '}
        ({limit})
      </p>
      {rows.length ? (
        <ul>
          {rows.slice(0, 8).map((r) => (
            <li key={r.label + r.href}>
              <Link href={r.href}>
                <bdi>{r.label}</bdi>
              </Link>
              <span>
                <Badge>{r.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={ar ? 'لا توجد عناصر في هذه النافذة' : 'No items in this window'}>
          {ar
            ? 'افتح القائمة لمراجعة النطاق والفلاتر المتاحة.'
            : 'Open the queue to review its scope and filters.'}
        </EmptyState>
      )}
    </section>
  );
  return (
    <>
      <PageHeader
        eyebrow={ar ? 'Naql365 · مركز العمل' : 'Naql365 · Work center'}
        title={ar ? 'ما الذي يحتاج إلى متابعة؟' : 'What needs attention?'}
        description={
          ar
            ? 'ابدأ من قوائم العمل المتاحة لصلاحياتك. كل إجراء يعود إلى مساره المعتمد.'
            : 'Start with the work queues available to your permissions. Every action opens its authorized workflow.'
        }
      />
      <div className="staff-dashboard-grid">
        {sales &&
          panel(
            ar ? 'الطلبات والعروض' : 'Requests & Quotes',
            root + '/quotes',
            sales
              .filter((r) => r.markets?.currency === currency)
              .map((r) => ({
                label: r.reference ?? '',
                href: root + '/quotes/' + r.id,
                status: quoteStatusLabel(
                  r.quotes.flatMap((q) => q.quote_versions).sort((a, b) => b.version - a.version)[0]
                    ?.status ?? r.status,
                  locale,
                ),
              })),
            100,
          )}
        {ops &&
          panel(
            ar ? 'طلبات تنتظر التخطيط' : 'Orders awaiting planning',
            root + '/operations#work-orders',
            ops.orders
              .filter((o) => marketIds.has(o.market_id) && !o.jobs.length)
              .map((o) => ({
                label: o.reference ?? '',
                status: ar ? 'بانتظار إنشاء مهمة' : 'Awaiting job planning',
                href: root + '/operations#work-orders',
              })),
            100,
          )}
        {ops &&
          panel(
            ar ? 'الرحلات الحالية' : 'Current trips',
            root + '/operations#dispatch-title',
            ops.trips
              .filter(
                (t) =>
                  marketIds.has(t.market_id) &&
                  !['COMPLETED', 'CANCELLED', 'FAILED'].includes(t.status),
              )
              .map((t) => ({
                label: t.reference ?? (ar ? 'رحلة' : 'Trip'),
                status: operationalStatus(t.status, locale),
                href: root + '/operations/trips/' + t.id,
              })),
            200,
          )}
        {m.finance && <StaffFinanceUnavailable locale={locale} />}
        {m.support && (
          <section className="staff-dashboard-panel">
            <h2>{ar ? 'دعم العملاء' : 'Customer Support'}</h2>
            <p>
              {ar
                ? 'راجع بيانات التواصل والمسار وحالة الطلب ضمن السوق المحدد. هذه مساحة للقراءة فقط.'
                : 'Review contact, route and request status in the selected Market. This workspace is read-only.'}
            </p>
            <Link className="button button--secondary" href={root + '/support'}>
              {ar ? 'فتح طلبات الدعم' : 'Open support requests'}
            </Link>
          </section>
        )}
        {!m.sales && !m.operations && !m.finance && !m.support && (
          <EmptyState title={ar ? 'لا توجد وحدات متاحة' : 'No modules available'}>
            {ar
              ? 'تواصل مع مسؤول مؤسستك بشأن صلاحيات العمل.'
              : 'Contact your organization administrator about workspace permissions.'}
          </EmptyState>
        )}
      </div>
    </>
  );
}
