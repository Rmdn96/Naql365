import { createRoot } from 'react-dom/client';
import { Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import { customerFixture } from './fixture';
import '@/app/globals.css';
import '@/styles/stage1.css';
import '@/styles/customer-experience.css';
import '@/styles/customer-v2.css';
import '@/styles/commerce.css';
import '@/styles/transport.css';

const query = new URLSearchParams(location.search),
  locale = query.get('locale') === 'ar' ? 'ar' : 'en',
  view = query.get('view') || 'dashboard';
document.documentElement.lang = locale;
document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
document.documentElement.dataset.theme = query.get('theme') || 'light';
const f = customerFixture(query.get('status') || 'SENT', query.get('state') === 'empty');
// Resolve only genuine asynchronous Server Components. Client hooks still execute
// through React; data/command boundaries are explicitly controlled by this harness.
async function resolveServer(node: ReactNode, keyPath = 'root'): Promise<ReactNode> {
  if (Array.isArray(node))
    return Children.toArray(
      await Promise.all(node.map((child, index) => resolveServer(child, keyPath + ':' + index))),
    );
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') {
    const server = element.type as unknown as (
      props: Record<string, unknown>,
    ) => Promise<ReactNode>;
    return resolveServer(await server(element.props), keyPath);
  }
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(element.props))
    props[key] =
      isValidElement(value) || key === 'children'
        ? await resolveServer(value as ReactNode, keyPath + ':' + key)
        : value;
  return cloneElement(element, { ...props, key: element.key ?? keyPath });
}
let body: ReactNode;
const params = Promise.resolve({ locale, id: f.detail.request.id });
if (view === 'dashboard' || view === 'profile') {
  const { CustomerAccount } = await import('@/components/requests/account');
  body = await resolveServer(await CustomerAccount({ locale, saved: false }));
} else if (view === 'store-history' || view === 'store-detail') {
  const { default: Page } = await import('@/app/[locale]/store/[[...path]]/page');
  body = await resolveServer(
    await Page({
      params: Promise.resolve({
        locale,
        path: view === 'store-detail' ? ['orders', f.order.id] : ['orders'],
      }),
      searchParams: Promise.resolve({}),
    }),
  );
} else if (view === 'requests') {
  const { default: Page } = await import('@/app/[locale]/(account)/account/requests/page');
  body = await resolveServer(await Page({ params, searchParams: Promise.resolve({}) }));
} else if (view === 'quotes') {
  const { default: Page } = await import('@/app/[locale]/(account)/account/quotes/page');
  body = await resolveServer(await Page({ params }));
} else if (view === 'detail') {
  const { default: Page } = await import('@/app/[locale]/(account)/account/requests/[id]/page');
  body = await resolveServer(await Page({ params }));
} else if (view === 'tracking') {
  const { default: Page } = await import('@/app/[locale]/(account)/account/orders/[id]/page');
  body = await resolveServer(await Page({ params }));
} else {
  const { default: Page } = await import('@/app/[locale]/(account)/account/quotes/[id]/page');
  body = await resolveServer(await Page({ params }));
}
if (query.get('phase') === 'after') {
  await import('@/styles/customer-workspace.css');
  const { CustomerFrame } = await import('@/components/customer/frame');
  body = (
    <CustomerFrame
      locale={locale}
      country="EG"
      themeMode={(query.get('theme') || 'light') as 'light' | 'dark' | 'system'}
    >
      {body}
    </CustomerFrame>
  );
} else {
  const { TransportFrame } = await import('@/components/transport/frame');
  body = (
    <TransportFrame
      locale={locale}
      country="EG"
      themeMode="light"
      identity={<a href={`/${locale}/account`}>{locale === 'ar' ? 'حسابي' : 'My account'}</a>}
      footerLinks={null}
    >
      {body}
    </TransportFrame>
  );
}
createRoot(document.getElementById('root')!).render(<main>{body}</main>);
document.documentElement.dataset.customerRender = 'ready';
