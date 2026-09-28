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
import { quickEntry } from '@/domain/requests/quick-entry';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const preselection = quickEntry.safeParse(await searchParams).data;
  const signedIn = getPublicEnv()
    ? (await (await createSupabaseServerClient()).auth.getUser()).data.user
    : null;
  if (!signedIn)
    return (
      <GuestStart
        locale={locale}
        initialCountry={preselection?.country ?? (await selectedPublicCountry())}
        preselection={preselection}
      />
    );
  await customerPage(locale);
  const t = customerDictionary(locale);
  return (
    <div className="container page narrow">
      <h1>{t.request}</h1>
      <p>{t.savingHint}</p>
      <StartRequest
        locale={locale}
        markets={await availableMarkets()}
        preselection={preselection}
      />
    </div>
  );
}
