'use client';
import { useActionState } from 'react';
import { approveQuoteProduct, changeQuote } from '@/app/store-quote-actions';
import type { Locale } from '@/i18n/config';

export function QuoteReviewForm({
  locale,
  id,
  revision,
  items,
  confirm = false,
}: {
  locale: Locale;
  id: string;
  revision: number;
  items: { sku: string; name: string; quantity: number }[];
  confirm?: boolean;
}) {
  const ar = locale === 'ar';
  const [status, action, pending] = useActionState(
    changeQuote.bind(null, locale, id, revision, confirm),
    '',
  );
  return (
    <form action={action} className="store-form">
      {confirm ? (
        <label>
          {ar ? 'مرجع موافقة العميل على نسخة العرض' : 'Customer consent reference for this offer'}{' '}
          <input name="evidence" required maxLength={200} />
        </label>
      ) : (
        <>
          {items.map(({ sku, name, quantity }) => (
            <label key={sku}>
              {name} × {quantity} · {ar ? 'سعر الوحدة بالجنيه' : 'Unit price (EGP)'}{' '}
              <input
                name={'sku:' + sku}
                required
                type="number"
                min="0.01"
                max="9999999.99"
                step="0.01"
              />
            </label>
          ))}
          <label>
            {ar ? 'التوصيل بالجنيه' : 'Delivery (EGP)'}{' '}
            <input name="delivery" required type="number" min="0" max="9999999.99" step="0.01" />
          </label>
        </>
      )}
      <p role="status">
        {status === 'saved'
          ? ar
            ? 'تم الحفظ'
            : 'Saved'
          : status === 'error'
            ? ar
              ? 'تعذر الحفظ. تحقق من البيانات وأعد تحميل الصفحة.'
              : 'Unable to save. Check the details and reload.'
            : ''}
      </p>
      <button className="button button--primary" disabled={pending}>
        {confirm
          ? ar
            ? 'سجل الموافقة'
            : 'Record consent'
          : ar
            ? 'احفظ نسخة العرض'
            : 'Save offer version'}
      </button>
    </form>
  );
}

export function QuotePublication({
  locale,
  id,
  revision,
}: {
  locale: Locale;
  id: string;
  revision: number;
}) {
  const ar = locale === 'ar';
  const [status, action, pending] = useActionState(
    approveQuoteProduct.bind(null, locale, id, revision),
    '',
  );
  return (
    <details>
      <summary>{ar ? 'عرض للتسعير' : 'Quote catalog approval'}</summary>
      <form action={action} className="store-form">
        <label>
          <input type="checkbox" name="confirmed" />{' '}
          {ar
            ? 'راجعت الوصف والمواصفات والتوفر ومكونات الباقة إن وُجدت'
            : 'I reviewed the description, specifications, availability and any kit components'}
        </label>
        <button className="button" name="action" value="publish" disabled={pending}>
          {ar ? 'اعتمد النسخة للتسعير' : 'Approve revision for quotes'}
        </button>
        <button className="button" name="action" value="withdraw" disabled={pending}>
          {ar ? 'اسحب الاعتماد' : 'Withdraw approval'}
        </button>
        <p role="status">
          {status === 'saved'
            ? ar
              ? 'تم الحفظ'
              : 'Saved'
            : status === 'error'
              ? ar
                ? 'راجع الاعتماد وحالة التصنيف والنسخة.'
                : 'Check approval, category status and revision.'
              : ''}
        </p>
      </form>
    </details>
  );
}
