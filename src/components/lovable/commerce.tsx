'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Package, ShoppingCart, Truck } from 'lucide-react';
import { DesignFoundation } from '@/components/design-system/foundation';
import { SourceImage } from './source-image';
import { Button } from './button';
import { destination, type CatalogProduct } from './adapter';
import { addToBasket } from '@/components/store/guest-basket';
import { GuestCheckout } from '@/components/store/guest-checkout';
import { storeMoney } from '@/i18n/store';
import { ContactLinks } from '@/components/shell/contact-links';
import type { Locale, Market } from './types';

type Props = {
  initialLocale: Locale;
  initialMarket: Market;
  view: string;
  productId?: string;
  products: CatalogProduct[];
  categories: { slug: string; title: string }[];
  available: boolean;
  initialQuery?: string;
  initialCategory?: string;
  nextCursor?: string | null;
  children?: ReactNode;
};

export function SourceCommerce({
  initialLocale: locale,
  view,
  productId,
  products,
  categories,
  available,
  initialQuery = '',
  initialCategory = 'all',
  nextCursor,
  children,
}: Props) {
  const ar = locale === 'ar';
  const [notice, setNotice] = useState('');
  const storeHref = (category: string, after = '') =>
    destination('catalog', locale, '', initialQuery, category, after);
  const add = (p: CatalogProduct) => {
    try {
      addToBasket(p);
      setNotice(ar ? 'أضيف إلى السلة: ' + p.name.ar : 'Added to cart: ' + p.name.en);
    } catch {
      setNotice(
        ar
          ? 'تعذر تحديث السلة. راجع السلة الحالية.'
          : 'Unable to update the cart. Review your current cart.',
      );
    }
  };
  const addButton = (p: CatalogProduct) => (
    <Button variant="transport" disabled={!available} onClick={() => add(p)}>
      <ShoppingCart size={16} />
      {ar ? 'أضف إلى السلة' : 'Add to cart'}
    </Button>
  );
  const detail = products.find((p) => p.slug === productId);
  const delivery = ar
    ? 'التوصيل إلى القاهرة والجيزة. نؤكد التوفر ورسوم التوصيل والإجمالي قبل التجهيز.'
    : 'Delivery to Cairo and Giza. We confirm availability, delivery fees and the total before preparing your order.';
  let body: ReactNode;
  if (children) body = children;
  else if (view === 'cart' || view === 'checkout')
    body = <GuestCheckout locale={locale} available={available} />;
  else if (view === 'product')
    body = detail ? (
      <section className="cm-container launch-product-detail">
        <Link href={'/' + locale}>{ar ? 'جميع المنتجات' : 'All products'}</Link>
        <div className="cm-product-detail">
          <ProductGallery key={detail.id} product={detail} locale={locale} />
          <div>
            <h1>{detail.name[locale]}</h1>
            <strong>{storeMoney(detail.retail, locale)}</strong>
            <p>{detail.spec[locale]}</p>
            {detail.specifications.length > 0 && (
              <dl>
                {detail.specifications.map((spec, i) => (
                  <div key={i}>
                    <dt>{ar ? spec.label_ar : spec.label_en}</dt>
                    <dd>{ar ? spec.value_ar : spec.value_en}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p>
              {ar
                ? 'تأكيد التوفر من Naql365 مطلوب'
                : 'Availability confirmation by Naql365 required'}
            </p>
            {addButton(detail)}
            <p>{delivery}</p>
          </div>
        </div>
      </section>
    ) : (
      <div className="cm-container">
        <h1>{ar ? 'المنتج غير متاح' : 'Product unavailable'}</h1>
        <Link href={'/' + locale}>{ar ? 'جميع المنتجات' : 'All products'}</Link>
      </div>
    );
  else
    body = (
      <div className="cm-container launch-store">
        <header className="launch-intro">
          <h1>{ar ? 'متجر نقل 365' : 'Naql365 Store'}</h1>
          <p>{delivery}</p>
        </header>
        {categories.length > 0 && (
          <nav
            id="store-category"
            className="launch-categories"
            aria-label={ar ? 'فئات المنتجات' : 'Product categories'}
          >
            <Link
              aria-current={initialCategory === 'all' ? 'page' : undefined}
              href={storeHref('all')}
            >
              {ar ? 'الكل' : 'All'}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                aria-current={c.slug === initialCategory ? 'page' : undefined}
                href={storeHref(c.slug)}
              >
                {c.title}
              </Link>
            ))}
          </nav>
        )}
        {initialQuery && (
          <p>
            {ar ? 'نتائج البحث عن' : 'Search results for'} «{initialQuery}» ·{' '}
            <Link href={'/' + locale}>{ar ? 'مسح البحث' : 'Clear search'}</Link>
          </p>
        )}
        {available && products.length > 0 ? (
          <div className="cm-products commerce-products">
            {products.map((p) => {
              const href = destination('product', locale, p.slug);
              return (
                <article className="cm-product store-product" key={p.id}>
                  <Link
                    href={href}
                    className={
                      p.image ? 'cm-product-photo' : 'cm-product-photo launch-product-placeholder'
                    }
                    aria-label={p.name[locale]}
                  >
                    {p.image ? (
                      <SourceImage
                        src={p.image}
                        width={512}
                        height={512}
                        sizes="(max-width: 359px) 92vw, (max-width: 699px) 47vw, (max-width: 999px) 31vw, (max-width: 1250px) 24vw, 290px"
                        alt={(ar ? p.media[0]?.altAr : p.media[0]?.altEn) || p.name[locale]}
                      />
                    ) : (
                      <Package aria-hidden="true" />
                    )}
                  </Link>
                  <div className="cm-product-copy">
                    <Link href={href}>
                      <h2>{p.name[locale]}</h2>
                    </Link>
                    <strong>{storeMoney(p.retail, locale)}</strong>
                  </div>
                  <div className="cm-product-controls">{addButton(p)}</div>
                </article>
              );
            })}
          </div>
        ) : (
          <p role="status" className="cm-note">
            {!available
              ? ar
                ? 'الشراء متوقف حاليًا.'
                : 'Purchasing is currently unavailable.'
              : ar
                ? 'لا توجد منتجات مطابقة.'
                : 'No matching products.'}
          </p>
        )}
        {available && nextCursor && (
          <Link className="button" href={storeHref(initialCategory, nextCursor)}>
            {ar ? 'المنتجات التالية' : 'Next products'}
          </Link>
        )}
        <section className="launch-service">
          <Truck aria-hidden="true" />
          <div>
            <h2>{ar ? 'تحتاج إلى نقل؟' : 'Need transport?'}</h2>
            <p>
              {ar
                ? 'أرسل تفاصيل الطلب للحصول على عرض سعر من فريقنا.'
                : 'Send your request for a quote from our team.'}
            </p>
          </div>
          <Link className="button" href={'/' + locale + '/request'}>
            {ar ? 'طلب نقل' : 'Request transport'}
          </Link>
        </section>
        <section id="contact" className="launch-contact">
          <h2>{ar ? 'تواصل معنا' : 'Contact us'}</h2>
          <ContactLinks locale={locale} />
        </section>
      </div>
    );
  return (
    <DesignFoundation
      family="public"
      className="lovable cx cm store-experience"
      lang={locale}
      dir={ar ? 'rtl' : 'ltr'}
    >
      {body}
      {notice && (
        <div className="launch-notice" role="status">
          {notice} ·{' '}
          <Link href={'/' + locale + '/store/cart'}>{ar ? 'عرض السلة' : 'View cart'}</Link>
        </div>
      )}
    </DesignFoundation>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="cm-section-heading">
      <div>
        <span className="cm-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </header>
  );
}

function ProductGallery({ product, locale }: { product: CatalogProduct; locale: Locale }) {
  const [index, setIndex] = useState(0);
  const image = product.media[index];
  if (!image)
    return (
      <div className="launch-media">
        <Package aria-hidden="true" />
      </div>
    );
  return (
    <div className="launch-media cm-gallery cm-detail-image">
      <SourceImage
        src={image.src}
        alt={locale === 'ar' ? image.altAr : image.altEn}
        width={512}
        height={512}
      />
      {product.media.length > 1 && (
        <div className="cm-thumbs">
          {product.media.map((media, n) => (
            <button
              key={media.src}
              type="button"
              aria-pressed={index === n}
              aria-label={(locale === 'ar' ? 'عرض الصورة ' : 'View image ') + (n + 1)}
              onClick={() => setIndex(n)}
            >
              <SourceImage src={media.src} alt="" width={64} height={64} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
