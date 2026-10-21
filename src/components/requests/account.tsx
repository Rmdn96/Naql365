import { CustomerStoreRecords } from '@/components/lovable/customer-store-records';
import { CommerceSurface } from '@/components/lovable/surface';
import { SectionHeading } from '@/components/lovable/commerce';
import { commerceContent } from '@/components/lovable/commerce-content';
import { CustomerNavigation, CustomerRecords } from '@/components/lovable/customer-records';
import Link from 'next/link';
import { customerRequests } from '@/infrastructure/requests/list';
import { customerQuotes } from '@/infrastructure/pricing/service';
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
      .filter((v) => v.status === 'SENT' || v.status === 'VIEWED')
      .map((v) => ({ id: v.id, reference: q.reference })),
  );
  return (
    <CommerceSurface locale={locale} view="portal">
      <div className="cm-container cm-section">
        <SectionHeading
          eyebrow={locale === 'ar' ? 'لوحة العميل' : 'Customer dashboard'}
          title={commerceContent[locale].portal}
        />
        {permitted && (
          <>
            <CustomerNavigation locale={locale} />
            {actionQuotes.length > 0 && (
              <section className="cm-records">
                {actionQuotes.slice(0, 3).map((q) => (
                  <article key={q.id}>
                    <strong>{q.reference}</strong>
                    <Link href={'/' + locale + '/account/quotes/' + q.id}>
                      {locale === 'ar' ? 'راجع عرض السعر' : 'Review quote'}
                    </Link>
                  </article>
                ))}
              </section>
            )}
            <h2>{t.myRequests}</h2>
            <CustomerRecords
              locale={locale}
              records={requests.slice(0, 4).map((r) => ({
                id: r.id,
                reference: r.reference ?? t.request,
                summary: (locale === 'ar' ? r.services?.name_ar : r.services?.name_en) ?? '',
                status: r.request_locations.map((l) => l.city).join(' · '),
                href: '/' + locale + '/account/requests/' + r.id,
              }))}
            />
            <h2>{locale === 'ar' ? 'طلبات المتجر' : 'Store orders'}</h2>
            <CustomerStoreRecords locale={locale} />
          </>
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
                <section className="profile-v2-onboarding">
                  <p>
                    {locale === 'ar'
                      ? 'خطوة أخيرة قبل طلبك الأول'
                      : 'One last step before your first request'}
                  </p>
                  <h2>{t.onboard}</h2>
                  <CustomerProfileForm locale={locale} profile={profile.data} />
                </section>
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
    </CommerceSurface>
  );
}
