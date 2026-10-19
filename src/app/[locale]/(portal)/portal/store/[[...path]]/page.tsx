import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { StoreExperience } from '@/components/store/experience';
import { CatalogAdmin } from '@/components/store/catalog-admin';
import { storeStaffModules } from '@/infrastructure/store/access';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();
  const kind = path?.[0];
  let access = await staffAccess(
    kind === 'catalog'
      ? 'store.catalog.read'
      : kind === 'finance'
        ? 'store.payments.read'
        : kind === 'reconciliation'
          ? 'store.settlements.manage'
          : 'store.orders.read',
  );
  if (kind === 'orders' && path?.[1] && access.status === 'forbidden')
    access = await staffAccess('store.payments.read');
  if (kind === 'orders' && path?.[1] && access.status === 'forbidden')
    access = await staffAccess('store.settlements.manage');
  if (access.status === 'unauthenticated') redirect('/' + locale + '/login');
  if (access.status !== 'authorized') notFound();
  const modules = await storeStaffModules();
  if (kind === 'finance' && !modules.finance) notFound();
  if (kind === 'reconciliation' && !modules.reconciliation) notFound();
  if (
    kind === 'orders' &&
    path?.[1] &&
    !modules.orders &&
    !modules.finance &&
    !modules.reconciliation
  )
    notFound();
  const q = await searchParams;
  if (
    kind === 'catalog' &&
    typeof q.kind === 'string' &&
    ['references', 'offers', 'suppliers', 'agreements'].includes(q.kind) &&
    !modules.sourcing
  )
    notFound();
  if (kind === 'catalog' && q.kind === 'policies' && !modules.policies) notFound();
  if (kind === 'catalog')
    return (
      <CatalogAdmin
        locale={locale}
        kind={typeof q.kind === 'string' ? q.kind : undefined}
        after={typeof q.after === 'string' ? q.after : undefined}
        search={typeof q.search === 'string' ? q.search : ''}
        state={typeof q.state === 'string' ? q.state : ''}
      />
    );
  return (
    <StoreExperience
      locale={locale}
      path={path}
      query={{ after: typeof q.after === 'string' ? q.after : undefined }}
      staff
    />
  );
}
