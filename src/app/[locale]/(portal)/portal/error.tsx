'use client';
import { usePathname } from 'next/navigation';
export default function ErrorState({ reset }: { reset: () => void }) {
  const ar = usePathname().startsWith('/ar');
  return (
    <section role="alert" className="staff-dashboard-panel">
      <h1>{ar ? 'تعذر تحميل مساحة العمل' : 'Workspace could not be loaded'}</h1>
      <p>
        {ar
          ? 'لم نتمكن من تأكيد البيانات. حاول مجددًا دون تكرار أي إجراء تجاري.'
          : 'The data could not be confirmed. Retry without repeating a business action.'}
      </p>
      <button className="button button--primary" onClick={reset}>
        {ar ? 'حاول مجددًا' : 'Try again'}
      </button>
    </section>
  );
}
