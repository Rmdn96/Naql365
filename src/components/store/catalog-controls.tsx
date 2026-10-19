'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@/components/ui/primitives';
import { storeText } from '@/i18n/store';
export function CatalogApprove({
  locale,
  kind,
  target,
  revision,
  parent,
}: {
  locale: 'ar' | 'en';
  kind: 'categories' | 'prices' | 'listings';
  target: string;
  revision: number;
  parent: boolean;
}) {
  const t = storeText[locale],
    ar = locale === 'ar',
    router = useRouter(),
    ids = useRef(new Map<string, string>()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const refs = [
    'product_revision',
    'category_revision',
    'price_id',
    'price_revision',
    'offer_id',
    'offer_revision',
    'identity_policy_id',
    'identity_policy_revision',
    'delivery_policy_id',
    'delivery_policy_revision',
    'returns_policy_id',
    'returns_policy_revision',
  ];
  const labels: Record<string, [string, string]> = {
    product_revision: ['نسخة المنتج', 'Product revision'],
    category_revision: ['نسخة الفئة', 'Category revision'],
    price_id: ['مرجع السعر المعتمد', 'Approved price reference'],
    price_revision: ['نسخة السعر', 'Price revision'],
    offer_id: ['مرجع عرض التوريد المعتمد', 'Approved sourcing offer reference'],
    offer_revision: ['نسخة عرض التوريد', 'Offer revision'],
    identity_policy_id: ['مرجع سياسة الهوية', 'Identity policy reference'],
    identity_policy_revision: ['نسخة سياسة الهوية', 'Identity policy revision'],
    delivery_policy_id: ['مرجع سياسة التوصيل', 'Delivery policy reference'],
    delivery_policy_revision: ['نسخة سياسة التوصيل', 'Delivery policy revision'],
    returns_policy_id: ['مرجع سياسة الإرجاع', 'Returns policy reference'],
    returns_policy_revision: ['نسخة سياسة الإرجاع', 'Returns policy revision'],
  };
  return (
    <details>
      <summary>{ar ? 'مراجعة واعتماد النشر' : 'Review and approve publication'}</summary>
      <form
        className="store-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const data = new FormData(e.currentTarget);
          const operation = {
            categories: 'approve_category',
            prices: 'approve_price',
            listings: 'publish_listing',
          }[kind];
          const payload: Record<string, string | number | null> = {};
          if (kind === 'categories')
            payload.parent_revision = parent ? Number(data.get('parent_revision')) : null;
          if (kind === 'listings')
            for (const key of refs)
              payload[key] = key.endsWith('_revision')
                ? Number(data.get(key))
                : String(data.get(key));
          const body = { family: 'publication', operation, target, revision, payload },
            key = JSON.stringify(body);
          if (!ids.current.has(key)) ids.current.set(key, crypto.randomUUID());
          setBusy(true);
          setError(false);
          try {
            const r = await fetch('/api/store/catalog', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...body, mutationId: ids.current.get(key) }),
            });
            if (!r.ok) throw Error('Publication unconfirmed');
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && <Alert tone="error">{t.error}</Alert>}
        {kind === 'categories' && parent && (
          <Input
            id={'parent-' + target}
            name="parent_revision"
            label={ar ? 'نسخة الفئة الأصل المعتمدة' : 'Approved parent category revision'}
            type="number"
            min={1}
            required
          />
        )}
        {kind === 'listings' &&
          refs.map((key) => (
            <Input
              id={key + '-' + target}
              key={key}
              name={key}
              label={labels[key]![ar ? 0 : 1]}
              type={key.endsWith('_revision') ? 'number' : 'text'}
              min={1}
              required
            />
          ))}
        <label className="store-check">
          <input type="checkbox" required />
          {ar
            ? 'راجعت النسخ والموافقات الفعلية المشار إليها'
            : 'I checked the referenced versions and actual approvals'}
        </label>
        <Button disabled={busy}>{t.save}</Button>
      </form>
    </details>
  );
}
export function CatalogCreate({
  locale,
  kind,
}: {
  locale: 'ar' | 'en';
  kind: 'products' | 'categories' | 'listings' | 'prices';
}) {
  const t = storeText[locale],
    ar = locale === 'ar',
    router = useRouter(),
    ids = useRef(new Map<string, string>()),
    [busy, setBusy] = useState(false),
    [state, setState] = useState<'success' | 'error' | null>(null);
  const labels = {
    slug: ar ? 'رابط المنتج / الفئة' : 'Product / category slug',
    sku: ar ? 'رمز المنتج' : 'SKU',
    category_id: ar ? 'مرجع الفئة' : 'Category reference',
    product_id: ar ? 'مرجع المنتج' : 'Product reference',
    listing_id: ar ? 'مرجع النشر' : 'Listing reference',
    presentation_policy_id: ar ? 'مرجع سياسة السعر المعتمدة' : 'Approved retail policy reference',
    version: ar ? 'رقم النسخة' : 'Version',
    amount_minor: t.amount,
    effective_from: ar ? 'بداية السريان' : 'Effective from',
    title_ar: 'العنوان العربي',
    title_en: 'English title',
  };
  const fields =
    kind === 'products'
      ? (['slug', 'sku', 'category_id', 'title_ar', 'title_en'] as const)
      : kind === 'categories'
        ? (['slug', 'title_ar', 'title_en'] as const)
        : kind === 'listings'
          ? (['product_id'] as const)
          : ([
              'listing_id',
              'presentation_policy_id',
              'version',
              'amount_minor',
              'effective_from',
            ] as const);
  return (
    <details>
      <summary>{ar ? 'إضافة مسودة' : 'Create draft'}</summary>
      <form
        className="store-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const data = new FormData(e.currentTarget);
          const payload: Record<string, string | number | { title_ar: string; title_en: string }> =
            {};
          for (const key of fields) {
            if (key === 'title_ar' || key === 'title_en') continue;
            payload[key] = ['version', 'amount_minor'].includes(key)
              ? Number(data.get(key))
              : key === 'effective_from'
                ? new Date(String(data.get(key))).toISOString()
                : String(data.get(key));
          }
          if (kind === 'products' || kind === 'categories')
            payload.content = {
              title_ar: String(data.get('title_ar')),
              title_en: String(data.get('title_en')),
            };
          const operation = {
            products: 'create_product',
            categories: 'create_category',
            listings: 'create_listing',
            prices: 'create_price',
          }[kind];
          const body = { family: 'draft', operation, payload };
          const key = JSON.stringify(body);
          if (!ids.current.has(key)) ids.current.set(key, crypto.randomUUID());
          setBusy(true);
          setState(null);
          try {
            const r = await fetch('/api/store/catalog', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...body, mutationId: ids.current.get(key) }),
            });
            if (!r.ok) throw Error('Unconfirmed catalog draft');
            setState('success');
            router.refresh();
          } catch {
            setState('error');
          } finally {
            setBusy(false);
          }
        }}
      >
        {state && <Alert tone={state}>{t[state]}</Alert>}
        {fields.map((field) => (
          <Input
            key={field}
            id={'catalog-' + field}
            name={field}
            label={labels[field]}
            type={
              ['version', 'amount_minor'].includes(field)
                ? 'number'
                : field === 'effective_from'
                  ? 'datetime-local'
                  : 'text'
            }
            required
            maxLength={200}
            min={1}
          />
        ))}
        <Button disabled={busy}>{busy ? t.busy : t.save}</Button>
      </form>
    </details>
  );
}
