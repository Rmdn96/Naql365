import Link from 'next/link';
import type { Locale } from '@/i18n/config';
export function StaffFinanceUnavailable({ locale }: { locale: Locale }) {
  return (
    <Link href={'/' + locale + '/portal/finance'}>
      {locale === 'ar' ? 'مراجعة مدفوعات السوق المحدد' : 'Review payments in the selected Market'}
    </Link>
  );
}
