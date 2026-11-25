import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { isLocale } from '@/i18n/config';
import { marketContact, whatsappUrl } from '@/domain/markets/public-contact';
import { staffAccess, staffModules } from '@/infrastructure/identity/staff-context';
import { storeStaffModules } from '@/infrastructure/store/access';
import { storeRead } from '@/infrastructure/store/service';
import { StaffTable } from '@/components/staff/presentation';

const directory = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      status: z.string(),
      roles: z.array(z.string()),
    }),
  ),
  nextCursor: z.uuid().nullable(),
});

export default async function Settings({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === 'ar',
    root = '/' + locale + '/portal';
  const [m, store, users] = await Promise.all([
    staffModules(),
    storeStaffModules(),
    staffAccess('users.manage'),
  ]);
  if (m.context.status !== 'authorized') notFound();
  const after = (await searchParams).after;
  if (after && !z.uuid().safeParse(after).success) notFound();
  const staff =
    users.status === 'authorized'
      ? directory.parse(await storeRead('staff_directory', undefined, after))
      : null;
  return (
    <section className="stack">
      <h1>{ar ? 'الإعدادات' : 'Settings'}</h1>
      <div className="staff-dashboard-grid">
        <section className="staff-dashboard-panel">
          <h2>{ar ? 'التواصل والتوصيل' : 'Contact and delivery'}</h2>
          <a href={'tel:+' + marketContact.EG.destination}>
            <bdi>{marketContact.EG.display}</bdi>
          </a>
          {' · '}
          <a href={whatsappUrl('EG', locale)}>{ar ? 'واتساب' : 'WhatsApp'}</a>
          <p>
            {ar
              ? 'توصيل المتجر إلى القاهرة والجيزة. يحدد الموظف الرسوم عند مراجعة الطلب.'
              : 'Store delivery covers Cairo and Giza. Staff quote the delivery fee when reviewing an order.'}
          </p>
        </section>
        {(m.finance || m.banks || store.finance || store.reconciliation) && (
          <section className="staff-dashboard-panel">
            <h2>{ar ? 'التحصيل والتحويل البنكي' : 'Collections and bank transfers'}</h2>
            <ul>
              {m.banks && (
                <li>
                  <Link href={root + '/finance/banks'}>
                    {ar ? 'حسابات التحصيل المعتمدة' : 'Receiving accounts'}
                  </Link>
                </li>
              )}
              {store.finance && (
                <li>
                  <Link href={root + '/store/finance'}>
                    {ar ? 'مدفوعات المتجر' : 'Store payments'}
                  </Link>
                </li>
              )}
              {store.reconciliation && (
                <li>
                  <Link href={root + '/store/reconciliation'}>
                    {ar ? 'مطابقة المورد' : 'Supplier reconciliation'}
                  </Link>
                </li>
              )}
              {m.finance && (
                <li>
                  <Link href={root + '/finance'}>{ar ? 'مالية النقل' : 'Transport finance'}</Link>
                </li>
              )}
            </ul>
          </section>
        )}
        {(m.operations || m.support || store.policies) && (
          <section className="staff-dashboard-panel">
            <h2>{ar ? 'التشغيل' : 'Operations'}</h2>
            <ul>
              {m.operations && (
                <li>
                  <Link href={root + '/operations'}>
                    {ar ? 'تشغيل النقل' : 'Transport operations'}
                  </Link>
                </li>
              )}
              {m.support && (
                <li>
                  <Link href={root + '/support'}>{ar ? 'دعم العملاء' : 'Customer support'}</Link>
                </li>
              )}
              {store.policies && (
                <li>
                  <Link href={root + '/store/catalog?kind=policies'}>
                    {ar ? 'سياسات المتجر' : 'Store policies'}
                  </Link>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
      {staff && (
        <section className="staff-dashboard-panel">
          <h2>{ar ? 'الموظفون والأدوار' : 'Staff and roles'}</h2>
          <StaffTable
            caption={ar ? 'صلاحيات الموظفين' : 'Staff access'}
            columns={
              ar ? ['الموظف', 'العضوية', 'الأدوار'] : ['Staff member', 'Membership', 'Roles']
            }
            rows={staff.items.map((u) => [
              u.name ?? u.id,
              u.status === 'active' ? (ar ? 'نشطة' : 'Active') : ar ? 'موقوفة' : 'Suspended',
              u.roles.join(' · ') || '—',
            ])}
          />
          {staff.nextCursor && (
            <Link href={root + '/settings?after=' + staff.nextCursor}>
              {ar ? 'التالي' : 'Next'}
            </Link>
          )}
        </section>
      )}
    </section>
  );
}
