'use client';
import NextLink from 'next/link';
import { SourceImage } from './source-image';
import { subscribeTheme, readTheme, chooseTheme } from './theme';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from './adapter';
import {
  ArrowRight,
  Box,
  Check,
  ChevronLeft,
  CircleDashed,
  Globe2,
  Home,
  Info,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react';
import { Button } from './button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './sheet';
import { Brand } from './brand';
import { StoreSlot } from './slots';
const movingImage = '/lovable/commerce-moving.jpg';
import { useCommerce, type CatalogProduct } from './adapter';
import { useRouter, usePathname } from 'next/navigation';
import { whatsappUrl, marketContact } from '@/domain/markets/public-contact';
import { storeTotals } from '@/domain/store/totals';
import { activeCartItems } from '@/components/store/cart-client';
import { storeMoney } from '@/i18n/store';
import { commerceContent } from './commerce-content';
import { commerceExtra } from './commerce-extra-content';
import { themeModes } from './adapter';
import type { Locale, Market } from './types';

export function SourceCommerce({
  initialLocale,
  initialMarket,
  view,
  productId = '',
  products,
  categories,
  available,
  initialQuery = '',
  initialCategory = 'all',
  nextCursor = null,
  children,
}: {
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
}) {
  const locale = initialLocale,
    market = initialMarket,
    router = useRouter(),
    pathname = usePathname();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'system');
  const [drawer, setDrawer] = useState(false),
    [menu, setMenu] = useState(false);
  const [query, setQuery] = useState(initialQuery),
    [category, setCategory] = useState(initialCategory),
    [sort, setSort] = useState('featured');
  const { cart, cartState, lines, busy, notice, add, change } = useCommerce(locale);
  const t = commerceContent[locale],
    x = commerceExtra[locale],
    count = lines.reduce((n, l) => n + l.quantity, 0),
    rehearsal = available;
  const reviewCatalog = products,
    reviewCategories = categories.map((c) => c.slug);
  const [suggestOpen, setSuggestOpen] = useState(false),
    [active, setActive] = useState(-1);
  const searchCatalog = (items: CatalogProduct[], q: string, l: Locale) =>
    q.trim()
      ? items.filter((p) =>
          (p.name[l] + ' ' + p.spec[l]).toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()),
        )
      : [];
  const setLocale = (next: Locale) => router.push(pathname.replace(/^\/(ar|en)/, '/' + next));
  async function setMarket(country: Market) {
    const response = await fetch('/api/public/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country }),
    });
    if (response.ok) router.refresh();
  }
  const suggestions = searchCatalog(reviewCatalog, query, locale);
  const wa = whatsappUrl('EG', locale);
  const waButton = (size?: 'lg') =>
    wa ? (
      <Button variant="quiet" size={size} asChild>
        <a href={wa} target="_blank" rel="noopener noreferrer">
          <MessageCircle />
          {t.whatsapp}
        </a>
      </Button>
    ) : (
      <Button variant="quiet" size={size} disabled>
        <MessageCircle />
        {t.whatsapp}
      </Button>
    );
  const to = (v: string, product = '') => ({
    view: v,
    product,
    locale,
    market,
    query: v === 'catalog' ? query : '',
    category: v === 'catalog' ? category : '',
  });
  const filtered = reviewCatalog
    .filter(
      (p) =>
        (category === 'all' || category === p.category) &&
        `${p.name[locale]} ${p.spec[locale]}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => (sort === 'name' ? a.name[locale].localeCompare(b.name[locale]) : 0));
  const nav = (
    <>
      <Button variant="toolbar" asChild>
        <Link to="/" search={to('transport')} onClick={() => setMenu(false)}>
          <Truck />
          {t.transport}
        </Link>
      </Button>
      <Button variant="toolbar" asChild>
        <Link to="/" search={to('catalog')} onClick={() => setMenu(false)}>
          <ShoppingBag />
          {t.store}
        </Link>
      </Button>
      <Button variant="toolbar" asChild>
        <Link to="/" search={to('categories')} onClick={() => setMenu(false)}>
          {t.categories}
        </Link>
      </Button>
      <Button variant="toolbar" asChild>
        <Link to="/" search={to('portal')} onClick={() => setMenu(false)}>
          <UserRound />
          {t.account}
        </Link>
      </Button>
    </>
  );
  const cartTotals =
    cart?.contracts.length === 1 ? storeTotals(activeCartItems(cart), cart.contracts[0]!) : null;
  const summary = (
    <div className="cm-summary">
      <dl>
        {[
          { label: t.subtotal, value: cartTotals?.subtotal },
          { label: t.fees, value: cartTotals?.delivery },
          { label: t.total, value: cartTotals?.total },
        ].map(({ label, value }) => (
          <div className="st-slot" key={label}>
            <dt>{label}</dt>
            <dd>
              <span dir="ltr">
                {value === undefined
                  ? locale === 'ar'
                    ? 'يُحدّد عند إتمام الطلب'
                    : 'Determined at checkout'
                  : storeMoney(value, locale)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p>
        <LockKeyhole size={15} />
        {t.cartNotice}
      </p>
      <Button variant="transport" asChild>
        <Link to="/" search={to('checkout')} onClick={() => setDrawer(false)}>
          {t.checkout}
          <ArrowRight className="direction-arrow" />
        </Link>
      </Button>
    </div>
  );
  const cartBody = (
    <>
      <p className="cm-note">
        <Info size={16} />
        {t.cartNotice}
      </p>
      {cartState !== 'ready' ? (
        <div className="cm-empty" role="status">
          <ShoppingBag size={42} />
          <h2>
            {cartState === 'loading'
              ? locale === 'ar'
                ? 'جارٍ تحميل السلة'
                : 'Loading cart'
              : cartState === 'guest'
                ? locale === 'ar'
                  ? 'سجّل الدخول لعرض سلتك'
                  : 'Sign in to view your cart'
                : locale === 'ar'
                  ? 'السلة غير متاحة حاليًا'
                  : 'Cart is currently unavailable'}
          </h2>
          {cartState === 'guest' && (
            <Button variant="transport" asChild>
              <Link to="/auth-preview" search={{ locale }}>
                {t.login}
              </Link>
            </Button>
          )}
          {cartState === 'unavailable' && (
            <p>
              {locale === 'ar'
                ? 'تعذر تحميل السلة. حاول مرة أخرى لاحقًا.'
                : 'The cart could not be loaded. Please try again later.'}
            </p>
          )}
        </div>
      ) : lines.length === 0 ? (
        <div className="cm-empty">
          <ShoppingBag size={42} />
          <h2>{t.cartEmpty}</h2>
          <p>{t.cartHint}</p>
          <Button variant="quiet" asChild>
            <Link to="/" search={to('catalog')} onClick={() => setDrawer(false)}>
              {t.continue}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="cm-cart-lines">
          {lines.map((line) => {
            const row = cart?.items.find((i) => i.listingId === line.productId);
            const p =
              reviewCatalog.find((p) => p.id === line.productId) ??
              (row
                ? {
                    id: row.listingId,
                    image: '',
                    name: { ar: row.content.title_ar, en: row.content.title_en },
                    spec: { ar: '', en: '' },
                  }
                : null);
            if (!p) return null;
            return (
              <article className="cm-cart-line store-line" key={line.productId}>
                {p.image && (
                  <SourceImage src={p.image} width={512} height={512} alt={p.name[locale]} />
                )}
                <div>
                  <h3>{p.name[locale]}</h3>
                  <p className="cm-line-spec">{p.spec[locale]}</p>
                  <small>{row ? storeMoney(row.amountMinor, locale) : '—'}</small>
                  <Quantity value={line.quantity} change={(n) => change(p.id, n)} t={t} />
                </div>
                <Button
                  variant="toolbar"
                  size="icon"
                  aria-label={`${t.remove} ${p.name[locale]}`}
                  onClick={() => change(p.id, 0)}
                >
                  <Trash2 />
                </Button>
              </article>
            );
          })}
        </div>
      )}
      {lines.length > 0 && summary}
    </>
  );
  const productCards = (products: CatalogProduct[]) =>
    products.length ? (
      <div className="cm-products commerce-products">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            locale={locale}
            t={t}
            rehearsal={rehearsal && market === 'EG'}
            busy={busy === product.id}
            add={(q) => add(product, q)}
            search={to('product', product.slug)}
          />
        ))}
      </div>
    ) : (
      <div className="cm-empty">
        <Search size={36} />
        <h2>{t.noResults}</h2>
        <Button
          variant="quiet"
          onClick={() => {
            setQuery('');
            setCategory('all');
            router.push('/' + locale + '/store');
          }}
        >
          {t.clear}
        </Button>
      </div>
    );
  const catalogControls = (
    <div className="cm-filters">
      <label>
        {t.filter}
        <select
          id="store-category"
          value={category}
          onChange={(e) =>
            router.push(
              '/' +
                locale +
                '/store?category=' +
                encodeURIComponent(e.target.value === 'all' ? '' : e.target.value),
            )
          }
        >
          <option value="all">{t.all}</option>
          {reviewCategories.map((c, i) => (
            <option key={c} value={c}>
              {categories[i]?.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.sort}
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="featured">{t.featuredSort}</option>
          <option value="name">{t.nameSort}</option>
        </select>
      </label>
      <span>
        {filtered.length} {t.results}
      </span>
    </div>
  );
  const categorySection = (
    <section className="cm-section">
      <SectionHeading eyebrow={t.catSub} title={t.catTitle} />
      <div className="cm-categories">
        {reviewCategories.map((c, i) => (
          <Button key={c} variant="quiet" asChild>
            <Link to="/" search={{ ...to('catalog'), query: '', category: c }}>
              {reviewCatalog.find((product) => product.category === c && product.image) ? (
                <SourceImage
                  src={
                    reviewCatalog.find((product) => product.category === c && product.image)!.image
                  }
                  alt=""
                  width={512}
                  height={512}
                  loading="lazy"
                />
              ) : (
                <Package size={40} />
              )}
              <span>{categories[i]?.title}</span>
              <ChevronLeft className="direction-arrow" size={14} />
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
  let body: ReactNode;
  if (children) body = children;
  else if (view === 'home')
    body = (
      <>
        <section className="cm-hero commerce-hero">
          <SourceImage
            className="cm-hero-image"
            loading="eager"
            fetchPriority="high"
            sizes="100vw"
            src={movingImage}
            width={1536}
            height={864}
            alt={
              locale === 'ar'
                ? 'مشهد توضيحي لتجهيز الانتقال بكراتين التغليف'
                : 'Illustrative moving preparation with packing boxes'
            }
          />
          <div className="cm-container cm-hero-content">
            <div className="cm-hero-copy">
              <span className="cm-eyebrow">
                <i />
                {t.eyebrow}
              </span>
              <h1>
                {t.hero}
                <span>{t.heroAccent}</span>
              </h1>
              <p>{t.intro}</p>
              <div className="cm-hero-actions">
                <Button variant="transport" size="lg" asChild>
                  <Link to="/" search={to('transport')}>
                    <Truck />
                    {t.book}
                    <ArrowRight className="direction-arrow" />
                  </Link>
                </Button>
                <div>
                  {waButton('lg')}
                  <small dir="ltr">{marketContact.EG.display ?? t.pendingConfig}</small>
                </div>
              </div>
              <p className="cm-coverage">
                <Globe2 size={14} />
                {market === 'EG' ? t.coverageEG : t.coverageSA}
              </p>
            </div>
          </div>
          <span className="cm-hero-photo-label">{t.preview}</span>
        </section>
        <div className="cm-service-strip cm-container">
          <span>
            <Truck />
            {t.transport}
          </span>
          <span>
            <Box />
            {t.store}
          </span>
          <span>
            <ShieldCheck />
            {t.manual}
          </span>
        </div>
        <div className="cm-container">
          <section className="cm-section">
            <SectionHeading eyebrow={t.featuredSub} title={t.featured}>
              <Button variant="link" asChild>
                <Link to="/" search={to('catalog')}>
                  {t.browse}
                  <ArrowRight className="direction-arrow" />
                </Link>
              </Button>
            </SectionHeading>
            {!available && (
              <div className="cm-paused store-notice">
                <LockKeyhole size={15} />
                {market === 'EG' ? t.paused : t.coverageSA}
              </div>
            )}
            {productCards(reviewCatalog)}
          </section>
          {categorySection}
          <section
            className="cm-section"
            aria-label={locale === 'ar' ? 'الدفع بوضوح' : 'Payment, explained'}
          >
            <SectionHeading
              eyebrow={locale === 'ar' ? 'الدفع بوضوح' : 'Payment, explained'}
              title={locale === 'ar' ? 'اعرف الخطوات قبل الدفع' : 'Know the steps before paying'}
            />
            <div className="cm-records">
              <article>
                <div>
                  <h3>{locale === 'ar' ? 'نقدًا (CASH)' : 'Cash (CASH)'}</h3>
                  <p>
                    {locale === 'ar'
                      ? 'يتولى فريق المالية التحقق من التحصيل وتسجيله. في المتجر، يُقصد أن يُحصّل المورد النقد عند التسليم وفق السياسة المعتمدة؛ تقرير المورد وحده لا يؤكد التحصيل.'
                      : 'Finance verifies and records collection. For Store orders, the supplier is the intended cash collector on delivery under the approved policy; a supplier report alone does not confirm collection.'}
                  </p>
                </div>
              </article>
              <article>
                <div>
                  <h3>
                    {locale === 'ar' ? 'فودافون كاش وإنستاباي' : 'Vodafone Cash and InstaPay'}
                  </h3>
                  <p>
                    {locale === 'ar'
                      ? 'تظهر وسائل التحويل المتاحة والتعليمات المعتمدة في صفحة الدفع الآمنة فقط. رفع إثبات الدفع لا يؤكد استلام الأموال؛ انتظر تأكيد المالية بعد التحقق اليدوي من الاستلام الفعلي.'
                      : 'Available transfer methods and approved instructions appear only in secure checkout. Uploading payment proof does not confirm receipt of funds; wait for Finance confirmation after manual verification of actual receipt.'}
                  </p>
                </div>
              </article>
              <article>
                <div>
                  <h3>{locale === 'ar' ? 'عرض سعر النقل أولًا' : 'Transport quote first'}</h3>
                  <p>
                    {locale === 'ar'
                      ? 'قدّم طلب النقل ليُراجعه فريق المبيعات ويحدد عرض السعر يدويًا. اقبل العرض النهائي، ثم اختر طريقة الدفع المتاحة من طلبك؛ تقديم الطلب أو الإثبات لا يعني تأكيد الدفع.'
                      : 'Submit your Transport request for Sales review and a manual quote. Accept the final quote, then choose an available payment method from your order; submitting a request or proof does not confirm payment.'}
                  </p>
                  <Button variant="quiet" asChild>
                    <NextLink href={'/' + locale + '/guest'}>
                      {locale === 'ar' ? 'متابعة طلب قائم' : 'Track an existing request'}
                    </NextLink>
                  </Button>
                </div>
              </article>
            </div>
          </section>
          <section className="cm-journey cm-section">
            <SectionHeading eyebrow={t.journeySub} title={t.journey} />
            <ol>
              {t.steps.map((step, i) => (
                <li key={step}>
                  <span>0{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <Button variant="transport" asChild>
              <Link to="/" search={to('transport')}>
                {t.book}
                <ArrowRight className="direction-arrow" />
              </Link>
            </Button>
          </section>
        </div>
      </>
    );
  else if (view === 'catalog' || view === 'categories')
    body = (
      <div className="cm-container cm-section">
        <SectionHeading
          eyebrow={t.featuredSub}
          title={view === 'categories' ? t.categories : t.store}
        />
        {view === 'categories' ? (
          categorySection
        ) : (
          <>
            <p className="cm-note">
              <LockKeyhole size={16} />
              {available ? t.supplierNote : t.paused}
            </p>
            {catalogControls}
            {productCards(filtered)}
            {nextCursor && (
              <Button variant="quiet" asChild>
                <Link to="/" search={{ ...to('catalog'), after: nextCursor }}>
                  {locale === 'ar' ? 'التالي' : 'Next'}
                </Link>
              </Button>
            )}
          </>
        )}
      </div>
    );
  else if (view === 'product') {
    const p = reviewCatalog.find((p) => p.slug === productId);
    const related = reviewCatalog.filter((r) => r.slug !== productId).slice(0, 3);
    body = p ? (
      <div className="cm-container cm-section">
        <Button variant="link" asChild>
          <Link to="/" search={to('catalog')}>
            {t.back}
          </Link>
        </Button>
        <div className="cm-product-detail">
          <Gallery
            key={p.id}
            images={p.media}
            locale={locale}
            label={x.gallery}
            view={x.view}
            note={t.supplierNote}
          />
          <section>
            <span className="cm-eyebrow">{t.preview}</span>
            <h1>{p.name[locale]}</h1>
            <p>{p.spec[locale]}</p>
            <p className="cm-availability">
              <CircleDashed size={15} />
              {x.availability}:{' '}
              {locale === 'ar'
                ? 'تأكيد التوفر لدى المورد مطلوب'
                : 'Supplier availability confirmation required'}
            </p>
            <dl className="cm-spec-grid">
              {p.specifications.map((spec, index) => (
                <div className="st-slot" key={index}>
                  <dt>{locale === 'ar' ? spec.label_ar : spec.label_en}</dt>
                  <dd>{locale === 'ar' ? spec.value_ar : spec.value_en}</dd>
                </div>
              ))}
              <div className="st-slot">
                <dt>{x.price}</dt>
                <dd>{storeMoney(p.retail, locale)}</dd>
              </div>
            </dl>
            <p>{t.specNote}</p>
            <ProductCard
              product={p}
              locale={locale}
              t={t}
              rehearsal={rehearsal && market === 'EG'}
              busy={busy === p.id}
              add={(q) => add(p, q)}
              search={to('product', p.slug)}
              compact
            />
            <section className="cm-shipping">
              <h2>
                <Truck size={17} />
                {x.shipping}
              </h2>
              <dl className="cm-spec-grid">
                <StoreSlot label={x.shippingArea} />
                <StoreSlot label={x.deliveryWindow} />
                <StoreSlot label={t.fees} currency />
              </dl>
              <p className="cm-note">
                <Info />
                {x.shippingNote} {t.supplierNote}
              </p>
            </section>
          </section>
        </div>
        <section className="cm-section">
          <SectionHeading eyebrow={t.featuredSub} title={x.related} />
          {productCards(related)}
        </section>
      </div>
    ) : (
      <div className="cm-empty">
        <h2>{t.noResults}</h2>
      </div>
    );
  } else if (view === 'cart')
    body = (
      <div className="cm-container cm-section cm-cart-page">
        <SectionHeading eyebrow={t.rehearsal} title={`${t.cart} (${count})`} />
        {cartBody}
      </div>
    );
  else body = null;
  return (
    <div
      className="lovable cx cm store-experience"
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="cm-lab" role="note">
        <LockKeyhole size={12} />
        <span>{available ? t.footer : t.paused}</span>
      </div>
      <header className="cm-header">
        <div className="cm-container cm-header-main">
          <Brand locale={locale} />
          <form className="cm-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <Search size={20} />
            <label className="sr-only" htmlFor="commerce-search">
              {t.search}
            </label>
            <input
              id="commerce-search"
              role="combobox"
              aria-expanded={suggestOpen && query.trim() !== ''}
              aria-controls="cm-suggest"
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `cm-sug-${active}` : undefined}
              autoComplete="off"
              placeholder={t.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestOpen(true);
                setActive(-1);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSuggestOpen(false);
                  setActive(-1);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSuggestOpen(true);
                  setActive((a) => Math.min(a + 1, suggestions.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, -1));
                } else if (e.key === 'Enter') {
                  const s = suggestions[active];
                  (
                    document.getElementById(
                      s ? `cm-sug-${active}` : 'commerce-search-go',
                    ) as HTMLElement | null
                  )?.click();
                  setSuggestOpen(false);
                }
              }}
            />
            <Button variant="transport" asChild>
              <Link
                id="commerce-search-go"
                to="/"
                search={to('catalog')}
                aria-label={t.searchButton}
              >
                <Search />
              </Link>
            </Button>
            {suggestOpen && query.trim() !== '' && (
              <div className="cm-suggest" id="cm-suggest" role="listbox" aria-label={x.suggestions}>
                {suggestions.length ? (
                  suggestions.map((p, i) => (
                    <Link
                      key={p.id}
                      id={`cm-sug-${i}`}
                      role="option"
                      aria-selected={i === active}
                      to="/"
                      search={to('product', p.slug)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSuggestOpen(false);
                        setQuery('');
                      }}
                    >
                      <SourceImage src={p.image} alt="" width={40} height={40} />
                      <span>
                        <strong>{p.name[locale]}</strong>
                        <small>{p.spec[locale]}</small>
                      </span>
                    </Link>
                  ))
                ) : (
                  <p role="status">{x.noSuggest}</p>
                )}
              </div>
            )}
            <span className="sr-only" aria-live="polite">
              {query.trim() ? `${suggestions.length} ${t.results}` : ''}
            </span>
          </form>
          <div className="cm-header-tools">
            <label className="cm-market">
              <span className="sr-only">{t.market}</span>
              <select
                aria-label={locale === 'ar' ? 'بلد الخدمة' : 'Service country'}
                value={market}
                onChange={(e) => setMarket(e.target.value === 'SA' ? 'SA' : 'EG')}
              >
                <option value="EG">EG</option>
                <option value="SA">SA</option>
              </select>
            </label>
            <Button variant="toolbar" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
              {locale === 'ar' ? 'EN' : 'عربي'}
            </Button>
            <Button variant="toolbar" size="icon" className="cm-account" asChild>
              <Link to="/" search={to('portal')} aria-label={t.account}>
                <UserRound />
              </Link>
            </Button>
            <Sheet open={drawer} onOpenChange={setDrawer}>
              <SheetTrigger asChild>
                <Button
                  variant="toolbar"
                  className="cm-cart-trigger commerce-cart"
                  aria-label={`${t.cart} (${count})`}
                >
                  <ShoppingCart />
                  <span className="cm-badge commerce-cart-badge" aria-hidden="true">
                    {cartState === 'unavailable' || cartState === 'loading' ? '—' : count}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent
                className="lovable cx cm cm-drawer"
                side={locale === 'ar' ? 'left' : 'right'}
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                lang={locale}
                closeLabel={t.close}
              >
                <div className="cm-drawer-label">
                  <span>{t.cartNotice}</span>
                </div>
                <SheetTitle>
                  {t.cart} ({count})
                </SheetTitle>
                <SheetDescription>{t.cartNotice}</SheetDescription>
                {cartBody}
                <Button variant="quiet" asChild>
                  <Link to="/" search={to('cart')} onClick={() => setDrawer(false)}>
                    {t.cartPage}
                  </Link>
                </Button>
              </SheetContent>
            </Sheet>
            <Sheet open={menu} onOpenChange={setMenu}>
              <SheetTrigger asChild>
                <Button
                  variant="toolbar"
                  size="icon"
                  className="cm-menu-trigger"
                  aria-label={t.menu}
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                className="lovable cx cm cm-drawer"
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
                lang={locale}
                closeLabel={t.close}
              >
                <SheetTitle>{t.menu}</SheetTitle>
                <SheetDescription>{t.footerNote}</SheetDescription>
                <nav className="cm-mobile-nav">{nav}</nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="cm-navigation cm-container">
          <nav>{nav}</nav>
          <span>
            <Globe2 size={13} />
            {market === 'EG' ? 'مصر / Egypt' : 'السعودية / Saudi Arabia'}
          </span>
          <div className="cm-theme" role="group" aria-label={t.theme}>
            {themeModes.map((m) => {
              const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : Monitor;
              return (
                <Button
                  key={m}
                  variant="toolbar"
                  size="icon"
                  title={t[m]}
                  aria-label={t[m]}
                  aria-pressed={theme === m}
                  onClick={() => chooseTheme(m)}
                >
                  <Icon size={14} />
                </Button>
              );
            })}
          </div>
        </div>
      </header>
      {notice && (
        <p className="cm-announcement" role="status">
          <Check size={15} />
          {notice} · {count}
        </p>
      )}
      {body}
      <footer className="cm-footer cm-container">
        <Brand locale={locale} />
        <span>{t.footerNote}</span>
        <Button variant="link" asChild>
          <Link to="/" search={to('transport')}>
            {t.transport}
          </Link>
        </Button>
        <Button variant="link" asChild>
          <Link to="/store-admin-preview" search={{ locale, market }}>
            Store Admin
          </Link>
        </Button>
      </footer>
      <nav className="cm-bottom-nav" aria-label={t.menu}>
        {(
          [
            ['home', Home, x.bottomHome],
            ['catalog', ShoppingBag, t.store],
            ['transport', Truck, t.transport],
            ['cart', ShoppingCart, t.cart],
            ['portal', UserRound, t.account],
          ] as const
        ).map(([v, Icon, label]) => (
          <Link
            key={v}
            to="/"
            search={to(v)}
            aria-current={view === v ? 'page' : undefined}
            aria-label={v === 'cart' ? `${label} (${count})` : undefined}
          >
            <span>
              <Icon size={20} />
              {v === 'cart' && count > 0 && <b aria-hidden="true">{count}</b>}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
type Copy = (typeof commerceContent)['ar'];
function Quantity({ value, change, t }: { value: number; change: (n: number) => void; t: Copy }) {
  return (
    <div className="cm-quantity">
      <Button
        variant="toolbar"
        size="icon"
        aria-label={t.decrease}
        onClick={() => change(Math.max(0, value - 1))}
      >
        <Minus />
      </Button>
      <output aria-label={t.quantity}>{value}</output>
      <Button
        variant="toolbar"
        size="icon"
        aria-label={t.increase}
        onClick={() => change(value + 1)}
      >
        <Plus />
      </Button>
    </div>
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
function ProductCard({
  product,
  locale,
  t,
  rehearsal,
  busy,
  add,
  search,
  compact = false,
}: {
  product: CatalogProduct;
  locale: Locale;
  t: Copy;
  rehearsal: boolean;
  busy: boolean;
  add: (q: number) => void;
  search: { view: string; product: string; locale: Locale; market: Market };
  compact?: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  return (
    <article className={compact ? 'cm-product-buy' : 'cm-product store-product'}>
      {!compact && (
        <>
          <Link
            to="/"
            search={search}
            className="cm-product-photo"
            aria-label={product.name[locale]}
          >
            <SourceImage
              src={product.image || undefined}
              alt={
                (locale === 'ar' ? product.media[0]?.altAr : product.media[0]?.altEn) ??
                product.name[locale]
              }
              width={512}
              height={512}
              loading="lazy"
            />
          </Link>
          <div className="cm-product-copy">
            <Link to="/" search={search}>
              <h3>{product.name[locale]}</h3>
            </Link>
            <p>{product.spec[locale]}</p>
            <div className="cm-price">
              <strong dir="ltr">{storeMoney(product.retail, locale)}</strong>
              <span>EGP</span>
            </div>
          </div>
        </>
      )}
      <div className="cm-product-controls">
        {rehearsal && (
          <Quantity value={quantity} change={(n) => setQuantity(Math.max(1, n))} t={t} />
        )}
        <Button
          variant={rehearsal ? 'transport' : 'quiet'}
          disabled={!rehearsal || busy}
          onClick={() => add(quantity)}
        >
          {busy ? (
            <LoaderCircle className="auth-spinner" />
          ) : rehearsal ? (
            <Plus />
          ) : (
            <LockKeyhole />
          )}
          {busy ? t.adding : rehearsal ? t.add : t.unavailable}
        </Button>
      </div>
    </article>
  );
}
function Gallery({
  images,
  locale,
  label,
  view,
  note,
}: {
  images: CatalogProduct['media'];
  locale: Locale;
  label: string;
  view: string;
  note: string;
}) {
  const [i, setI] = useState(0);
  const image = images[i];
  return (
    <div className="cm-detail-image cm-gallery" role="group" aria-label={label}>
      {image && (
        <SourceImage
          src={image.src}
          alt={locale === 'ar' ? image.altAr : image.altEn}
          width={512}
          height={512}
        />
      )}
      <div className="cm-thumbs">
        {images.map((f, n) => (
          <button
            key={f.src}
            type="button"
            aria-label={view + ' ' + (n + 1)}
            aria-pressed={i === n}
            onClick={() => setI(n)}
          >
            <SourceImage src={f.src} alt="" width={64} height={64} />
          </button>
        ))}
      </div>
      <small>{note}</small>
    </div>
  );
}
