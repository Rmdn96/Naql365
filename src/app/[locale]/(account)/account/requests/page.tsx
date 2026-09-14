import { availableMarkets } from '@/infrastructure/markets/service';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { customerPage } from '@/infrastructure/requests/page-access';
import { StartRequest } from '@/components/requests/wizard';
import { EmptyState, Badge } from '@/components/ui/primitives';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = customerDictionary(locale);
  const page = Math.min(10000, Math.max(1, Number((await searchParams).page) || 1));
  if (!Number.isInteger(page)) notFound();
  const { client, customers } = await customerPage(locale);
  const { data, error } = await client
    .from('requests')
    .select(
      'id,markets(name_ar,name_en,timezone,currency),status,reference,created_at,preferred_date,services(name_ar,name_en),request_locations(kind,city)',
    )
    .in(
      'customer_id',
      customers.map((c) => c.id),
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 20, page * 20);
  if (error) throw new Error('Request list unavailable');
  return (
    <div className="container page">
      <div className="wizard-top">
        <h1>{t.myRequests}</h1>
        <StartRequest locale={locale} markets={await availableMarkets()} />
      </div>
      {!data.length ? (
        <EmptyState title={t.empty}>{t.emptyBody}</EmptyState>
      ) : (
        <ul className="request-list">
          {data.slice(0, 20).map((r) => (
            <li key={r.id}>
              <div>
                <Badge>
                  {r.status === 'DRAFT'
                    ? t.DRAFT
                    : r.status === 'SUBMITTED'
                      ? t.SUBMITTED
                      : t.CANCELLED}
                </Badge>
                <h2>
                  <Link
                    href={
                      r.status === 'DRAFT'
                        ? `/${locale}/request/${r.id}`
                        : `/${locale}/account/requests/${r.id}`
                    }
                  >
                    <bdi>{r.reference ?? t.DRAFT}</bdi>
                  </Link>
                </h2>
                <p>
                  {locale === 'ar' ? r.markets.name_ar : r.markets.name_en} ·{' '}
                  <bdi>{r.markets.currency}</bdi>
                </p>
                <p>{locale === 'ar' ? r.services?.name_ar : r.services?.name_en}</p>
                <p>
                  {t.pickup}:{' '}
                  {r.request_locations.find((l) => l.kind === 'pickup')?.city || t.noValue} ·{' '}
                  {t.delivery}:{' '}
                  {r.request_locations.find((l) => l.kind === 'delivery')?.city || t.noValue}
                </p>
              </div>
              <div>
                <p>
                  {t.date}: <bdi>{r.preferred_date ?? t.noValue}</bdi>
                </p>
                <p>
                  {t.created}:{' '}
                  <time dateTime={r.created_at}>
                    {new Intl.DateTimeFormat(locale, {
                      timeZone: r.markets.timezone,
                      dateStyle: 'medium',
                    }).format(new Date(r.created_at))}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav className="customer-links" aria-label={t.myRequests}>
        {page > 1 && <Link href={`?page=${page - 1}`}>{t.previousPage}</Link>}
        {data.length > 20 && <Link href={`?page=${page + 1}`}>{t.nextPage}</Link>}
      </nav>
    </div>
  );
}
