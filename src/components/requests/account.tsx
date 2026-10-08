import { customerExperience } from '@/i18n/customer-experience';
import Link from 'next/link';
import { customerRequests } from '@/infrastructure/requests/list';
import { customerQuotes } from '@/infrastructure/pricing/service';
import { PageHeader, SummaryCard } from '@/components/ui/presentation';
import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { ProtectedShell } from '@/components/shell/protected-shell';
import { CustomerProfileForm } from '@/components/auth/customer-form';
import { customerLogout } from '@/app/auth/customer-actions';
import { Card, Button, Alert } from '@/components/ui/primitives';
import { StartRequest } from './wizard';
import { quotesDictionary } from '@/i18n/quotes';
import { availableMarkets } from '@/infrastructure/markets/service';
export async function CustomerAccount({
  locale,
  saved = false,
}: {
  locale: Locale;
  saved?: boolean;
}) {
  if (!getPublicEnv()) return <ProtectedShell locale={locale} portal="account" />;
  const t = customerDictionary(locale),
    qt = quotesDictionary(locale),
    client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect(`/${locale}/login`);
  const [profile, enrollment] = await Promise.all([
    client.from('profiles').select('display_name,phone,locale').eq('id', data.user.id).single(),
    client.rpc('customer_enrollment_state'),
  ]);
  if (profile.error || enrollment.error) throw new Error('Account unavailable');
  const onboarding = enrollment.data === 'new';
  const permitted = enrollment.data === 'active';
  const [requests, quotes] = permitted
    ? await Promise.all([customerRequests(locale), customerQuotes()])
    : [[], []];
  const actionQuotes = quotes.flatMap((q) =>
    q.quote_versions
      .filter((v) => v.status === 'SENT')
      .map((v) => ({ id: v.id, reference: q.reference })),
  );
  return (
    <div className="container page customer-home customer-experience">
      <PageHeader
        title={t.account}
        description={
          locale === 'ar'
            ? 'طلباتك وخطوتك التالية، في مكان واحد.'
            : 'Your requests and next steps, in one place.'
        }
      />
      {permitted && (
        <div className="summary-grid">
          <SummaryCard
            title={locale === 'ar' ? 'رحلتك الحالية' : 'Your latest journey'}
            actions={
              <Link
                className="button button--primary"
                href={
                  requests[0]
                    ? `/${locale}/account/requests/${requests[0].id}`
                    : `/${locale}/request`
                }
              >
                {requests[0] ? (locale === 'ar' ? 'متابعة الطلب' : 'Continue request') : t.start}
              </Link>
            }
          >
            <p>
              {requests[0]?.reference ??
                (locale === 'ar'
                  ? 'ابدأ طلب نقل، وسيراجع فريقنا التفاصيل قبل إرسال عرض السعر.'
                  : 'Start a transport request. Our team reviews the details before sending your quote.')}
            </p>
          </SummaryCard>
          <SummaryCard title={qt.myQuotes}>
            {actionQuotes.length ? (
              <ul className="task-links">
                {actionQuotes.slice(0, 3).map((q) => (
                  <li key={q.id}>
                    <Link href={`/${locale}/account/quotes/${q.id}`}>
                      {q.reference} · {locale === 'ar' ? 'راجع عرض السعر' : 'Review quote'}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {locale === 'ar'
                  ? 'لا يوجد عرض سعر بانتظار ردك الآن.'
                  : 'No quote is waiting for your response.'}
              </p>
            )}
            <Link href={`/${locale}/account/quotes`}>
              {locale === 'ar'
                ? 'العروض والدفع ومتابعة التسليم'
                : 'Quotes, payment and delivery progress'}
            </Link>
          </SummaryCard>
        </div>
      )}
      {permitted && requests.length > 0 && (
        <section className="recent-journeys">
          <h2>{customerExperience(locale).previousRequests}</h2>
          <ul className="request-list">
            {requests.slice(0, 4).map((r) => (
              <li key={r.id}>
                <div>
                  <h3>
                    <Link href={`/${locale}/account/requests/${r.id}`}>
                      {r.reference ?? t.request}
                    </Link>
                  </h3>
                  <p>{locale === 'ar' ? r.services?.name_ar : r.services?.name_en}</p>
                  <p>{r.request_locations.map((l) => l.city).join(' · ')}</p>
                </div>
                <Link href={`/${locale}/account/requests/${r.id}`}>
                  {locale === 'ar' ? 'تفاصيل الطلب' : 'Request details'}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Card>
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
                <StartRequest locale={locale} markets={await availableMarkets()} />
              </nav>
            )}
            {onboarding ? (
              <>
                <h2>{t.onboard}</h2>
                <CustomerProfileForm locale={locale} profile={profile.data} />
              </>
            ) : (
              <details className="profile-settings">
                <summary>{t.profile}</summary>
                <CustomerProfileForm locale={locale} profile={profile.data} />
              </details>
            )}
          </>
        )}
        <form action={customerLogout.bind(null, locale)}>
          <Button variant="secondary">{t.logout}</Button>
        </form>
      </Card>
    </div>
  );
}
