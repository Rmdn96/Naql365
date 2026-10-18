import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { StaffFinanceUnavailable } from '@/components/payments/staff-market-unavailable';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await staffAccess('finance.read');
  if (access.status === 'unauthenticated') redirect('/' + locale + '/login');
  if (access.status !== 'authorized') redirect('/' + locale + '/portal');
  // finance_queue paginates organization-wide. Do not call it or post-filter its results.
  return (
    <div className="container page staff-page">
      <h1>{locale === 'ar' ? 'المالية والمدفوعات' : 'Finance & Payments'}</h1>
      <StaffFinanceUnavailable locale={locale} />
    </div>
  );
}
