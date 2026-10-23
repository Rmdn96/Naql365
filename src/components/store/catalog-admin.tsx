import '@/styles/lovable.css';
import '@/styles/lovable-store.css';
import { Button as SourceButton } from '@/components/lovable/button';
import Link from 'next/link';
import { StaffNote } from '@/components/staff/presentation';
import { Badge, Card, EmptyState, Input } from '@/components/ui/primitives';
import { catalogKind, storeCatalogAdmin } from '@/infrastructure/store/catalog';
import { storeMoney, storeText } from '@/i18n/store';
import { CatalogCreate, CatalogApprove } from './catalog-controls';
import {
  CatalogDraftEditor,
  CatalogFields,
  CatalogReference,
  CatalogMedia,
} from './catalog-editor';
import '@/styles/store.css';
export async function CatalogAdmin({
  locale,
  kind,
  after,
  search = '',
  state = '',
}: {
  locale: 'ar' | 'en';
  kind?: string | undefined;
  after?: string | undefined;
  search?: string;
  state?: string;
}) {
  const k = catalogKind.catch('products').parse(kind),
    r = await storeCatalogAdmin(k, after, search, state),
    t = storeText[locale],
    ar = locale === 'ar',
    root = '/' + locale + '/portal/store/catalog';
  const labels = {
    products: ar ? 'المنتجات' : 'Products',
    categories: ar ? 'الفئات' : 'Categories',
    listings: ar ? 'النشر والصور' : 'Publication and images',
    prices: ar ? 'C — سعر العميل' : 'C — Customer retail',
    references: ar ? 'A — سعر المورد المرجعي' : 'A — Supplier reference',
    offers: ar ? 'B — استحقاق المورد' : 'B — Supplier entitlement',
    suppliers: ar ? 'الموردون' : 'Suppliers',
    agreements: ar ? 'اتفاقيات التوريد' : 'Supplier agreements',
    policies: ar ? 'السياسات' : 'Policies',
  };
  const tabs = catalogKind.options.filter(
    (x) =>
      !(['references', 'offers', 'suppliers', 'agreements'].includes(x) && !r.sourcing) &&
      !(x === 'policies' && !r.policies),
  );
  return (
    <div className="lovable cx st store-experience" lang={locale} dir={ar ? 'rtl' : 'ltr'}>
      <div className="st-admin-shell">
        <nav className="st-admin-nav" aria-label={t.catalogAdmin}>
          {tabs.map((x) => (
            <SourceButton key={x} variant="toolbar" asChild>
              <Link aria-current={k === x ? 'page' : undefined} href={root + '?kind=' + x}>
                {labels[x]}
              </Link>
            </SourceButton>
          ))}
        </nav>
        <section className="st-main">
          <div className="st-pagehead">
            <div>
              <span className="st-kicker">{t.catalogAdmin}</span>
              <h1>{labels[k]}</h1>
            </div>
            <SourceButton variant="quiet" asChild>
              <Link href={'/' + locale + '/store'}>{t.catalog}</Link>
            </SourceButton>
          </div>
          <StaffNote>
            {ar
              ? 'الأسعار مستقلة: A مرجع المورد، B استحقاقه المتعاقد عليه، C سعر العميل. لا توجد زيادة تلقائية. الفرق الأولي بين C وB قبل تخصيص الرسوم والضرائب ليس ربحًا صافيًا.'
              : 'Prices are independent: A supplier reference, B contractual entitlement, C customer retail. No automatic markup. The provisional C minus B difference before fee/tax allocations is not net profit.'}
          </StaffNote>
          <form className="store-search" method="get">
            <input type="hidden" name="kind" value={k} />
            <Input
              id="catalog-search"
              name="search"
              label={t.search}
              maxLength={120}
              defaultValue={search}
            />
            <label htmlFor="catalog-state">{ar ? 'الحالة' : 'State'}</label>
            <select id="catalog-state" name="state" defaultValue={state}>
              {['', 'ACTIVE', 'SUSPENDED', 'DRAFT', 'PUBLISHED', 'APPROVED', 'REVOKED'].map((x) => (
                <option key={x} value={x}>
                  {x || (ar ? 'كل الحالات' : 'All states')}
                </option>
              ))}
            </select>
            <button className="button button--secondary">{t.search}</button>
          </form>
          {r.manage && (k === 'products' || k === 'categories') && (
            <CatalogDraftEditor locale={locale} kind={k} />
          )}
          {r.manage && (k === 'prices' || k === 'listings') && (
            <CatalogCreate locale={locale} kind={k} />
          )}
          {r.sourcing && k === 'references' && <CatalogReference locale={locale} />}
          {r.sourcing && k === 'suppliers' && (
            <CatalogFields
              locale={locale}
              title={ar ? 'مسودة مورد جديد' : 'Create supplier draft'}
              intent={{ family: 'sourcing', operation: 'create_supplier' }}
              fields={[
                { key: 'reference', ar: 'مرجع المورد', en: 'Supplier reference' },
                { key: 'name', ar: 'اسم المورد', en: 'Supplier name' },
              ]}
            />
          )}
          {r.sourcing && k === 'offers' && (
            <CatalogFields
              locale={locale}
              title={ar ? 'نسخة استحقاق متعاقد عليه' : 'Create contractual entitlement version'}
              intent={{ family: 'sourcing', operation: 'create_offer' }}
              fields={[
                { key: 'product_id', ar: 'مرجع المنتج', en: 'Product reference' },
                { key: 'supplier_id', ar: 'مرجع المورد', en: 'Supplier reference' },
                { key: 'agreement_id', ar: 'مرجع الاتفاقية', en: 'Agreement reference' },
                { key: 'offer_key', ar: 'رمز العرض', en: 'Offer key' },
                { key: 'version', ar: 'النسخة', en: 'Version', type: 'number' },
                {
                  key: 'unit_cost_minor',
                  ar: 'الاستحقاق المتعاقد عليه بالقرش',
                  en: 'Contractual entitlement in EGP piastres',
                  type: 'number',
                  optional: true,
                },
                {
                  key: 'effective_from',
                  ar: 'بداية السريان',
                  en: 'Effective from',
                  type: 'datetime-local',
                },
                {
                  key: 'evidence_ref',
                  ar: 'مرجع الدليل',
                  en: 'Evidence reference',
                  optional: true,
                },
              ]}
            />
          )}
          <p>
            {t.displayCount}: {r.page.items.length}
          </p>
          {!r.page.items.length && <EmptyState title={t.empty}>{t.catalogAdmin}</EmptyState>}
          <div className="store-products">
            {r.page.items.map((row) => (
              <Card key={row.id}>
                <h2>
                  {(ar ? row.content?.title_ar : row.content?.title_en) ??
                    row.name ??
                    row.agreementCode ??
                    row.code ??
                    row.sku ??
                    row.slug ??
                    labels[k]}
                </h2>
                <p>
                  <Badge>
                    {k === 'references'
                      ? ar
                        ? 'ملاحظة مرجعية'
                        : 'Reference observation'
                      : row.state}
                  </Badge>{' '}
                  · {ar ? 'النسخة' : 'Revision'} {row.revision}
                </p>
                {row.version !== undefined && (
                  <p>
                    {ar ? 'نسخة الشروط' : 'Terms version'} {row.version}
                  </p>
                )}
                {r.sourcing && row.comparison && (
                  <p>
                    {ar
                      ? 'فرق المنتج الأولي C − B (قبل تخصيص التوصيل والضرائب)'
                      : 'Provisional product difference C − B (before delivery/tax allocation)'}
                    : {storeMoney(row.comparison.productDifferenceMinor, locale)}.{' '}
                    {ar ? 'نسخة سعر البيع' : 'Retail version'} {row.comparison.retailVersion} ·{' '}
                    {ar ? 'نسخة الاستحقاق' : 'Entitlement version'} {row.comparison.offerVersion}.{' '}
                    {ar
                      ? 'تُطبّق التخصيصات المعتمدة في الطلب؛ هذا ليس ربحًا صافيًا.'
                      : 'Approved order allocations remain authoritative; this is not net profit.'}
                  </p>
                )}
                {row.amountMinor !== undefined && (
                  <p>
                    {labels[k]}:{' '}
                    {row.amountMinor === null
                      ? ar
                        ? 'غير مؤكد'
                        : 'Unconfirmed'
                      : storeMoney(row.amountMinor, locale)}
                  </p>
                )}
                <details>
                  <summary>{ar ? 'مراجع الإدارة' : 'Administrative references'}</summary>
                  <dl>
                    {Object.entries({
                      id: row.id,
                      product: row.productId,
                      category: row.categoryId,
                      listing: row.listingId,
                      supplier: row.supplierId,
                      agreement: row.agreementId,
                      policy: row.presentationPolicyId,
                    })
                      .filter(([, v]) => v)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd dir="ltr">{value}</dd>
                        </div>
                      ))}
                  </dl>
                </details>
                {r.manage && (k === 'products' || k === 'categories') && (
                  <CatalogDraftEditor
                    key={row.id + '-' + row.revision}
                    locale={locale}
                    kind={k}
                    row={row}
                  />
                )}
                {r.manage && k === 'prices' && row.state === 'DRAFT' && (
                  <CatalogFields
                    locale={locale}
                    title={ar ? 'تعديل مسودة السعر' : 'Edit price draft'}
                    intent={{
                      family: 'draft',
                      operation: 'save_price',
                      target: row.id,
                      revision: row.revision,
                    }}
                    fields={[
                      {
                        key: 'presentation_policy_id',
                        ar: 'مرجع سياسة السعر',
                        en: 'Retail policy reference',
                        ...(row.presentationPolicyId ? { value: row.presentationPolicyId } : {}),
                      },
                      {
                        key: 'amount_minor',
                        ar: 'سعر العميل بالقرش',
                        en: 'Customer retail in EGP piastres',
                        type: 'number',
                        optional: true,
                        ...(row.amountMinor !== null && row.amountMinor !== undefined
                          ? { value: row.amountMinor }
                          : {}),
                      },
                      {
                        key: 'effective_from',
                        ar: 'بداية السريان',
                        en: 'Effective from',
                        type: 'datetime-local',
                        ...(row.effectiveFrom ? { value: row.effectiveFrom.slice(0, 16) } : {}),
                      },
                      {
                        key: 'effective_until',
                        ar: 'نهاية السريان (اختياري)',
                        en: 'Effective until (optional)',
                        type: 'datetime-local',
                        optional: true,
                        ...(row.effectiveUntil ? { value: row.effectiveUntil.slice(0, 16) } : {}),
                      },
                    ]}
                  />
                )}
                {r.manage &&
                  r.publish &&
                  (k === 'categories' || k === 'prices' || k === 'listings') &&
                  (k === 'listings' || k === 'categories' || row.state === 'DRAFT') && (
                    <CatalogApprove
                      locale={locale}
                      kind={k}
                      target={row.id}
                      revision={row.revision}
                      parent={!!row.parentId}
                    />
                  )}
                {r.manage && k === 'listings' && (
                  <CatalogMedia
                    key={row.id + '-' + row.revision}
                    locale={locale}
                    listingId={row.id}
                    revision={row.revision}
                    initial={row.media ?? []}
                    pending={row.pendingMedia ?? []}
                    publish={r.publish}
                  />
                )}
                {r.manage &&
                  r.publish &&
                  (k === 'products' || k === 'categories' || k === 'listings') &&
                  (row.state !== 'SUSPENDED' || k === 'products') && (
                    <CatalogFields
                      locale={locale}
                      title={
                        row.state === 'SUSPENDED'
                          ? ar
                            ? 'استئناف المنتج'
                            : 'Resume product'
                          : ar
                            ? 'تعليق الإتاحة'
                            : 'Suspend availability'
                      }
                      intent={{
                        family: 'publication',
                        operation:
                          row.state === 'SUSPENDED'
                            ? 'resume_product'
                            : 'suspend_' +
                              { products: 'product', categories: 'category', listings: 'listing' }[
                                k
                              ],
                        target: row.id,
                        revision: row.revision,
                      }}
                      fields={[{ key: 'reason', ar: 'سبب التغيير', en: 'Reason for change' }]}
                    />
                  )}
                {r.sourcing && k === 'offers' && row.state === 'DRAFT' && (
                  <CatalogFields
                    locale={locale}
                    title={
                      ar ? 'اعتماد الاستحقاق المتعاقد عليه' : 'Approve contractual entitlement'
                    }
                    intent={{
                      family: 'sourcing',
                      operation: 'approve_offer',
                      target: row.id,
                      revision: row.revision,
                    }}
                    fields={[]}
                  />
                )}
              </Card>
            ))}
          </div>
          {r.page.nextCursor && (
            <Link
              href={
                root +
                '?' +
                new URLSearchParams({ kind: k, search, state, after: r.page.nextCursor }).toString()
              }
            >
              {t.next}
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
