'use client';

import { usePathname } from 'next/navigation';
import { Alert, Button } from '@/components/ui/primitives';

export default function AccountError({ reset }: { reset: () => void }) {
  const ar = usePathname().startsWith('/ar/');
  return (
    <section className="cx-panel cx-stack">
      <Alert tone="error">
        {ar
          ? 'تعذر تحميل الصفحة. تحقق من اتصالك ثم حاول مجددًا.'
          : 'Could not load this page. Check your connection and try again.'}
      </Alert>
      <Button type="button" onClick={reset}>
        {ar ? 'حاول مجددًا' : 'Try again'}
      </Button>
    </section>
  );
}
