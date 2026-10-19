'use client';
import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input } from '@/components/ui/primitives';
import { storeText } from '@/i18n/store';

type Locale = 'ar' | 'en';
type Spec = { label_ar: string; label_en: string; value_ar: string; value_en: string };
type Content = {
  title_ar: string;
  title_en: string;
  description_ar?: string | undefined;
  description_en?: string | undefined;
  specifications?: Spec[] | undefined;
};
type Intent = {
  family: string;
  operation: string;
  target?: string;
  revision?: number | undefined;
  payload: object;
};
function useCatalogCommand(locale: Locale) {
  const router = useRouter(),
    ids = useRef(new Map<string, string>()),
    [busy, setBusy] = useState(false),
    [state, setState] = useState<'error' | 'success' | null>(null);
  async function execute(intent: Intent) {
    const key = JSON.stringify(intent);
    if (busy) return false;
    if (!ids.current.has(key)) ids.current.set(key, crypto.randomUUID());
    setBusy(true);
    setState(null);
    try {
      const response = await fetch('/api/store/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...intent, mutationId: ids.current.get(key) }),
      });
      if (!response.ok) throw Error('Catalog change unconfirmed');
      setState('success');
      router.refresh();
      return true;
    } catch {
      setState('error');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    execute,
    busy,
    feedback: state && <Alert tone={state}>{storeText[locale][state]}</Alert>,
  };
}
export function CatalogDraftEditor({
  locale,
  kind,
  row,
}: {
  locale: Locale;
  kind: 'products' | 'categories';
  row?: {
    id: string;
    revision: number;
    categoryId?: string | undefined;
    parentId?: string | null | undefined;
    content?: Content | undefined;
    sku?: string | undefined;
    slug?: string | undefined;
  };
}) {
  const ar = locale === 'ar',
    command = useCatalogCommand(locale),
    content = row?.content;
  const [specs, setSpecs] = useState<Spec[]>(content?.specifications ?? []);
  const prefix = (row?.id ?? 'new') + '-' + kind;
  return (
    <details>
      <summary>
        {row ? (ar ? 'تعديل المسودة' : 'Edit draft') : ar ? 'إضافة مسودة' : 'Create draft'}
      </summary>
      <form
        className="store-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value: Content = {
            title_ar: String(f.get('title_ar')),
            title_en: String(f.get('title_en')),
          };
          if (kind === 'products') {
            value.description_ar = String(f.get('description_ar'));
            value.description_en = String(f.get('description_en'));
            value.specifications = specs;
          }
          const payload: Record<string, unknown> = { content: value };
          if (!row) {
            payload.slug = String(f.get('slug'));
            if (kind === 'products') payload.sku = String(f.get('sku'));
          }
          if (kind === 'products') payload.category_id = String(f.get('category_id'));
          else payload.parent_id = String(f.get('parent_id')) || null;
          await command.execute({
            family: 'draft',
            operation: (row ? 'save_' : 'create_') + (kind === 'products' ? 'product' : 'category'),
            ...(row ? { target: row.id, revision: row.revision } : {}),
            payload,
          });
        }}
      >
        {command.feedback}
        {row && (
          <p>
            {row.sku} · {row.slug}
          </p>
        )}
        {!row && (
          <Input
            id={prefix + 'slug'}
            name="slug"
            label={ar ? 'الرابط الثابت' : 'Permanent slug'}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            maxLength={100}
            required
          />
        )}
        {!row && kind === 'products' && (
          <Input id={prefix + 'sku'} name="sku" label="SKU" maxLength={80} required />
        )}
        <Input
          id={prefix + 'title-ar'}
          name="title_ar"
          label="العنوان العربي"
          defaultValue={content?.title_ar}
          maxLength={200}
          required
        />
        <Input
          id={prefix + 'title-en'}
          name="title_en"
          label="English title"
          defaultValue={content?.title_en}
          maxLength={200}
          required
        />
        <Input
          id={prefix + 'category'}
          name={kind === 'products' ? 'category_id' : 'parent_id'}
          label={
            kind === 'products'
              ? ar
                ? 'مرجع الفئة'
                : 'Category reference'
              : ar
                ? 'مرجع الفئة الأصل (اختياري)'
                : 'Parent category reference (optional)'
          }
          defaultValue={row?.categoryId ?? row?.parentId ?? ''}
          required={kind === 'products'}
        />
        {kind === 'products' && (
          <>
            <label htmlFor={prefix + 'description-ar'}>الوصف العربي</label>
            <textarea
              id={prefix + 'description-ar'}
              name="description_ar"
              defaultValue={content?.description_ar}
              maxLength={4000}
              rows={3}
            />
            <label htmlFor={prefix + 'description-en'}>English description</label>
            <textarea
              id={prefix + 'description-en'}
              name="description_en"
              defaultValue={content?.description_en}
              maxLength={4000}
              rows={3}
            />
            <p>
              {ar
                ? 'المواصفات العلنية فقط: الوحدة، عدد القطع، الأبعاد بالسنتيمتر، الطبقات، الحالة (جديد/مستعمل). لا تُدخل تكلفة أو هامشًا.'
                : 'Public specifications only: unit, package quantity, dimensions in cm, ply and condition (NEW/USED). Never enter costs or margin.'}
            </p>
            {specs.map((spec, i) => (
              <fieldset key={i}>
                <legend>
                  {ar ? 'المواصفة' : 'Specification'} {i + 1}
                </legend>
                {(['label_ar', 'label_en', 'value_ar', 'value_en'] as const).map((key) => (
                  <Input
                    key={key}
                    id={prefix + key + i}
                    label={
                      {
                        label_ar: 'اسم المواصفة',
                        label_en: 'Specification name',
                        value_ar: 'القيمة العربية',
                        value_en: 'English value',
                      }[key]
                    }
                    value={spec[key]}
                    maxLength={200}
                    required
                    onChange={(e) =>
                      setSpecs((old) =>
                        old.map((s, n) => (n === i ? { ...s, [key]: e.target.value } : s)),
                      )
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSpecs((old) => old.filter((_, n) => n !== i))}
                >
                  {ar ? 'حذف المواصفة' : 'Remove specification'}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={specs.length >= 30}
              onClick={() =>
                setSpecs((old) => [
                  ...old,
                  { label_ar: '', label_en: '', value_ar: '', value_en: '' },
                ])
              }
            >
              {ar ? 'إضافة مواصفة' : 'Add specification'}
            </Button>
          </>
        )}
        <Button disabled={command.busy}>
          {command.busy ? storeText[locale].busy : storeText[locale].save}
        </Button>
      </form>
    </details>
  );
}
type Field = {
  key: string;
  ar: string;
  en: string;
  type?: 'number' | 'datetime-local';
  optional?: boolean;
  value?: string | number;
};
export function CatalogFields({
  locale,
  title,
  fields,
  intent,
  children,
}: {
  locale: Locale;
  title: string;
  fields: Field[];
  intent: Omit<Intent, 'payload'> & { base?: Record<string, unknown> };
  children?: ReactNode;
}) {
  const command = useCatalogCommand(locale),
    prefix = intent.operation + (intent.target ?? 'new');
  return (
    <details>
      <summary>{title}</summary>
      <form
        className="store-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            payload: Record<string, unknown> = { ...intent.base };
          for (const field of fields) {
            const raw = String(f.get(field.key) ?? '');
            if (raw === '' && field.optional && !field.type) continue;
            payload[field.key] =
              raw === '' && field.optional
                ? null
                : field.type === 'number'
                  ? Number(raw)
                  : field.type === 'datetime-local'
                    ? new Date(raw + 'Z').toISOString()
                    : raw;
          }
          await command.execute({
            family: intent.family,
            operation: intent.operation,
            ...(intent.target ? { target: intent.target, revision: intent.revision } : {}),
            payload,
          });
        }}
      >
        {command.feedback}
        {children}
        {fields.map((field) => (
          <Input
            key={field.key}
            id={prefix + field.key}
            name={field.key}
            label={
              (locale === 'ar' ? field.ar : field.en) +
              (field.type === 'datetime-local' ? ' (UTC)' : '')
            }
            type={field.type ?? 'text'}
            defaultValue={field.value}
            required={!field.optional}
            min={
              field.key.toLowerCase().includes('amount') || field.key === 'unit_cost_minor' ? 0 : 1
            }
            step={field.type === 'number' ? 1 : undefined}
            maxLength={200}
          />
        ))}
        <Button disabled={command.busy}>{storeText[locale].save}</Button>
      </form>
    </details>
  );
}
export function CatalogReference({ locale }: { locale: Locale }) {
  const command = useCatalogCommand(locale),
    ar = locale === 'ar';
  return (
    <details>
      <summary>
        {ar ? 'A — تسجيل سعر المورد العلني المرجعي' : 'A — Record supplier public reference price'}
      </summary>
      <form
        className="store-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await command.execute({
            family: 'extension',
            operation: 'reference_price',
            target: String(f.get('product')),
            revision: Number(f.get('revision')),
            payload: {
              supplierId: String(f.get('supplier')),
              version: Number(f.get('version')),
              amountMinor: String(f.get('amount')) === '' ? null : Number(f.get('amount')),
              observedAt: new Date(String(f.get('observed'))).toISOString(),
              evidenceReference: String(f.get('evidence')),
            },
          });
        }}
      >
        <p>
          {ar
            ? 'مرجع داخلي فقط؛ لا يحدد تكلفة التوريد أو سعر العميل. القيمة الفارغة تعني غير مؤكدة.'
            : 'Internal reference only; does not set supplier entitlement or customer retail. Blank amount means unconfirmed.'}
        </p>
        {command.feedback}
        {(
          ['product', 'supplier', 'revision', 'version', 'amount', 'observed', 'evidence'] as const
        ).map((key) => (
          <Input
            key={key}
            id={'reference-' + key}
            name={key}
            label={
              {
                product: ar ? 'مرجع المنتج' : 'Product reference',
                supplier: ar ? 'مرجع المورد' : 'Supplier reference',
                revision: ar ? 'نسخة المنتج الحالية' : 'Current product revision',
                version: ar ? 'نسخة الملاحظة' : 'Observation version',
                amount: ar ? 'القيمة بالقرش (اختياري)' : 'Amount in EGP piastres (optional)',
                observed: ar ? 'تاريخ المشاهدة' : 'Observed at',
                evidence: ar ? 'مرجع المصدر' : 'Source reference',
              }[key]
            }
            type={
              key === 'observed'
                ? 'datetime-local'
                : ['revision', 'version', 'amount'].includes(key)
                  ? 'number'
                  : 'text'
            }
            min={key === 'amount' ? 0 : 1}
            step={1}
            required={key !== 'amount'}
            maxLength={200}
          />
        ))}
        <Button disabled={command.busy}>{storeText[locale].save}</Button>
      </form>
    </details>
  );
}
type Media = { src: string; altAr: string; altEn: string };
export function CatalogMedia({
  locale,
  listingId,
  revision,
  initial,
  publish,
  pending,
}: {
  locale: Locale;
  listingId: string;
  revision: number;
  initial: Media[];
  publish: boolean;
  pending: { src: string }[];
}) {
  const ar = locale === 'ar',
    command = useCatalogCommand(locale),
    [media, setMedia] = useState(initial),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(false),
    uploadIds = useRef<{ assetId: string; reserveId: string; finalizeId: string } | null>(null);
  return (
    <details>
      <summary>{ar ? 'صور المنتج وترتيبها' : 'Product images and order'}</summary>
      <p>
        {ar
          ? 'JPEG / PNG / WebP حتى 4 MB. تُجهز كـ WebP؛ اعتماد الناشر مطلوب قبل العرض.'
          : 'JPEG / PNG / WebP up to 4 MB. Converted to WebP; publisher approval is required before display.'}
      </p>
      {error && <Alert tone="error">{storeText[locale].error}</Alert>}
      {pending
        .filter((image) => !media.some((selected) => selected.src === image.src))
        .map((image) => (
          <div key={image.src}>
            <a href={image.src} target="_blank" rel="noopener noreferrer">
              {ar ? 'معاينة مسودة مرفوعة' : 'Preview uploaded draft'}
            </a>
            <Button
              type="button"
              variant="secondary"
              disabled={media.length >= 5}
              onClick={() =>
                setMedia((old) =>
                  old.some((selected) => selected.src === image.src)
                    ? old
                    : [...old, { src: image.src, altAr: '', altEn: '' }],
                )
              }
            >
              {ar ? 'إضافة الصورة للاعتماد' : 'Select uploaded draft'}
            </Button>
          </div>
        ))}
      <form
        className="store-form"
        onChange={() => {
          uploadIds.current = null;
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (uploading) return;
          setUploading(true);
          setError(false);
          const f = new FormData(e.currentTarget);
          uploadIds.current ??= {
            assetId: crypto.randomUUID(),
            reserveId: crypto.randomUUID(),
            finalizeId: crypto.randomUUID(),
          };
          for (const [key, value] of Object.entries({
            ...uploadIds.current,
            listingId,
            revision: String(revision),
          }))
            f.set(key, value);
          try {
            const response = await fetch('/api/store/media', { method: 'POST', body: f });
            if (!response.ok) throw Error('Upload unconfirmed');
            const body = await response.json();
            const value = body.data ?? body;
            if (
              typeof value.src !== 'string' ||
              !/^\/api\/store\/media\/[a-f0-9-]{36}$/.test(value.src)
            )
              throw Error('Invalid image result');
            setMedia((old) =>
              old.some((x) => x.src === value.src)
                ? old
                : [...old, { src: value.src, altAr: '', altEn: '' }],
            );
            uploadIds.current = null;
          } catch {
            setError(true);
          } finally {
            setUploading(false);
          }
        }}
      >
        <label htmlFor={'file-' + listingId}>{ar ? 'ملف الصورة' : 'Image file'}</label>
        <input
          id={'file-' + listingId}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
        <Input
          id={'rights-' + listingId}
          name="rightsReference"
          label={ar ? 'مرجع موافقة حقوق الصورة' : 'Image rights approval reference'}
          maxLength={200}
          required
        />
        <Button disabled={uploading || media.length >= 5}>
          {uploading ? storeText[locale].busy : ar ? 'رفع الصورة' : 'Upload image'}
        </Button>
      </form>
      <form
        className="store-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await command.execute({
            family: 'extension',
            operation: 'attach_media',
            target: listingId,
            revision,
            payload: { media },
          });
        }}
      >
        {command.feedback}
        {media.map((image, i) => (
          <fieldset key={image.src}>
            <legend>
              {ar ? 'الصورة' : 'Image'} {i + 1}
            </legend>
            <a href={image.src} target="_blank" rel="noopener noreferrer">
              {ar ? 'معاينة' : 'Preview'}
            </a>
            <Input
              id={listingId + 'alt-ar' + i}
              label="الوصف البديل العربي"
              value={image.altAr}
              maxLength={200}
              required
              onChange={(e) =>
                setMedia((old) =>
                  old.map((x, n) => (n === i ? { ...x, altAr: e.target.value } : x)),
                )
              }
            />
            <Input
              id={listingId + 'alt-en' + i}
              label="English alternative text"
              value={image.altEn}
              maxLength={200}
              required
              onChange={(e) =>
                setMedia((old) =>
                  old.map((x, n) => (n === i ? { ...x, altEn: e.target.value } : x)),
                )
              }
            />
            <Button
              type="button"
              variant="secondary"
              disabled={i === 0}
              onClick={() =>
                setMedia((old) => {
                  const next = [...old];
                  [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                  return next;
                })
              }
            >
              {ar ? 'تحريك للأعلى' : 'Move up'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMedia((old) => old.filter((_, n) => n !== i))}
            >
              {ar ? 'إزالة من العرض' : 'Remove from display'}
            </Button>
          </fieldset>
        ))}
        <Button disabled={!publish || command.busy || uploading}>
          {ar ? 'اعتماد الصور والترتيب' : 'Approve images and order'}
        </Button>
      </form>
    </details>
  );
}
