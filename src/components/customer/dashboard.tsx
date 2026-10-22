import type { ReactNode } from 'react';
import type { customerRequests } from '@/infrastructure/requests/list';
import type { Locale } from '@/i18n/config';
import Link from 'next/link';
import { CustomerNavigation, CustomerRecords } from '@/components/lovable/customer-records';
import { commerceContent } from '@/components/lovable/commerce-content';
import { customerDictionary } from '@/i18n/customer';
import { quotesDictionary } from '@/i18n/quotes';
import { Card, Alert } from '@/components/ui/primitives';

/** Original CustomerPreview composition over already-authorized records and canonical action slots. */
export function CustomerDashboard({
  locale,
  saved,
  onboarding,
  permitted,
  requests,
  actionQuotes,
  storeRecords,
  profileForm,
  startRequest,
  logout,
}: {
  locale: Locale;
  saved: boolean;
  onboarding: boolean;
  permitted: boolean;
  requests: Awaited<ReturnType<typeof customerRequests>>;
  actionQuotes: { id: string; reference: string | null }[];
  storeRecords: ReactNode;
  profileForm: ReactNode;
  startRequest: ReactNode;
  logout: ReactNode;
}) {
  const t = customerDictionary(locale),
    qt = quotesDictionary(locale);
  return (
    <div className="customer-dashboard customer-experience cx-stack">
      <header className="cx-head">
        <div>
          <p className="cx-kicker">{locale === 'ar' ? 'لوحة العميل' : 'Customer dashboard'}</p>
          <h1>{commerceContent[locale].portal}</h1>
        </div>
      </header>
      {permitted && (
        <>
          <CustomerNavigation locale={locale} />
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
                  href: '/' + locale + '/account/requests/' + r.id,
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
      <Card className="cx-panel">
        {!permitted && !onboarding && <h2>{t.forbidden}</h2>}
        {!permitted && !onboarding ? (
          <Alert tone="error">
            <p>{t.forbiddenBody}</p>
          </Alert>
        ) : (
          <>
            {saved && permitted && <Alert tone="success">{t.profileSaved}</Alert>}
            {permitted && (
              <nav className="customer-links" aria-label={t.account}>
                <Link href={`/${locale}/account/requests`}>{t.myRequests}</Link>
                <Link href={`/${locale}/account/quotes`}>{qt.myQuotes}</Link>
                {startRequest}
              </nav>
            )}
            {onboarding ? (
              <section className="profile-v2-onboarding">
                <p>
                  {locale === 'ar'
                    ? 'خطوة أخيرة قبل طلبك الأول'
                    : 'One last step before your first request'}
                </p>
                <h2>{t.onboard}</h2>
                {profileForm}
              </section>
            ) : (
              <details className="profile-settings" id="customer-profile">
                <summary>{t.profile}</summary>
                {profileForm}
              </details>
            )}
          </>
        )}
        {logout}
      </Card>
    </div>
  );
}
