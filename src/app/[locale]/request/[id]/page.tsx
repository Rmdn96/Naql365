import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { detailsPage } from '@/infrastructure/requests/page-access';
import { RequestWizard } from '@/components/requests/wizard';
import { quickEntry } from '@/domain/requests/quick-entry';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const details = await detailsPage(locale, id);
  if (details.request.status !== 'DRAFT') redirect(`/${locale}/account/requests/${id}`);
  return (
    <div className="container page">
      <RequestWizard
        locale={locale}
        initial={details}
        preselection={quickEntry.safeParse(await searchParams).data}
      />
    </div>
  );
}
