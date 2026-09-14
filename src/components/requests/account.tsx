import Link from 'next/link';
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
export async function CustomerAccount({ locale }: { locale: Locale }) {
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
  return (
    <div className="container page narrow">
      <Card>
        <h1>{!permitted && !onboarding ? t.forbidden : t.account}</h1>
        {!permitted && !onboarding ? (
          <Alert tone="error">
            <p>{t.forbiddenBody}</p>
          </Alert>
        ) : (
          <>
            {permitted && (
              <nav className="customer-links" aria-label={t.account}>
                <Link href={`/${locale}/account/requests`}>{t.myRequests}</Link>
                <Link href={`/${locale}/account/quotes`}>{qt.myQuotes}</Link>
                <StartRequest locale={locale} markets={await availableMarkets()} />
              </nav>
            )}
            <h2>{onboarding ? t.onboard : t.profile}</h2>
            <CustomerProfileForm locale={locale} profile={profile.data} />
          </>
        )}
        <form action={customerLogout.bind(null, locale)}>
          <Button variant="secondary">{t.logout}</Button>
        </form>
      </Card>
    </div>
  );
}
