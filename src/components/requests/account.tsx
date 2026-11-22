import Link from 'next/link';
import { Alert } from '@/components/ui/primitives';
import { CustomerDashboard } from '@/components/customer/dashboard';
import { CustomerStoreRecords } from '@/components/lovable/customer-store-records';
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
import { Button } from '@/components/ui/primitives';
export async function CustomerAccount({
  locale,
  saved = false,
  view = 'home',
}: {
  locale: Locale;
  saved?: boolean;
  view?: 'home' | 'profile' | 'edit';
}) {
  if (!getPublicEnv()) return <ProtectedShell locale={locale} portal="account" />;
  const t = customerDictionary(locale),
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
  if (view !== 'home') {
    const ar = locale === 'ar';
    const root = `/${locale}/account/profile`;
    const editable = permitted || onboarding;
    return (
      <section className="cx-panel cx-stack">
        <h1>{view === 'edit' ? t.profile : ar ? 'حسابي' : 'My account'}</h1>
        {view === 'edit' && editable ? (
          <>
            <CustomerProfileForm locale={locale} profile={profile.data} />
            <Link href={root}>{ar ? 'العودة إلى حسابي' : 'Back to my account'}</Link>
          </>
        ) : (
          <>
            {saved && permitted && <Alert tone="success">{t.profileSaved}</Alert>}
            {!editable && <Alert tone="error">{t.forbiddenBody}</Alert>}
            <dl>
              <dt>{t.name}</dt>
              <dd>{profile.data.display_name || t.noValue}</dd>
              <dt>{t.phone}</dt>
              <dd>
                <bdi>{profile.data.phone || t.noValue}</bdi>
              </dd>
              <dt>{t.locale}</dt>
              <dd>{profile.data.locale === 'ar' ? 'العربية' : 'English'}</dd>
            </dl>
            {editable && (
              <p>{onboarding ? t.onboard : ar ? 'الملف الشخصي مكتمل' : 'Profile complete'}</p>
            )}
            <div className="customer-links">
              {editable && (
                <Link href={root + '/edit'}>{ar ? 'تعديل البيانات' : 'Edit profile'}</Link>
              )}
              {permitted && (
                <Link href={`/${locale}/store/orders`}>{ar ? 'طلبات المتجر' : 'Store orders'}</Link>
              )}
            </div>
          </>
        )}
        <form action={customerLogout.bind(null, locale)}>
          <Button variant="secondary">{t.logout}</Button>
        </form>
      </section>
    );
  }
  const [requests, quotes] = permitted
    ? await Promise.all([customerRequests(locale), customerQuotes()])
    : [[], []];
  const actionQuotes = quotes.flatMap((q) =>
    q.quote_versions
      .filter((v) => v.status === 'SENT' || v.status === 'VIEWED')
      .map((v) => ({ id: v.id, reference: q.reference })),
  );
  return (
    <CustomerDashboard
      locale={locale}
      onboarding={onboarding}
      permitted={permitted}
      requests={requests}
      actionQuotes={actionQuotes}
      storeRecords={permitted ? <CustomerStoreRecords locale={locale} /> : null}
    />
  );
}
