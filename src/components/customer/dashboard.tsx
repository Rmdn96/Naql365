import type { ReactNode } from 'react';
import type { customerRequests } from '@/infrastructure/requests/list';
import type { Locale } from '@/i18n/config';
import Link from 'next/link';
import { CustomerRecords } from '@/components/lovable/customer-records';
import { commerceContent } from '@/components/lovable/commerce-content';
import { customerDictionary } from '@/i18n/customer';
import { Alert, EmptyState } from '@/components/ui/primitives';

/** Original CustomerPreview composition over already-authorized records and canonical action slots. */
export function CustomerDashboard({
  locale,
  onboarding,
  permitted,
  requests,
  actionQuotes,
  storeRecords,
}: {
  locale: Locale;
  onboarding: boolean;
  permitted: boolean;
  requests: Awaited<ReturnType<typeof customerRequests>>;
  actionQuotes: { id: string; reference: string | null }[];
  storeRecords: ReactNode;
}) {
  const t = customerDictionary(locale);
  const ar = locale === 'ar';
  return (
    <div className="customer-dashboard customer-experience cx-stack">
      <header className="cx-head">
        <div>
          <p className="cx-kicker">{locale === 'ar' ? 'لوحة العميل' : 'Customer dashboard'}</p>
          <h1>{commerceContent[locale].portal}</h1>
        </div>
      </header>
      <p>{ar ? 'أهلًا بك في نقل 365' : 'Welcome to Naql365'}</p>
      <div className="customer-links">
        {permitted && <Link href={`/${locale}/request`}>{ar ? 'اطلب نقل' : 'Book transport'}</Link>}
        <Link href={`/${locale}/store`}>{ar ? 'تصفح المتجر' : 'Browse the store'}</Link>
        {permitted && (
          <Link href={`/${locale}/account/quotes`}>{ar ? 'عروض السعر' : 'Quotes'}</Link>
        )}
      </div>
      {onboarding && (
        <Alert tone="info">
          <Link href={`/${locale}/account/profile/edit`}>{t.onboard}</Link>
        </Alert>
      )}
      {!permitted && !onboarding && <Alert tone="error">{t.forbiddenBody}</Alert>}
      {permitted && (
        <>
          {actionQuotes.length > 0 && (
            <section
              className="cx-next cx-stack"
              aria-label={locale === 'ar' ? 'الإجراء التالي' : 'Next action'}
            >
              {actionQuotes.slice(0, 3).map((q) => (
                <article key={q.id}>
                  <p className="cx-kicker">
                    {locale === 'ar' ? 'عرض سعر بانتظار ردك' : 'A quote awaits your response'}
                  </p>
                  <strong>{q.reference}</strong>
                  <Link href={'/' + locale + '/account/quotes/' + q.id}>
                    {locale === 'ar' ? 'راجع عرض السعر' : 'Review quote'}
                  </Link>
                </article>
              ))}
            </section>
          )}
          <div className="cx-grid2">
            <section className="cx-panel">
              <header>
                <h2>{t.myRequests}</h2>
              </header>
              <CustomerRecords
                locale={locale}
                records={requests.slice(0, 4).map((r) => ({
                  id: r.id,
                  reference: r.reference ?? t.request,
                  summary: [
                    (locale === 'ar' ? r.services?.name_ar : r.services?.name_en) ?? '',
                    r.request_locations.map((l) => l.city).join(' · '),
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  status:
                    r.status === 'DRAFT'
                      ? t.DRAFT
                      : r.status === 'SUBMITTED'
                        ? t.SUBMITTED
                        : t.CANCELLED,
                  href:
                    r.status === 'DRAFT'
                      ? `/${locale}/request/${r.id}`
                      : `/${locale}/account/requests/${r.id}`,
                }))}
              />
            </section>
            <section className="cx-panel">
              <header>
                <h2>{locale === 'ar' ? 'طلبات المتجر' : 'Store orders'}</h2>
              </header>
              {storeRecords}
            </section>
          </div>
        </>
      )}
      {!permitted && onboarding && <EmptyState title={t.empty}>{t.emptyBody}</EmptyState>}
    </div>
  );
}
