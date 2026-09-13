import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { quotesDictionary, quoteStatusLabel } from '@/i18n/quotes';
import { salesQueue } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { Badge, EmptyState } from '@/components/ui/primitives';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = quotesDictionary(locale);
  let data;
  try {
    data = await salesQueue();
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && error.code === 'forbidden') redirect(`/${locale}/portal`);
    throw error;
  }
  return (
    <div className="container page">
      <h1>{t.salesQuotes}</h1>
      <h2>{t.awaiting}</h2>
      {!data.length ? (
        <EmptyState title={t.awaiting}>{t.noRequests}</EmptyState>
      ) : (
        <ul className="request-list">
          {data.map((r) => (
            <li key={r.id}>
              <div>
                <Badge>
                  {quoteStatusLabel(
                    r.quotes.flatMap((q) => q.quote_versions).at(-1)?.status ?? r.status,
                    locale,
                  )}
                </Badge>
                <h2>
                  <bdi>{r.reference}</bdi>
                </h2>
                <p>{r.contact_name}</p>
                <p>{r.request_locations.map((l) => l.city).join(' → ')}</p>
              </div>
              <Link className="button button--primary" href={`/${locale}/portal/quotes/${r.id}`}>
                {t.open}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
