import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { quotesDictionary, quoteStatusLabel } from '@/i18n/quotes';
import { customerQuotes } from '@/infrastructure/pricing/service';
import { AppError } from '@/domain/shared/errors';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatSar } from '@/domain/pricing/model';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = quotesDictionary(locale);
  let data;
  try {
    data = await customerQuotes();
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated') redirect(`/${locale}/login`);
    if (error instanceof AppError && error.code === 'forbidden') redirect(`/${locale}/account`);
    throw error;
  }
  const versions = data
    .flatMap((q) => q.quote_versions.map((v) => ({ q, v })))
    .sort((a, b) => (b.v.sent_at ?? '').localeCompare(a.v.sent_at ?? ''));
  return (
    <main className="container page">
      <h1>{t.myQuotes}</h1>
      {!versions.length ? (
        <EmptyState title={t.myQuotes}>{t.noQuotes}</EmptyState>
      ) : (
        <ul className="request-list">
          {versions.map(({ q, v }) => (
            <li key={v.id}>
              <div>
                <Badge>{quoteStatusLabel(v.status, locale)}</Badge>
                <h2>
                  <Link href={`/${locale}/account/quotes/${v.id}`}>
                    <bdi>{q.reference}</bdi> · {t.version} {v.version}
                  </Link>
                </h2>
                <p>
                  {t.relatedRequest}: <bdi>{q.requests?.reference}</bdi>
                </p>
              </div>
              <strong>
                <bdi>{formatSar(v.total_minor, locale)}</bdi>
              </strong>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
