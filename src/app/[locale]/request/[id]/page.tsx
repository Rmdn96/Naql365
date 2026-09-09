import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { detailsPage } from '@/infrastructure/requests/page-access';
import { RequestWizard } from '@/components/requests/wizard';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const details = await detailsPage(locale, id);
  if (details.request.status !== 'DRAFT') redirect(`/${locale}/account/requests/${id}`);
  return (
    <div className="container page">
      <RequestWizard locale={locale} initial={details} />
    </div>
  );
}
