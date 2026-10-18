import type { Locale } from '@/i18n/config';
import { Alert } from '@/components/ui/primitives';

/** Real server-rendered containment, not a client-side visibility control. */
export function StaffFinanceUnavailable({ locale }: { locale: Locale }) {
  return (
    <Alert>
      <h2>
        {locale === 'ar'
          ? 'قائمة المالية غير متاحة مؤقتًا'
          : 'Finance queue temporarily unavailable'}
      </h2>
      <p>
        {locale === 'ar'
          ? 'حُجبت هذه القائمة حتى يتوفر عرض معتمد ومحدد بالسوق. لم تتغير صلاحيات المالية أو حالة المدفوعات.'
          : 'This queue is withheld until an approved Market-scoped projection is available. Finance permissions and payment states are unchanged.'}
      </p>
    </Alert>
  );
}
