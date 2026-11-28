'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Package, ShoppingCart, Truck } from 'lucide-react';
import { DesignFoundation } from '@/components/design-system/foundation';
import { SourceImage } from './source-image';
import { Button } from './button';
import { destination, type CatalogProduct } from './adapter';
import { addToBasket } from '@/components/store/guest-basket';
import { GuestCheckout } from '@/components/store/guest-checkout';
import { storeMoney } from '@/i18n/store';
import { quoteCopy, quoteSection } from '@/i18n/commercial-quote';
import { ContactLinks } from '@/components/shell/contact-links';
import type { Locale, Market } from './types';

type Props = {
  initialLocale: Locale;
  initialMarket: Market;
  view: string;
  productId?: string;
  products: CatalogProduct[];
  categories: { slug: string; title: string; image?: string | undefined }[];
  available: boolean;
  quote?: boolean;
  review?: boolean;
  initialQuery?: string;
  initialCategory?: string;
  nextCursor?: string | null;
  children?: ReactNode;
};

function dimensionText(text: string) {
  return text.split(/(\d+(?:\s*[×x]\s*\d+){1,2})/i).map((part, index) =>
    index % 2 ? (
      <bdi dir="ltr" key={index}>
        {part}
      </bdi>
    ) : (
      part
    ),
  );
}

export function SourceCommerce({
  initialLocale: locale,
  view,
  productId,
  products,
  categories,
  available,
  quote = false,
  review = false,
  initialQuery = '',
  initialCategory = 'all',
  nextCursor,
  children,
}: Props) {
  useEffect(() => {
    performance.mark('store-hydrated');
  }, []);
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
  const browsingOnly = quote && !available;
  const groups = [
    products.filter((p) => p.category !== 'kit'),
    products.filter((p) => p.category === 'kit'),
  ];
  const contents = (text: string) =>
    text
      .split(/[;؛]/)[0]
      ?.split(/[,،]/)
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  const detail = products.find((p) => p.slug === productId);
  const delivery = ar
    ? 'التوصيل إلى القاهرة والجيزة. نؤكد التوفر ورسوم التوصيل والإجمالي قبل التجهيز.'
    : 'Delivery to Cairo and Giza. We confirm availability, delivery fees and the total before preparing your order.';
  const price = (value: number | null) =>
    value === null
      ? browsingOnly || review
        ? ar
          ? 'السعر قريبًا'
          : 'Price coming soon'
        : available && quote
          ? quoteCopy.ui.quote[locale]
          : quoteCopy.ui.price[locale]
      : storeMoney(value, locale);
  let body: ReactNode;
  if (children) body = children;
  else if (view === 'cart' || view === 'checkout')
    body = <GuestCheckout locale={locale} available={available} quote={quote} />;
  else if (view === 'product')
    body = detail ? (
      <section className="cm-container launch-product-detail">
        <Link href={'/' + locale}>{ar ? 'جميع المنتجات' : 'All products'}</Link>
        <div className="cm-product-detail">
          <ProductGallery key={detail.id} product={detail} locale={locale} />
          <div>
            <h1>{dimensionText(detail.name[locale])}</h1>
            <strong>{price(detail.retail)}</strong>
            {quote && detail.image && <p>{quoteCopy.ui.illustrative[locale]}</p>}
            {detail.category === 'kit' ? (
              <section>
                <h2>{ar ? 'محتويات الباقة' : 'Kit contents'}</h2>
                <ul>
                  {contents(detail.spec[locale]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>{detail.spec[locale].split(/[;؛]/).slice(1).join(' ')}</p>
              </section>
            ) : (
              <p>{detail.spec[locale]}</p>
            )}
            {detail.specifications.length > 0 && (
              <dl>
                {detail.specifications.map((spec, i) => (
                  <div key={i}>
                    <dt>{ar ? spec.label_ar : spec.label_en}</dt>
                    <dd>{dimensionText(ar ? spec.value_ar : spec.value_en)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p>
              {ar
                ? 'تأكيد التوفر من Naql365 مطلوب'
                : 'Availability confirmation by Naql365 required'}
            </p>
            <p>{categories.find((category) => category.slug === detail.category)?.title}</p>
            {!review && addButton(detail)}
            <p>{delivery}</p>
          </div>
        </div>
        {products.length > 1 && (
          <section aria-label={ar ? 'منتجات ذات صلة' : 'Related products'}>
            <h2>{ar ? 'منتجات ذات صلة' : 'Related products'}</h2>
            <ul>
              {products
                .filter((p) => p.id !== detail.id)
                .map((p) => (
                  <li key={p.id}>
                    <Link href={destination('product', locale, p.slug)}>{p.name[locale]}</Link>
                  </li>
                ))}
            </ul>
          </section>
        )}
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
        {review && (
          <p role="status" className="cm-note">
            {ar
              ? 'معاينة خاصة للكتالوج. الطلبات والشراء مغلقان.'
              : 'Private catalog preview. Ordering is closed.'}
          </p>
        )}
        <header className="launch-intro">
          <div className="launch-intro-copy">
            <h1>{ar ? 'انقل أغراضك بسهولة وأمان' : 'Move your belongings with confidence'}</h1>
            <p>
              {ar
                ? 'كل ما تحتاجه للنقل والتغليف في مكان واحد'
                : 'Everything you need to pack and move, all in one place.'}
            </p>
            <div className="packing-actions">
              <a className="launch-intro-link" href="#store-products">
                {ar ? 'تسوق مستلزمات التغليف' : 'Shop packing supplies'}
              </a>
              <Link
                className="launch-intro-link transport-link"
                href={'/' + locale + (browsingOnly ? '/transport' : '/request')}
              >
                {ar ? 'اطلب خدمة نقل' : 'Request a move'}
              </Link>
            </div>
          </div>
          <div className="launch-intro-image">
            <SourceImage
              src="/brand/packing-studio.webp"
              alt={
                ar
                  ? 'مشهد توضيحي لكراتين نقل ورولات تغليف وأشرطة لاصقة.'
                  : 'Illustrative scene of moving boxes, packing rolls and tape.'
              }
              preload
              fill
              sizes="(max-width: 767px) 94vw, (max-width: 1300px) 49vw, 650px"
            />
            <small className="packing-caption">{ar ? 'صورة توضيحية' : 'Illustration'}</small>
          </div>
        </header>
        {categories.length > 0 && (
          <nav
            id="store-category"
            tabIndex={0}
            className={quote ? 'launch-categories launch-category-images' : 'launch-categories'}
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
                {quote && (
                  <span className="launch-category-image" aria-hidden="true">
                    {c.image ? (
                      <SourceImage
                        src={'/api/store/media/' + c.image + '?kind=category'}
                        alt=""
                        width={72}
                        height={54}
                        sizes="72px"
                      />
                    ) : (
                      <Package size={23} />
                    )}
                  </span>
                )}
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
        <div id="store-products" />
        {(available || review) && products.length > 0 ? (
          groups.map(
            (group, index) =>
              group.length > 0 && (
                <section
                  className="catalog-shelf"
                  id={index ? 'packing-kits' : 'packing-supplies'}
                  key={index}
                >
                  <h2>
                    {index
                      ? ar
                        ? 'باقات النقل والتغليف'
                        : 'Moving and packing kits'
                      : ar
                        ? 'مستلزمات التعبئة والتغليف'
                        : 'Packing supplies'}
                  </h2>
                  <div className="cm-products commerce-products">
                    {group.map((p) => {
                      const href = destination('product', locale, p.slug);
                      return (
                        <article className="cm-product store-product" key={p.id}>
                          <Link
                            href={href}
                            className={
                              p.image
                                ? 'cm-product-photo'
                                : 'cm-product-photo launch-product-placeholder'
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
                              <h3>{dimensionText(p.name[locale])}</h3>
                            </Link>
                            {p.category !== 'kit' &&
                              p.specifications
                                .filter(
                                  (spec) =>
                                    !p.name[locale]
                                      .replace(/\s/g, '')
                                      .includes(
                                        (ar ? spec.value_ar : spec.value_en).replace(/\s/g, ''),
                                      ) &&
                                    !(
                                      /dimension|الأبعاد/i.test(
                                        spec.label_en + ' ' + spec.label_ar,
                                      ) && /\d\s*[×x]/i.test(p.name[locale])
                                    ),
                                )
                                .slice(0, 1)
                                .map((spec) => (
                                  <small key={spec.label_en}>
                                    {ar
                                      ? spec.label_ar + ' · ' + spec.value_ar
                                      : spec.label_en + ' · ' + spec.value_en}
                                  </small>
                                ))}
                            <strong>{price(p.retail)}</strong>
                            {review && p.category === 'kit' && (
                              <ul className="kit-summary">
                                {contents(p.spec[locale]).map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            )}
                            {quote && p.image && <small>{quoteCopy.ui.illustrative[locale]}</small>}
                          </div>
                          {review && (
                            <Link className="catalog-detail-link" href={href}>
                              {index
                                ? ar
                                  ? 'تفاصيل الباقة'
                                  : 'View kit'
                                : ar
                                  ? 'تفاصيل المنتج'
                                  : 'View product'}
                            </Link>
                          )}
                          {!review && <div className="cm-product-controls">{addButton(p)}</div>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ),
          )
        ) : (
          <p role="status" className="cm-note">
            {!available && !review
              ? quote
                ? quoteCopy.ui.unavailable[locale]
                : ar
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
            <h2>
              {quote
                ? quoteSection('transport')[locale].heading
                : ar
                  ? 'تحتاج إلى نقل؟'
                  : 'Need transport?'}
            </h2>
            <p>
              {browsingOnly
                ? ar
                  ? 'تعرّف على خدمات نقل الأغراض.'
                  : 'Explore moving services.'
                : quote
                  ? quoteSection('transport')[locale].body
                  : ar
                    ? 'أرسل تفاصيل الطلب للحصول على عرض سعر من فريقنا.'
                    : 'Send your request for a quote from our team.'}
            </p>
          </div>
          <Link className="button" href={'/' + locale + (browsingOnly ? '/transport' : '/request')}>
            {browsingOnly
              ? ar
                ? 'خدمات النقل'
                : 'Moving services'
              : ar
                ? 'طلب نقل'
                : 'Request transport'}
          </Link>
        </section>
        <section className="launch-shopping-information" aria-labelledby="store-shopping-info">
          <h2 id="store-shopping-info">{ar ? 'التوصيل والدفع' : 'Delivery and payment'}</h2>
          <p>{delivery}</p>
          <p>
            {ar
              ? 'الدفع عند الاستلام، أو التحويل البنكي، أو Vodafone Cash، أو InstaPay. نؤكد رسوم التوصيل والإجمالي معك قبل التحصيل.'
              : 'Pay on delivery, by bank transfer, Vodafone Cash or InstaPay. We confirm the delivery fee and total with you before collecting payment.'}
          </p>
        </section>
        {browsingOnly ? null : quote ? (
          <section className="launch-shopping-information" aria-labelledby="store-quote-help">
            <h2 id="store-quote-help">{ar ? 'أسئلة عن التسعير' : 'Quote FAQs'}</h2>
            {quoteCopy.faq.map((faq) => (
              <details key={faq.en.question}>
                <summary>{faq[locale].question}</summary>
                <p>{faq[locale].answer}</p>
              </details>
            ))}
          </section>
        ) : (
          <section className="launch-shopping-information" aria-labelledby="store-order-help">
            <h2 id="store-order-help">{ar ? 'أسئلة عن الطلب' : 'Ordering questions'}</h2>
            <details>
              <summary>{ar ? 'هل أحتاج إلى حساب؟' : 'Do I need an account?'}</summary>
              <p>
                {ar
                  ? 'يمكنك الشراء وطلب النقل دون حساب.'
                  : 'You can shop or request transport without an account.'}
              </p>
            </details>
            <details>
              <summary>
                {ar ? 'متى أعرف الإجمالي النهائي؟' : 'When will I know the final total?'}
              </summary>
              <p>
                {ar
                  ? 'يراجع الفريق طلبك ويتواصل معك لتأكيد التوفر والتوصيل والإجمالي قبل التجهيز.'
                  : 'Our team reviews the order and confirms availability, delivery and the total with you before preparation.'}
              </p>
            </details>
          </section>
        )}
        {quote && !browsingOnly && (
          <section className="launch-shopping-information">
            <h2>{quoteSection('business')[locale].heading}</h2>
            <p>{quoteSection('business')[locale].body}</p>
          </section>
        )}
        <section id="contact" className="launch-contact">
          <h2>
            {quote ? quoteSection('contact')[locale].heading : ar ? 'تواصل معنا' : 'Contact us'}
          </h2>
          <ContactLinks locale={locale} />
        </section>
      </div>
    );
  return (
    <DesignFoundation
      family="public"
      className={
        browsingOnly
          ? 'lovable cx cm store-experience catalog-browsing-only'
          : 'lovable cx cm store-experience'
      }
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
