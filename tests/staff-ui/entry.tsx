import { createRoot } from 'react-dom/client';
import { Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import '@/app/globals.css';
import '@/styles/stage1.css';
import '@/styles/staff-experience.css';
import '@/styles/staff-v2.css';
import { StaffShell } from '@/components/shell/staff-shell';
import { Brand } from '@/components/design-system/brand';
import { Alert } from '@/components/ui/primitives';
import { StaffState } from '@/components/staff/presentation';
const q = new URLSearchParams(location.search),
  locale = q.get('locale') === 'ar' ? 'ar' : 'en',
  view = q.get('view') || 'dashboard',
  ar = locale === 'ar';
document.documentElement.lang = locale;
document.documentElement.dir = ar ? 'rtl' : 'ltr';
document.documentElement.dataset.theme = q.get('theme') || 'light';
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
if (view === 'dashboard' || view === 'quotes' || view === 'empty') {
  const { default: Page } =
    view === 'quotes'
      ? await import('@/app/[locale]/(portal)/portal/quotes/page')
      : await import('@/app/[locale]/(portal)/portal/page');
  body = await Page({ params: Promise.resolve({ locale }) });
} else if (view === 'catalog' || view === 'form') {
  const { CatalogAdmin } = await import('@/components/store/catalog-admin');
  body = await CatalogAdmin({ locale, kind: 'products' });
} else if (view === 'orders') {
  const { StoreExperience } = await import('@/components/store/experience');
  body = await StoreExperience({ locale, staff: true, path: ['orders'], query: {} });
} else if (view === 'loading') {
  const { default: Loading } = await import('@/app/[locale]/(portal)/portal/loading');
  body = <Loading />;
} else if (view === 'error') {
  const { default: ErrorState } = await import('@/app/[locale]/(portal)/portal/error');
  body = <ErrorState reset={() => {}} />;
} else
  body = (
    <StaffState state="unavailable" title={ar ? 'مساحة العمل غير متاحة' : 'Workspace unavailable'}>
      <p>{ar ? 'لا توجد عضوية مخولة.' : 'No authorized membership.'}</p>
    </StaffState>
  );
body = await resolveServer(body);
const links = [
  { href: `/${locale}/portal`, label: ar ? 'لوحة العمل' : 'Dashboard', symbol: '◈' },
  {
    href: `/${locale}/portal/quotes`,
    label: ar ? 'الطلبات والعروض' : 'Requests & Quotes',
    symbol: '▤',
  },
  { href: `/${locale}/portal/operations`, label: ar ? 'العمليات' : 'Operations', symbol: '⇄' },
  { href: `/${locale}/portal/finance`, label: ar ? 'المالية' : 'Finance', symbol: '▥' },
  {
    href: `/${locale}/portal/store/catalog`,
    label: ar ? 'كتالوج المتجر' : 'Store catalog',
    symbol: '▦',
  },
];
createRoot(document.getElementById('root')!).render(
  <main>
    {view === 'unauthorized' ? (
      q.get('phase') === 'before' ? (
        <div className="container page narrow">
          <Alert tone="error">
            <h1>{ar ? 'مساحة العمل غير متاحة' : 'Workspace unavailable'}</h1>
            <p>{ar ? 'لا توجد عضوية مخولة.' : 'No authorized membership.'}</p>
          </Alert>
        </div>
      ) : (
        <div
          className="lovable cx sx staff-access container page narrow"
          lang={locale}
          dir={ar ? 'rtl' : 'ltr'}
        >
          <Brand locale={locale} href={'/' + locale} size="staff" />
          {body}
        </div>
      )
    ) : (
      <StaffShell
        locale={locale}
        country="EG"
        themeMode={(q.get('theme') || 'light') as 'light' | 'dark' | 'system'}
        organizationName="TEST organization"
        marketName={ar ? 'مصر' : 'Egypt'}
        logout={<button type="button">{ar ? 'تسجيل الخروج' : 'Sign out'}</button>}
        links={links}
      >
        {body}
      </StaffShell>
    )}
  </main>,
);
document.documentElement.dataset.staffRender = 'ready';
