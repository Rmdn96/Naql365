import { availableMarkets } from '@/infrastructure/markets/service';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { customerPage } from '@/infrastructure/requests/page-access';
import { StartRequest } from '@/components/requests/wizard';
import { GuestStart } from '@/components/guest/access';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const signedIn = getPublicEnv()
    ? (await (await createSupabaseServerClient()).auth.getUser()).data.user
    : null;
  if (!signedIn)
    return <GuestStart locale={locale} initialCountry={await selectedPublicCountry()} />;
  await customerPage(locale);
  const t = customerDictionary(locale);
  return (
    <div className="container page narrow">
      <h1>{t.request}</h1>
      <p>{t.savingHint}</p>
      <StartRequest locale={locale} markets={await availableMarkets()} />
    </div>
  );
}
