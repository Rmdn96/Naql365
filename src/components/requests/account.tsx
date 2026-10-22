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
import { StartRequest } from './wizard';
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
    <CustomerDashboard
      locale={locale}
      saved={saved}
      onboarding={onboarding}
      permitted={permitted}
      requests={requests}
      actionQuotes={actionQuotes}
      storeRecords={permitted ? <CustomerStoreRecords locale={locale} /> : null}
      profileForm={
        permitted || onboarding ? (
          <CustomerProfileForm locale={locale} profile={profile.data} />
        ) : null
      }
      startRequest={
        permitted ? <StartRequest locale={locale} markets={await availableMarkets()} /> : null
      }
      logout={
        <form action={customerLogout.bind(null, locale)}>
          <Button variant="secondary">{t.logout}</Button>
        </form>
      }
    />
  );
}
