import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { guestDictionary } from '@/i18n/guest';
import { AppError } from '@/domain/shared/errors';
import { requestDetails } from '@/infrastructure/requests/service';
import { RequestWizard } from '@/components/requests/wizard';
import { RequestSummary } from '@/components/requests/summary';
import { Alert } from '@/components/ui/primitives';
import Link from 'next/link';
import { customerQuotes } from '@/infrastructure/pricing/service';
import { quotesDictionary, quoteStatusLabel } from '@/i18n/quotes';
import { formatMoney } from '@/domain/markets/model';

export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = guestDictionary(locale);
  let details;
  try {
    details = await requestDetails(id, false, true);
  } catch (error) {
    if (
      error instanceof AppError &&
      ['unauthenticated', 'forbidden', 'not_found'].includes(error.code)
    )
      return (
        <section className="container page">
          <h1>{t.request}</h1>
          <Alert tone="error">{t.unavailable}</Alert>
        </section>
      );
    throw error;
  }
  if (details.request.status === 'DRAFT')
    return (
      <section className="container page">
        <RequestWizard locale={locale} initial={details} guest />
      </section>
    );
  const quotes = await customerQuotes(true);
  const qt = quotesDictionary(locale);
  return (
    <section className="container page">
      <h1>{details.request.status === 'SUBMITTED' ? t.received : t.cancelled}</h1>
      {details.request.reference && (
        <p>
          {t.reference}: <bdi>{details.request.reference}</bdi>
        </p>
      )}
      {details.request.status === 'SUBMITTED' && <p>{t.review}</p>}
      {(quotes ?? []).flatMap((quote) =>
        quote.quote_versions.map((version) => (
          <article className="card" key={version.id}>
            <h2>
              <Link href={`/${locale}/guest/quotes/${version.id}`}>
                {qt.quoteDetails} · <bdi>{quote.reference}</bdi>
              </Link>
            </h2>
            <p>
              {quoteStatusLabel(version.status, locale)} ·{' '}
              <bdi>{formatMoney(version.total_minor, version.currency, locale)}</bdi>
            </p>
          </article>
        )),
      )}
      <RequestSummary locale={locale} {...details} guest />
    </section>
  );
}
