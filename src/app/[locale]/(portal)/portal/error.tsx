'use client';
import { StaffState } from '@/components/staff/presentation';
import { usePathname } from 'next/navigation';
export default function ErrorState({ reset }: { reset: () => void }) {
  const ar = usePathname().startsWith('/ar');
  return (
    <StaffState
      state="error"
      title={ar ? 'تعذر تحميل مساحة العمل' : 'Workspace could not be loaded'}
    >
      <p>
        {ar
          ? 'لم نتمكن من تأكيد البيانات. حاول مجددًا دون تكرار أي إجراء تجاري.'
          : 'The data could not be confirmed. Retry without repeating a business action.'}
      </p>
      <button className="button button--primary" onClick={reset}>
        {ar ? 'حاول مجددًا' : 'Try again'}
      </button>
    </StaffState>
  );
}
