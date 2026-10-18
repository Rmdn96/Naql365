import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { staffFinanceQueue } from '@/infrastructure/payments/staff-views';
import { paymentDictionary } from '@/i18n/payments';
import { paymentStates } from '@/domain/payments/model';
import { formatMoney } from '@/domain/markets/model';
import { Badge, Card } from '@/components/ui/primitives';
export const dynamic = 'force-dynamic';
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
  const access = await staffAccess('finance.read');
  if (access.status === 'unauthenticated') redirect('/' + locale + '/login');
  if (access.status !== 'authorized') redirect('/' + locale + '/portal');
  const query = await searchParams;
  const page = await staffFinanceQueue(
    Object.fromEntries(
      Object.entries({
        status: query.status || undefined,
        marketId: query.marketId,
        createdAt: query.createdAt,
        id: query.id,
      }).filter(([, v]) => v !== undefined),
    ),
  );
  const t = paymentDictionary(locale);
  const next = page.nextCursor
    ? new URLSearchParams({
        ...page.nextCursor,
        marketId: page.marketId,
        ...(typeof query.status === 'string' ? { status: query.status } : {}),
      })
    : null;
  return (
    <div className="container page staff-page stack">
      <h1>{locale === 'ar' ? 'المالية والمدفوعات' : 'Finance & Payments'}</h1>
      <form method="get" className="actions">
        <label htmlFor="finance-status">{t.status}</label>
        <select
          id="finance-status"
          name="status"
          defaultValue={typeof query.status === 'string' ? query.status : ''}
        >
          <option value="">{locale === 'ar' ? 'كل الحالات' : 'All states'}</option>
          {paymentStates.map((s) => (
            <option key={s} value={s}>
              {t.states[s]}
            </option>
          ))}
        </select>
        <button type="submit">{locale === 'ar' ? 'تطبيق' : 'Apply'}</button>
      </form>
      <p className="muted">
        {locale === 'ar' ? 'العناصر المعروضة' : 'Displayed items'}: {page.items.length}
      </p>
      {!page.items.length && (
        <Card>
          <p>{t.empty}</p>
        </Card>
      )}
      {page.items.map((row) => (
        <Card key={row.orderId}>
          <h2>
            <Link href={'/' + locale + '/portal/finance/' + row.orderId}>
              <bdi>{row.reference}</bdi>
            </Link>
          </h2>
          <p>{row.customerName}</p>
          <Badge>{t.states[row.status]}</Badge>
          <p>{formatMoney(row.amountMinor, row.currency, locale)}</p>
          <p>
            {row.method === 'CASH'
              ? t.cash
              : row.method === 'BANK_TRANSFER'
                ? t.transfer
                : t.states.PENDING}
          </p>
        </Card>
      ))}
      <nav aria-label={t.finance} className="actions">
        <Link
          href={
            '/' +
            locale +
            '/portal/finance' +
            (typeof query.status === 'string' ? '?status=' + encodeURIComponent(query.status) : '')
          }
        >
          {locale === 'ar' ? 'بداية القائمة' : 'First page'}
        </Link>
        {next && <Link href={'/' + locale + '/portal/finance?' + next}>{t.next}</Link>}
      </nav>
    </div>
  );
}
