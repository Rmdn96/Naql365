import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { detailsPage } from '@/infrastructure/requests/page-access';
import { RequestSummary } from '@/components/requests/summary';
import { Alert } from '@/components/ui/primitives';
import { CleanupAttachments } from '@/components/requests/cleanup';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = customerDictionary(locale),
    details = await detailsPage(locale, id);
  if (details.request.status === 'DRAFT') redirect(`/${locale}/request/${id}`);
  return (
    <div className="container page">
      <Link href={`/${locale}/account/requests`}>{t.allRequests}</Link>
      <h1>{t.details}</h1>
      <Alert tone={details.request.status === 'SUBMITTED' ? 'success' : 'info'}>
        {details.request.status === 'SUBMITTED' ? t.success : t.cancelled}
      </Alert>
      {details.request.reference && (
        <>
          <h2>{t.reference}</h2>
          <p className="request-reference" dir="ltr">
            {details.request.reference}
          </p>
          <p>{t.immutable}</p>
        </>
      )}
      {details.request.submitted_at && (
        <p>
          {t.submitted}:{' '}
          <time dateTime={details.request.submitted_at}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Riyadh',
            }).format(new Date(details.request.submitted_at))}
          </time>
        </p>
      )}
      {details.request.status === 'CANCELLED' && details.attachments.length > 0 && (
        <CleanupAttachments
          locale={locale}
          requestId={id}
          fileIds={details.attachments.map((f) => f.id)}
        />
      )}
      <RequestSummary locale={locale} {...details} />
    </div>
  );
}
