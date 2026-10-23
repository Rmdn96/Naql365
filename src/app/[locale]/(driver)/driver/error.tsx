'use client';
import { usePathname } from 'next/navigation';
import { DriverState } from '@/components/driver/state';
export default function ErrorState({ reset }: { reset: () => void }) {
  const ar = usePathname().startsWith('/ar/');
  return (
    <DriverState state="error" title={ar ? 'تعذر تحميل الرحلات' : 'Trips could not be loaded'}>
      <p>
        {ar
          ? 'تعذر التحقق من الحالة الحالية. حدّث الصفحة قبل تكرار أي إجراء.'
          : 'The current state could not be verified. Refresh before repeating an action.'}
      </p>
      <button className="button button--secondary" onClick={reset}>
        {ar ? 'إعادة المحاولة' : 'Try again'}
      </button>
    </DriverState>
  );
}
