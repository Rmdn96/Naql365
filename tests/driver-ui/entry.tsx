import { createRoot } from 'react-dom/client';
import { Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import '@/app/globals.css';
import '@/styles/stage1.css';
import '@/styles/driver-v2.css';
import { DriverFrame } from '@/components/driver/frame';
const q = new URLSearchParams(location.search),
  locale = q.get('locale') === 'ar' ? 'ar' : 'en',
  view = q.get('view') || 'dashboard',
  after = q.get('phase') !== 'before';
document.documentElement.lang = locale;
document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
document.documentElement.dataset.theme = q.get('theme') || 'light';
if (after) {
  await import('@/styles/driver-source.css');
  await import('@/styles/driver-workspace.css');
}
async function resolveServer(node: ReactNode, keyPath = 'root'): Promise<ReactNode> {
  if (Array.isArray(node))
    return Children.toArray(
      await Promise.all(node.map((c, i) => resolveServer(c, keyPath + ':' + i))),
    );
  if (!isValidElement(node)) return node;
  const e = node as ReactElement<Record<string, unknown>>;
  if (typeof e.type === 'function' && e.type.constructor.name === 'AsyncFunction')
    return resolveServer(
      await (e.type as unknown as (p: Record<string, unknown>) => Promise<ReactNode>)(e.props),
      keyPath,
    );
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e.props))
    props[k] =
      isValidElement(v) || k === 'children'
        ? await resolveServer(v as ReactNode, keyPath + ':' + k)
        : v;
  return cloneElement(e, { ...props, key: e.key ?? keyPath });
}

let body: ReactNode;
if (view === 'loading' || view === 'error') {
  if (after) {
    const { DriverState } = await import('@/components/driver/state');
    body = <DriverState state={view} title={locale === 'ar' ? 'حالة الرحلات' : 'Trip state'} />;
  } else
    body = (
      <div className="container page driver-shell">
        <p role={view === 'loading' ? 'status' : 'alert'}>
          {view === 'loading' ? 'Loading trips' : 'Trips unavailable'}
        </p>
      </div>
    );
} else if (view === 'unauthorized') {
  const { DriverAccessError } = await import('@/components/driver/access');
  const { AppError } = await import('@/domain/shared/errors');
  body = <DriverAccessError locale={locale} error={new AppError('forbidden', 'denied')} />;
} else {
  const { default: Page } =
    view === 'dashboard' || view === 'empty'
      ? await import('@/app/[locale]/(driver)/driver/page')
      : await import('@/app/[locale]/(driver)/driver/trips/[id]/page');
  body = await Page({
    params: Promise.resolve({ locale, id: '14000000-0000-4000-8000-000000000001' }),
    searchParams: Promise.resolve({ view: 'today' }),
  });
}
body = await resolveServer(body);
createRoot(document.getElementById('root')!).render(
  after ? (
    <DriverFrame
      locale={locale}
      themeMode={
        q.get('theme') === 'light' ? 'light' : q.get('theme') === 'dark' ? 'dark' : 'system'
      }
    >
      {body}
    </DriverFrame>
  ) : (
    <div>{body}</div>
  ),
);
document.documentElement.dataset.driverRender = 'ready';
