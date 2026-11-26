'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  useGuestBasket,
  setBasketQuantity,
  beginGuestOrder,
  finishGuestOrder,
  releaseGuestOrder,
} from './guest-basket';
import type { Locale } from '@/i18n/config';
import { storeMoney } from '@/i18n/store';

export function GuestCheckout({ locale, available }: { locale: Locale; available: boolean }) {
  const ar = locale === 'ar';
  const { lines, pending: pendingRequest } = useGuestBasket();
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending.current || !available) return;
    const form = new FormData(e.currentTarget);
    if (!String(form.get('notes') ?? '').trim()) form.delete('notes');
    const fields = Object.fromEntries(form);
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const { requestId, lines: items } = beginGuestOrder();
      const response = await fetch('/api/store/guest-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          request_id: requestId,
          items: items.map((line) => ({
            listing_id: line.id,
            quantity: line.quantity,
            unit_price: line.unitMinor / 100,
          })),
        }),
      });
      if (!response.ok) {
        const issue = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status >= 400 && response.status < 500 && issue?.error !== 'request_changed')
          releaseGuestOrder(requestId);
        if (issue?.error === 'request_changed')
          setError(
            ar
              ? 'يوجد طلب سابق بنفس المرجع. أعد المحاولة بنفس البيانات أو تواصل معنا.'
              : 'A previous submission used this reference. Retry with the original details or contact us.',
          );
        else if (response.status === 429)
          setError(
            ar
              ? 'طلبات كثيرة. انتظر قليلًا قبل إعادة المحاولة.'
              : 'Too many requests. Please wait before retrying.',
          );
        else if (response.status === 409)
          setError(
            ar
              ? 'تغيّر السعر أو التوفر، أو سبق إرسال الطلب. راجع السلة قبل المحاولة مجددًا.'
              : 'Price or availability changed, or the request already exists. Review your basket before retrying.',
          );
        else if (response.status === 400 || response.status === 422)
          setError(
            ar
              ? 'راجع بيانات التوصيل وكميات المنتجات.'
              : 'Check the delivery details and quantities.',
          );
        else throw new Error('order submission unconfirmed');
        return;
      }
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        !result ||
        !('reference' in result) ||
        typeof result.reference !== 'string' ||
        !/^S-[a-f0-9]{32}$/.test(result.reference)
      )
        throw new Error('order submission unconfirmed');
      setReference(result.reference);
      finishGuestOrder(requestId);
    } catch {
      setError(
        ar
          ? 'تعذر تأكيد الإرسال. أعد المحاولة بنفس البيانات.'
          : 'Submission could not be confirmed. Retry with the same details.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const failedStorage = () =>
    setError(ar ? 'تعذر تحديث السلة على هذا الجهاز.' : 'This device could not save your basket.');
  return (
    <div className="cm-container launch-cart">
      <h1>{ar ? 'السلة وإتمام الطلب' : 'Cart and checkout'}</h1>
      {reference ? (
        <section role="status">
          <h2>{ar ? 'تم استلام طلبك' : 'Order received'}</h2>
          <p>
            {ar ? 'رقم الطلب' : 'Order reference'}{' '}
            <strong dir="ltr" className="guest-order-reference">
              {reference}
            </strong>
          </p>
          <p>
            {ar
              ? 'سنتواصل معك لتأكيد التوفر ورسوم التوصيل والإجمالي.'
              : 'We will contact you to confirm availability, delivery fees and the final total.'}
          </p>
          <Link href={'/' + locale}>{ar ? 'متابعة التسوق' : 'Continue shopping'}</Link>
        </section>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          {pendingRequest && !busy && (
            <p role="status">
              {ar
                ? 'لديك محاولة إرسال غير مؤكدة. أعد إرسال البيانات نفسها للتحقق.'
                : 'A submission is unconfirmed. Submit the same details again to confirm it.'}
            </p>
          )}
          {!lines.length ? (
            <p>
              {ar ? 'السلة فارغة.' : 'Your cart is empty.'}{' '}
              <Link href={'/' + locale}>{ar ? 'تصفح المنتجات' : 'Browse products'}</Link>
            </p>
          ) : (
            <div className="launch-checkout-layout">
              <section className="launch-order-summary">
                <h2>{ar ? 'المنتجات' : 'Products'}</h2>
                <div className="launch-lines">
                  {lines.map((line) => (
                    <article className="store-line" key={line.id}>
                      <Link
                        href={'/' + locale + '/store/products/' + encodeURIComponent(line.slug)}
                      >
                        {line.name[locale]}
                      </Link>
                      <span>{storeMoney(line.unitMinor, locale)}</span>
                      <label>
                        {ar ? 'الكمية' : 'Quantity'}{' '}
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={line.quantity}
                          disabled={busy || !!pendingRequest}
                          onChange={(event) => {
                            const quantity = event.currentTarget.valueAsNumber;
                            if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99)
                              try {
                                setBasketQuantity(line.id, quantity);
                              } catch {
                                failedStorage();
                              }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy || !!pendingRequest}
                        onClick={() => {
                          try {
                            setBasketQuantity(line.id, 0);
                          } catch {
                            failedStorage();
                          }
                        }}
                      >
                        {ar ? 'إزالة' : 'Remove'}
                      </button>
                    </article>
                  ))}
                </div>
                <p className="launch-subtotal">
                  <strong>
                    {ar ? 'إجمالي المنتجات' : 'Product subtotal'} ·{' '}
                    {storeMoney(
                      lines.reduce((n, l) => n + l.quantity * l.unitMinor, 0),
                      locale,
                    )}
                  </strong>
                </p>
                <p>
                  {ar
                    ? 'التوصيل داخل القاهرة والجيزة. نؤكد رسوم التوصيل والإجمالي النهائي معك قبل تجهيز الطلب أو طلب التحويل.'
                    : 'Delivery in Cairo and Giza. We will confirm the delivery fee and final total with you before preparing your order or requesting a transfer.'}
                </p>
              </section>
              {available ? (
                <form id="guest-checkout" onSubmit={submit}>
                  <fieldset disabled={busy}>
                    <legend>{ar ? 'بيانات التوصيل' : 'Delivery details'}</legend>
                    <label>
                      {ar ? 'الاسم الكامل' : 'Full name'}
                      <input
                        name="full_name"
                        autoComplete="name"
                        minLength={2}
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>
                      {ar ? 'رقم الهاتف' : 'Phone number'}
                      <input
                        name="phone"
                        type="tel"
                        dir="ltr"
                        autoComplete="tel"
                        pattern="[+]?[0-9]{8,15}"
                        maxLength={16}
                        required
                      />
                    </label>
                    <label>
                      {ar ? 'المحافظة' : 'Governorate'}
                      <select name="governorate" required defaultValue="">
                        <option value="" disabled>
                          {ar ? 'اختر المحافظة' : 'Select governorate'}
                        </option>
                        <option value="CAIRO">{ar ? 'القاهرة' : 'Cairo'}</option>
                        <option value="GIZA">{ar ? 'الجيزة' : 'Giza'}</option>
                      </select>
                    </label>
                    <label>
                      {ar ? 'المنطقة' : 'Area'}
                      <input
                        name="area"
                        autoComplete="address-level2"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </label>
                    <label>
                      {ar ? 'العنوان التفصيلي' : 'Street address'}
                      <textarea
                        name="address"
                        autoComplete="street-address"
                        required
                        minLength={3}
                        maxLength={500}
                      />
                    </label>
                    <label>
                      {ar ? 'طريقة الدفع' : 'Payment method'}
                      <select name="payment_method" defaultValue="CASH">
                        <option value="CASH">
                          {ar ? 'الدفع عند الاستلام' : 'Cash on delivery'}
                        </option>
                        <option value="BANK_TRANSFER">
                          {ar ? 'تحويل بنكي يدوي' : 'Manual bank transfer'}
                        </option>
                        <option value="VODAFONE_CASH">Vodafone Cash</option>
                        <option value="INSTAPAY">InstaPay</option>
                      </select>
                    </label>
                    <label>
                      {ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                      <textarea name="notes" maxLength={500} />
                    </label>
                    <button className="launch-primary" type="submit">
                      {busy
                        ? ar
                          ? 'جارٍ الإرسال…'
                          : 'Submitting…'
                        : ar
                          ? 'إرسال الطلب للمراجعة'
                          : 'Submit order for review'}
                    </button>
                  </fieldset>
                </form>
              ) : (
                <p role="status">
                  {ar ? 'الشراء متوقف حاليًا.' : 'Purchasing is currently unavailable.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
