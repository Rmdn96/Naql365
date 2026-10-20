import Link from 'next/link';
import { StoreProductImage } from './product-image';
import type { Locale } from '@/i18n/config';
import { storeShop, storeCategories } from '@/infrastructure/store/service';
import { storeMoney } from '@/i18n/store';
import '@/styles/store.css';
import { AddToCart } from './controls';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';

/** Only the existing public projection supplies products; intake drafts never enter this component. */
export async function StoreIntroduction({ locale }: { locale: Locale }) {
  const ar = locale === 'ar',
    root = `/${locale}/store`;
  const [catalog, categories] = await Promise.all([
    storeShop().catch(() => {
      catalogTrace({ stage: 'fallback', source: 'catalog', outcome: 'threw' });
      return { status: 'NOT_AVAILABLE' as const, items: [], nextCursor: null };
    }),
    storeCategories().catch(() => {
      catalogTrace({ stage: 'fallback', source: 'categories', outcome: 'threw' });
      return [];
    }),
  ]);
  catalogTrace({
    stage: 'render',
    available: catalog.status === 'AVAILABLE',
    items: catalog.items.length,
  });
  return (
    <section
      className="container store-experience store-introduction stack"
      aria-labelledby="store-introduction-title"
    >
      <p className="eyebrow">{ar ? 'متجر نقل 365 · مصر' : 'Naql365 Store · Egypt'}</p>
      <h2 id="store-introduction-title">
        {ar ? 'كل ما تحتاجه للخطوة القادمة' : 'Everything for your next move'}
      </h2>
      <p>
        {ar
          ? 'اختر مستلزمات تجهيز أغراضك للنقل: الصناديق ومواد الحماية والشرائط وأدوات التغليف. طلبات المتجر وتوصيل المورد مستقلة عن طلب النقل.'
          : 'Find boxes, protective materials, tape and packing tools. Store purchases and supplier delivery remain separate from your Transport request.'}
      </p>
      <div className="actions">
        <Link className="button button--primary" href={root}>
          {ar ? 'تصفح المتجر' : 'Browse the Store'}
        </Link>
        <Link className="button button--secondary" href={`/${locale}/request`}>
          {ar ? 'اطلب خدمة نقل' : 'Request Transport'}
        </Link>
      </div>
      {catalog.status !== 'AVAILABLE' ? (
        <p className="store-notice">
          {ar
            ? 'يمكنك زيارة المتجر. الشراء غير متاح حاليًا دون اعتماد المنتجات والأسعار وشروط التشغيل.'
            : 'Visit the Store. Purchasing is currently unavailable until products, prices and operating terms are approved.'}
        </p>
      ) : (
        <>
          <nav
            className="store-nav commerce-categories"
            aria-label={ar ? 'فئات المتجر' : 'Store categories'}
          >
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`${root}?category=${encodeURIComponent(category.slug)}`}
              >
                {ar ? category.content.title_ar : category.content.title_en}
              </Link>
            ))}
          </nav>
          {catalog.items.length === 0 && (
            <p className="store-notice">
              {ar
                ? 'لا توجد منتجات معتمدة متاحة حاليًا.'
                : 'No approved products are currently available.'}
            </p>
          )}
          <div className="store-products commerce-products">
            {catalog.items.slice(0, 4).map((product) => (
              <article key={product.listingId} className="card store-product">
                {product.media[0] && (
                  <StoreProductImage
                    src={product.media[0].src}
                    alt={ar ? product.media[0].altAr : product.media[0].altEn}
                    width={480}
                    height={360}
                  />
                )}
                <h3>
                  <Link href={`${root}/products/${product.slug}`}>
                    {ar ? product.content.title_ar : product.content.title_en}
                  </Link>
                </h3>
                <p className="commerce-price">{storeMoney(product.amountMinor, locale)}</p>
                <AddToCart product={product} locale={locale} />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
