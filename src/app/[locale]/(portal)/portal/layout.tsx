import { parseThemeMode } from '@/components/design-system/theme';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { dictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';
import { staffModules } from '@/infrastructure/identity/staff-context';
import { storeStaffModules } from '@/infrastructure/store/access';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { staffDisplayContext } from '@/infrastructure/identity/staff-market';
import { StaffShell, type StaffLink } from '@/components/shell/staff-shell';
import { Brand } from '@/components/design-system/brand';
import { StaffState } from '@/components/staff/presentation';
import { customerLogout } from '@/app/auth/customer-actions';
import { Button } from '@/components/ui/primitives';
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === 'ar',
    m = await staffModules();
  if (m.context.status === 'unauthenticated') redirect('/' + locale + '/login');
  if (m.context.status !== 'authorized')
    return (
      <div
        className="lovable cx sx staff-access container page narrow"
        lang={locale}
        dir={ar ? 'rtl' : 'ltr'}
      >
        <Brand locale={locale} href={'/' + locale} size="staff" />
        <StaffState
          state="unavailable"
          title={
            m.context.status === 'unconfigured'
              ? dictionary(locale).unavailable
              : ar
                ? 'مساحة العمل غير متاحة'
                : 'Workspace unavailable'
          }
        >
          <p>
            {ar
              ? 'تعذر تحديد عضوية موظف واحدة مخوّلة. تواصل مع مسؤول المؤسسة.'
              : 'A single authorized staff membership could not be established. Contact your organization administrator.'}
          </p>
        </StaffState>
      </div>
    );
  const root = '/' + locale + '/portal';
  const store = await storeStaffModules();
  const orderLinks: StaffLink[] = [];
  if (store.orders)
    orderLinks.push({
      href: root + '/store/orders',
      label: ar ? 'طلبات المتجر' : 'Store orders',
      symbol: '▤',
    });
  if (m.sales || m.operations)
    orderLinks.push({
      href: root + (m.sales ? '/quotes' : '/operations'),
      label: ar ? 'طلبات النقل' : 'Transport requests',
      symbol: '⇄',
    });
  const links: StaffLink[] = [{ href: root, label: ar ? 'الرئيسية' : 'Dashboard', symbol: '◈' }];
  if (orderLinks[0])
    links.push({
      ...orderLinks[0],
      label: ar ? 'الطلبات' : 'Orders',
      prefixes: [root + '/store/orders', root + '/quotes', root + '/operations'],
    });
  if (store.catalog)
    links.push({ href: root + '/store/catalog', label: ar ? 'المنتجات' : 'Products', symbol: '▦' });
  links.push({
    href: root + '/settings',
    label: ar ? 'الإعدادات' : 'Settings',
    symbol: '⚙',
    prefixes: [
      root + '/settings',
      root + '/finance',
      root + '/support',
      root + '/store/finance',
      root + '/store/reconciliation',
    ],
  });
  const theme = (await cookies()).get('naql365_theme')?.value;
  const themeMode = parseThemeMode(theme);
  const display = await staffDisplayContext();
  return (
    <StaffShell
      locale={locale}
      country={await selectedPublicCountry()}
      organizationName={display.organizationName}
      marketName={ar ? display.market.name_ar : display.market.name_en}
      themeMode={themeMode}
      links={links}
      orderLinks={orderLinks}
      logout={
        <form action={customerLogout.bind(null, locale)}>
          <Button variant="secondary">{ar ? 'تسجيل الخروج' : 'Sign out'}</Button>
        </form>
      }
    >
      {children}
    </StaffShell>
  );
}
