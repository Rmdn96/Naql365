import Link from 'next/link';
import { StoreProductImage } from './product-image';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, EmptyState, Input, Table } from '@/components/ui/primitives';
import { storeCart, storeOrder, storeOrderPage } from '@/domain/store/model';
import { storeRead, storeShop, storeCategories } from '@/infrastructure/store/service';
import { AppError } from '@/domain/shared/errors';
import { storeLabel, storeMoney, storeText } from '@/i18n/store';
import {
  AddToCart,
  CartForm,
  CheckoutForm,
  OrderActions,
  ProofForm,
  DiscardProof,
} from './controls';
import '@/styles/store.css';
import { storeStaffModules } from '@/infrastructure/store/access';
type Locale = 'ar' | 'en';
async function StoreNavigation({ locale, staff }: { locale: Locale; staff: boolean }) {
  const t = storeText[locale],
    root = '/' + locale + (staff ? '/portal/store' : '/store');
  if (staff) {
    const modules = [
      ['orders', 'store.orders.read', t.orders],
      ['finance', 'store.payments.read', t.finance],
      ['reconciliation', 'store.settlements.manage', t.reconciliation],
      ['catalog', 'store.catalog.read', t.catalogAdmin],
    ] as const;
    const access = await storeStaffModules();
    return (
      <nav className="store-nav" aria-label={t.title}>
        {modules.map((m) =>
          access[m[0]] ? (
            <Link key={m[0]} href={root + '/' + m[0]}>
              {m[2]}
            </Link>
          ) : null,
        )}
      </nav>
    );
  }
  return (
    <nav className="store-nav" aria-label={t.title}>
      <Link href={root}>{t.catalog}</Link>
      <Link href={root + '/cart'}>{t.cart}</Link>
      <Link href={root + '/orders'}>{t.orders}</Link>
    </nav>
  );
}
export async function StoreExperience({
  locale,
  path = [],
  query,
  staff = false,
}: {
  locale: Locale;
  path?: string[] | undefined;
  query: Record<string, string | undefined>;
  staff?: boolean;
}) {
  const t = storeText[locale],
    root = '/' + locale + (staff ? '/portal/store' : '/store'),
    segment = path[0] ?? '';
  if (!staff && !['', 'products', 'cart', 'checkout', 'orders'].includes(segment)) notFound();
  if (staff && !['', 'orders', 'finance', 'reconciliation'].includes(segment)) notFound();
  let body: React.ReactNode;
  let failure: AppError | undefined;
  try {
    body = await renderStoreBody({ locale, path, query, staff });
  } catch (error) {
    if (error instanceof AppError && error.code === 'unauthenticated')
      redirect('/' + locale + '/login');
    // No backend identifiers, database diagnostics, proof paths or customer data in errors.
    if (!(error instanceof AppError)) throw error;
    failure = error;
  }
  if (failure)
    body = (
      <Alert tone="error">
        <h2>{t.unavailable}</h2>
        <p>{failure.code === 'forbidden' ? t.unavailableBody : t.error}</p>
        <Link href={root}>{t.retry}</Link>
      </Alert>
    );
  return (
    <div className="container page store-experience stack">
      <header>
        <p className="eyebrow">EG · EGP</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <StoreNavigation locale={locale} staff={staff} />
      </header>
      {body}
    </div>
  );
}

async function renderStoreBody({
  locale,
  path = [],
  query,
  staff = false,
}: Parameters<typeof StoreExperience>[0]) {
  const t = storeText[locale],
    root = '/' + locale + (staff ? '/portal/store' : '/store'),
    segment = path[0] ?? '';
  let body: React.ReactNode;
  if (!staff && (segment === '' || segment === 'products')) {
    if (segment === 'products' && (!path[1] || path.length !== 2)) notFound();
    const [catalog, categories] = await Promise.all([
      storeShop({
        ...(query.after ? { after: query.after } : {}),
        ...(query.search ? { search: query.search } : {}),
        ...(segment === 'products' ? { slug: path[1]! } : {}),
        ...(query.category ? { category: query.category } : {}),
      }),
      storeCategories(),
    ]);
    body =
      catalog.status !== 'AVAILABLE' ? (
        <EmptyState title={t.unavailable}>{t.unavailableBody}</EmptyState>
      ) : (
        <>
          <form className="store-search" method="get">
            <label htmlFor="store-category">{locale === 'ar' ? 'الفئة' : 'Category'}</label>
            <select id="store-category" name="category" defaultValue={query.category ?? ''}>
              <option value="">{t.catalog}</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {locale === 'ar' ? c.content.title_ar : c.content.title_en}
                </option>
              ))}
            </select>
            <Input
              id="store-search"
              name="search"
              label={t.search}
              defaultValue={query.search}
              maxLength={120}
            />
            <button className="button button--secondary">{t.search}</button>
          </form>
          {!catalog.items.length && <EmptyState title={t.empty}>{t.unavailableBody}</EmptyState>}
          <div className="store-products">
            {catalog.items.map((product) => (
              <Card key={product.listingId} className="store-product">
                {product.media[0] && (
                  <StoreProductImage
                    src={product.media[0].src}
                    alt={locale === 'ar' ? product.media[0].altAr : product.media[0].altEn}
                    width={480}
                    height={360}
                  />
                )}
                <p>
                  {
                    categories.find((c) => c.slug === product.category)?.content[
                      locale === 'ar' ? 'title_ar' : 'title_en'
                    ]
                  }
                </p>
                <h2>
                  <Link href={'/' + locale + '/store/products/' + product.slug}>
                    {locale === 'ar' ? product.content.title_ar : product.content.title_en}
                  </Link>
                </h2>
                <p>
                  {locale === 'ar'
                    ? product.content.description_ar
                    : product.content.description_en}
                </p>
                <strong>{storeMoney(product.amountMinor, locale)}</strong>
                {!!product.content.specifications?.length && (
                  <dl className="store-specifications">
                    {product.content.specifications.map((spec, i) => (
                      <div key={i}>
                        <dt>{locale === 'ar' ? spec.label_ar : spec.label_en}</dt>
                        <dd>{locale === 'ar' ? spec.value_ar : spec.value_en}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {segment === 'products' &&
                  product.media
                    .slice(1)
                    .map((image) => (
                      <StoreProductImage
                        key={image.src}
                        src={image.src}
                        alt={locale === 'ar' ? image.altAr : image.altEn}
                        width={480}
                        height={360}
                      />
                    ))}
                <AddToCart product={product} locale={locale} />
              </Card>
            ))}
          </div>
          {catalog.nextCursor && (
            <Link
              href={
                root +
                '?after=' +
                encodeURIComponent(catalog.nextCursor) +
                '&search=' +
                encodeURIComponent(query.search ?? '') +
                '&category=' +
                encodeURIComponent(query.category ?? '')
              }
            >
              {t.next}
            </Link>
          )}
        </>
      );
  } else if (!staff && ['cart', 'checkout'].includes(segment)) {
    const cart = storeCart.parse(await storeRead('cart'));
    body = (
      <>
        <h2>{segment === 'cart' ? t.cart : t.checkout}</h2>
        {cart.checkedOutOrderId && (
          <Alert>
            <Link href={root + '/orders/' + cart.checkedOutOrderId}>{t.orders}</Link>
          </Alert>
        )}
        {!cart.items.length ? (
          <EmptyState title={t.empty}>{t.catalog}</EmptyState>
        ) : segment === 'cart' ? (
          <>
            <CartForm cart={cart} locale={locale} />
            <Link className="button button--primary" href={root + '/checkout'}>
              {t.proceed}
            </Link>
          </>
        ) : (
          <>
            <ul>
              {cart.items.map((i) => (
                <li key={i.listingId}>
                  {locale === 'ar' ? i.content.title_ar : i.content.title_en} × {i.quantity} ·{' '}
                  {storeMoney(i.amountMinor * i.quantity, locale)}
                </li>
              ))}
            </ul>
            <CheckoutForm key={cart.revision} cart={cart} locale={locale} />
          </>
        )}
      </>
    );
  } else if (segment === 'orders' && path[1]) {
    if (path.length !== 2) notFound();
    const order = storeOrder.parse(await storeRead('order', path[1]));
    body = (
      <>
        <h2>{order.reference}</h2>
        <div className="store-status">
          <Badge>{storeLabel(order.orderState, locale)}</Badge>
          <Badge>{storeLabel(order.fulfillmentState, locale)}</Badge>
          <Badge>{storeLabel(order.payment.status, locale)}</Badge>
        </div>
        <div className="store-detail-grid">
          <Card>
            <h3>{t.orders}</h3>
            <ul>
              {order.items.map((i, index) => (
                <li key={index}>
                  {locale === 'ar' ? i.content.title_ar : i.content.title_en} × {i.quantity} ·{' '}
                  {storeMoney(i.unitPriceMinor * i.quantity, locale)}
                </li>
              ))}
            </ul>
            <dl className="store-totals">
              <dt>{t.price}</dt>
              <dd>{storeMoney(order.subtotalMinor, locale)}</dd>
              <dt>{t.delivery}</dt>
              <dd>{storeMoney(order.deliveryMinor, locale)}</dd>
              <dt>{t.tax}</dt>
              <dd>{storeMoney(order.taxMinor, locale)}</dd>
              <dt>{t.total}</dt>
              <dd>{storeMoney(order.totalMinor, locale)}</dd>
            </dl>
          </Card>
          <Card>
            <h3>{t.delivery}</h3>
            <address>
              {order.address.name}
              <br />
              {order.address.phone}
              <br />
              {order.address.region}
              <br />
              {order.address.line}
            </address>
            <p>{locale === 'ar' ? order.termsAr : order.termsEn}</p>
          </Card>
        </div>
        <Card>
          <h3>{t.payment}</h3>
          <p>
            {storeLabel(order.payment.method, locale)} · {storeLabel(order.payment.status, locale)}
          </p>
          {order.payment.method === 'CASH' ? (
            <p>{t.cash}</p>
          ) : (
            <>
              <p>{t.proofNote}</p>
              {order.payment.destination && (
                <dl>
                  <dt>{t.name}</dt>
                  <dd>
                    {locale === 'ar'
                      ? order.payment.destination.beneficiaryAr
                      : order.payment.destination.beneficiaryEn}
                  </dd>
                  <dt>{t.reference}</dt>
                  <dd dir="ltr">{order.payment.destination.accountNumber}</dd>
                </dl>
              )}
            </>
          )}
          {order.proofs.map((p) => (
            <p key={p.id}>
              <Badge>{storeLabel(p.status, locale)}</Badge> {p.customerReference}{' '}
              {!['RESERVED', 'ABANDONED'].includes(p.status) && (
                <a href={'/api/store/proof?id=' + p.id} target="_blank" rel="noopener noreferrer">
                  {t.proof}
                </a>
              )}
            </p>
          ))}
          {!staff &&
            order.proofs
              .filter((p) => p.status === 'RESERVED')
              .map((p) => <DiscardProof key={p.id} order={order} proofId={p.id} locale={locale} />)}
          {!staff &&
            order.payment.method !== 'CASH' &&
            ['PENDING', 'REJECTED'].includes(order.payment.status) &&
            !['CANCELLED', 'RETURNED'].includes(order.orderState) && (
              <ProofForm order={order} locale={locale} />
            )}
        </Card>
        {order.supplierEntitlementMinor !== undefined && (
          <Card>
            <h3>{t.reconciliation}</h3>
            <p>
              {t.supplier}: {storeMoney(order.supplierEntitlementMinor, locale)}
            </p>
            <ul>
              {order.entries.map((e) => (
                <li key={e.id}>
                  {storeLabel(e.kind, locale)} · {storeLabel(e.holder, locale)} ·{' '}
                  {storeMoney(e.amountMinor, locale)}
                </li>
              ))}
            </ul>
            <ul>
              {order.moneyOperations.map((o) => (
                <li key={o.id}>
                  {o.reference} · {storeLabel(o.kind, locale)} ·{' '}
                  <Badge>{storeLabel(o.state, locale)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <OrderActions order={order} locale={locale} staff={staff} />
        <Card>
          <h3>{t.history}</h3>
          <ol className="store-history">
            {order.events.map((event, index) => (
              <li key={index}>
                {storeLabel(event.action, locale)}{' '}
                <time dateTime={event.at}>
                  {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Africa/Cairo',
                  }).format(new Date(event.at))}
                </time>
              </li>
            ))}
          </ol>
        </Card>
      </>
    );
  } else {
    const kind = staff
      ? segment === 'finance'
        ? 'finance'
        : segment === 'reconciliation'
          ? 'reconciliation'
          : 'admin'
      : 'orders';
    const page = storeOrderPage.parse(await storeRead(kind, undefined, query.after));
    body = (
      <>
        <h2>
          {kind === 'finance' ? t.finance : kind === 'reconciliation' ? t.reconciliation : t.orders}
        </h2>
        <p>
          {t.displayCount}: {page.items.length}
        </p>
        {!page.items.length ? (
          <EmptyState title={t.empty}>{t.orders}</EmptyState>
        ) : (
          <Table
            caption={t.orders}
            columns={[t.orders, t.status, t.fulfillment, t.payment, t.total]}
            rows={page.items.map((o) => [
              <Link key={o.id} href={root + '/orders/' + o.id}>
                {o.reference}
              </Link>,
              storeLabel(o.orderState, locale),
              storeLabel(o.fulfillmentState, locale),
              storeLabel(o.paymentStatus, locale),
              storeMoney(o.totalMinor, locale),
            ])}
          />
        )}
        {page.nextCursor && (
          <Link href={root + '/' + segment + '?after=' + page.nextCursor}>{t.next}</Link>
        )}
      </>
    );
  }

  return body;
}
