import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { dictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';
import { staffModules } from '@/infrastructure/identity/staff-context';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { staffDisplayContext } from '@/infrastructure/identity/staff-market';
import { StaffShell, type StaffLink } from '@/components/shell/staff-shell';
import { customerLogout } from '@/app/auth/customer-actions';
import { Alert, Button } from '@/components/ui/primitives';
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
      <div className="container page narrow">
        <Alert tone="error">
          <h1>
            {m.context.status === 'unconfigured'
              ? dictionary(locale).unavailable
              : ar
                ? 'مساحة العمل غير متاحة'
                : 'Workspace unavailable'}
          </h1>
          <p>
            {ar
              ? 'تعذر تحديد عضوية موظف واحدة مخوّلة. تواصل مع مسؤول المؤسسة.'
              : 'A single authorized staff membership could not be established. Contact your organization administrator.'}
          </p>
        </Alert>
      </div>
    );
  const root = '/' + locale + '/portal';
  const links: StaffLink[] = [{ href: root, label: ar ? 'لوحة العمل' : 'Dashboard', symbol: '◈' }];
  if (m.sales)
    links.push({
      href: root + '/quotes',
      label: ar ? 'الطلبات والتسعير والعروض' : 'Requests & Quotes',
      symbol: '▤',
    });
  if (m.operations)
    links.push(
      {
        href: root + '/operations',
        label: ar ? 'العمليات والتخطيط' : 'Operations & Dispatch',
        symbol: '⇄',
      },
      {
        href: root + '/operations#work-orders',
        label: ar ? 'الطلبات المقبولة' : 'Accepted Orders',
        symbol: '▣',
      },
      { href: root + '/operations#work-jobs', label: ar ? 'مهام التنفيذ' : 'Jobs', symbol: '▦' },
      { href: root + '/operations#dispatch-title', label: ar ? 'الرحلات' : 'Trips', symbol: '↗' },
      {
        href: root + '/operations#work-resources',
        label: ar ? 'السائقون والمركبات' : 'Drivers & Vehicles',
        symbol: '◇',
      },
    );
  if (m.finance)
    links.push({
      href: root + '/finance',
      label: ar ? 'المالية والمدفوعات' : 'Finance & Payments',
      symbol: '▥',
    });
  if (m.banks)
    links.push({
      href: root + '/finance/banks',
      label: ar ? 'إعدادات التحصيل' : 'Payment configuration',
      symbol: '⚙',
    });
  if (m.support)
    links.push({
      href: root + '/support',
      label: ar ? 'دعم العملاء' : 'Customer Support',
      symbol: '◎',
    });
  const theme = (await cookies()).get('naql365_theme')?.value;
  const themeMode = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
  const display = await staffDisplayContext();
  return (
    <StaffShell
      locale={locale}
      country={await selectedPublicCountry()}
      organizationName={display.organizationName}
      marketName={ar ? display.market.name_ar : display.market.name_en}
      themeMode={themeMode}
      links={links}
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
