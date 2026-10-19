import Link from 'next/link';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { catalogKind, storeCatalogAdmin } from '@/infrastructure/store/catalog';
import { storeMoney, storeText } from '@/i18n/store';
import { CatalogCreate, CatalogSuspend, CatalogApprove } from './catalog-controls';
import '@/styles/store.css';
export async function CatalogAdmin({
  locale,
  kind,
  after,
}: {
  locale: 'ar' | 'en';
  kind?: string | undefined;
  after?: string | undefined;
}) {
  const k = catalogKind.catch('products').parse(kind),
    r = await storeCatalogAdmin(k, after),
    t = storeText[locale],
    root = '/' + locale + '/portal/store/catalog';
  const labels = {
    products: t.catalog,
    categories: locale === 'ar' ? 'الفئات' : 'Categories',
    listings: locale === 'ar' ? 'النشر' : 'Listings',
    prices: locale === 'ar' ? 'الأسعار' : 'Prices',
  };
  return (
    <div className="container page store-experience stack">
      <h1>{t.catalogAdmin}</h1>
      <nav className="store-nav" aria-label={t.catalogAdmin}>
        {catalogKind.options.map((x) => (
          <Link aria-current={k === x ? 'page' : undefined} key={x} href={root + '?kind=' + x}>
            {labels[x]}
          </Link>
        ))}
      </nav>
      {r.manage && <CatalogCreate locale={locale} kind={k} />}
      <p>
        {t.displayCount}: {r.page.items.length}
      </p>
      {!r.page.items.length && <EmptyState title={t.empty}>{t.catalogAdmin}</EmptyState>}
      <div className="store-products">
        {r.page.items.map((row) => (
          <Card key={row.id}>
            <h2>
              {locale === 'ar'
                ? (row.content?.title_ar ??
                  row.publishedContent?.title_ar ??
                  row.sku ??
                  row.slug ??
                  labels[k])
                : (row.content?.title_en ??
                  row.publishedContent?.title_en ??
                  row.sku ??
                  row.slug ??
                  labels[k])}
            </h2>
            <p>
              <Badge>{row.state}</Badge>
            </p>
            {row.amountMinor !== undefined && row.amountMinor !== null && (
              <p>{storeMoney(row.amountMinor, locale)}</p>
            )}
            <details>
              <summary>{locale === 'ar' ? 'مراجع الإدارة' : 'Administrative references'}</summary>
              <p dir="ltr">{row.id}</p>
            </details>
            {r.manage && r.publish && k !== 'products' && (
              <CatalogApprove
                locale={locale}
                kind={k}
                target={row.id}
                revision={row.revision}
                parent={!!row.parentId}
              />
            )}
            {r.manage &&
              r.publish &&
              (k === 'products' || k === 'listings') &&
              row.state !== 'SUSPENDED' && (
                <CatalogSuspend locale={locale} kind={k} target={row.id} revision={row.revision} />
              )}
          </Card>
        ))}
      </div>
      {r.page.nextCursor && (
        <Link href={root + '?kind=' + k + '&after=' + r.page.nextCursor}>{t.next}</Link>
      )}
    </div>
  );
}
