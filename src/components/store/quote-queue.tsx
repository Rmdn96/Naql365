import Link from 'next/link';
import { quoteQueue } from '@/domain/store/quote';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import type { Locale } from '@/i18n/config';
import { QuoteReviewForm } from './quote-admin-forms';
import { storeMoney } from '@/i18n/store';

export async function QuoteQueue({
  locale,
  before,
}: {
  locale: Locale;
  before?: string | undefined;
}) {
  const client = await createSupabaseServerClient();
  const ar = locale === 'ar';
  const result = await client.rpc('store_quote_queue', before ? { p_before: before } : {});
  const list = quoteQueue.safeParse(result.data);
  if (result.error || !list.success)
    return <p role="alert">{ar ? 'قائمة التسعير غير متاحة' : 'Quote queue unavailable'}</p>;
  return (
    <section className="stack">
      <h1>{ar ? 'طلبات تسعير المنتجات' : 'Product quote requests'}</h1>
      {!list.data.length && <p>{ar ? 'لا توجد طلبات تسعير' : 'No quote requests'}</p>}
      {list.data.map((q) => (
        <article className="card stack" key={q.id}>
          <h2>
            <bdi>{q.reference}</bdi>
          </h2>
          <p>
            {q.contact.full_name} · <bdi>{q.contact.phone}</bdi> · {q.contact.governorate} ·{' '}
            {q.contact.area} · {q.contact.address}
          </p>
          {q.contact.notes && <p>{q.contact.notes}</p>}
          <ul>
            {q.items.map((item) => (
              <li key={item.sku}>
                <bdi>{item.sku}</bdi> · {ar ? item.content.title_ar : item.content.title_en} ×{' '}
                {item.quantity}
                {q.offer && ' · ' + storeMoney(q.offer.prices[item.sku]!, locale)}
              </li>
            ))}
          </ul>
          {q.offer && (
            <p>
              {ar ? 'الإجمالي شاملاً التوصيل' : 'Total including delivery'}{' '}
              {storeMoney(q.offer.total, locale)} · {ar ? 'النسخة' : 'Version'} {q.offer.version}
            </p>
          )}
          {q.confirmed_at ? (
            <p>{ar ? 'سُجلت موافقة العميل على العرض' : 'Customer consent recorded'}</p>
          ) : (
            <>
              <QuoteReviewForm
                key={q.revision + '-offer'}
                locale={locale}
                id={q.id}
                revision={q.revision}
                items={q.items.map((item) => ({
                  sku: item.sku,
                  quantity: item.quantity,
                  name: ar ? item.content.title_ar : item.content.title_en,
                }))}
              />
              {q.offer && (
                <QuoteReviewForm
                  key={q.revision + '-consent'}
                  locale={locale}
                  id={q.id}
                  revision={q.revision}
                  items={[]}
                  confirm
                />
              )}
            </>
          )}
        </article>
      ))}
      {list.data.length === 30 && (
        <Link href={'?kind=quotes&before=' + encodeURIComponent(list.data[29]!.created_at)}>
          {ar ? 'الأقدم' : 'Older'}
        </Link>
      )}
    </section>
  );
}
