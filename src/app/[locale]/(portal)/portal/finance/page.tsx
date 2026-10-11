import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { paymentDictionary } from '@/i18n/payments';
import { getFinanceQueue } from '@/infrastructure/payments/service';
import { portalAccess } from '@/infrastructure/identity/access';
import { EmptyState, Badge } from '@/components/ui/primitives';
import { InAppNotifications } from '@/components/tracking/notifications';
import { z } from 'zod';
import { paymentStates } from '@/domain/payments/model';
import { formatMoney } from '@/domain/markets/model';
import { PageHeader } from '@/components/ui/presentation';
import { StaffWorkspaceNav } from '@/components/shell/staff-workspace-nav';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await portalAccess('finance.read');
  if (access.status === 'unauthenticated') redirect(`/${locale}/login`);
  if (access.status !== 'authorized') redirect(`/${locale}/portal`);
  const query = await searchParams;
  const validated = z
    .object({
      status: z.enum(paymentStates).optional(),
      offset: z.coerce.number().int().min(0).max(9990).default(0),
    })
    .safeParse(query);
  if (!validated.success) notFound();
  const { offset, status } = validated.data;
  const rows = await getFinanceQueue({
    organizationId: access.principal.organizationId,
    offset,
    status,
  });
  const t = paymentDictionary(locale);
  const bankAccess = await portalAccess('finance.accounts.manage', access.principal.organizationId);
  const href = (value: number) =>
    `/${locale}/portal/finance?offset=${value}${status ? `&status=${status}` : ''}`;
  return (
    <div className="container page staff-page">
      <StaffWorkspaceNav locale={locale} active="finance" />
      <PageHeader
        eyebrow={locale === 'ar' ? 'التحصيل · مساحة العمل' : 'Collections · Workspace'}
        title={t.finance}
        description={
          locale === 'ar'
            ? 'راجع حالة التحصيل وإثباتات التحويل قبل السماح بالتنفيذ.'
            : 'Review collection status and transfer proof before execution is cleared.'
        }
        actions={
          bankAccess.status === 'authorized' ? (
            <Link className="button button--secondary" href={`/${locale}/portal/finance/banks`}>
              {t.bankAdmin}
            </Link>
          ) : undefined
        }
      />
      <nav className="finance-filters staff-filter-bar" aria-label={t.finance}>
        <Link href={`/${locale}/portal/finance`} aria-current={!status ? 'page' : undefined}>
          {t.finance}
        </Link>
        {paymentStates.map((s) => (
          <Link
            key={s}
            href={`/${locale}/portal/finance?status=${s}`}
            aria-current={status === s ? 'page' : undefined}
          >
            {t.states[s]}
          </Link>
        ))}
      </nav>
      <InAppNotifications locale={locale} />
      <section className="staff-panel">
        {rows.length ? (
          <ul className="request-list staff-queue finance-queue">
            {rows.map((p) => (
              <li key={p.orderId}>
                <div className="staff-queue-main">
                  <div className="staff-queue-meta">
                    <span className="staff-label">{t.status}</span>
                    <Badge>{t.states[p.status]}</Badge>
                  </div>
                  <h2>
                    <Link href={`/${locale}/portal/finance/${p.orderId}`}>
                      <bdi>{p.reference}</bdi>
                    </Link>
                  </h2>
                  <p className="staff-queue-customer">
                    {t.customer}: {p.customerName || p.customerId}
                  </p>
                  <p className="staff-route">
                    {locale === 'ar' ? p.marketNameAr : p.marketNameEn} ·{' '}
                    {p.method === 'CASH'
                      ? t.cash
                      : p.method === 'BANK_TRANSFER'
                        ? t.transfer
                        : t.states.PENDING}
                  </p>
                  {p.latestProof && (
                    <p className="staff-proof-note">
                      {locale === 'ar' ? p.latestProof.bankNameAr : p.latestProof.bankNameEn} ·{' '}
                      <time dateTime={p.latestProof.submittedAt}>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: p.timezone,
                        }).format(new Date(p.latestProof.submittedAt))}
                      </time>
                    </p>
                  )}
                  <p className="staff-amount">{formatMoney(p.amountMinor, p.currency, locale)}</p>
                </div>
                <div className="staff-queue-action">
                  <span className="staff-label">
                    {locale === 'ar' ? 'الإجراء التالي' : 'Next action'}
                  </span>
                  <Link
                    className="button button--secondary"
                    href={`/${locale}/portal/finance/${p.orderId}`}
                  >
                    {locale === 'ar' ? 'مراجعة الدفعة' : 'Review payment'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t.finance}>{t.empty}</EmptyState>
        )}
      </section>
      <div className="actions">
        {offset > 0 && <Link href={href(Math.max(0, offset - 30))}>{t.previous}</Link>}
        {rows.length === 30 && offset < 9990 && <Link href={href(offset + 30)}>{t.next}</Link>}
      </div>
    </div>
  );
}
