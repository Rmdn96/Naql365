'use client';
import { useParams } from 'next/navigation';
import { dictionary } from '@/i18n/dictionaries';
import { Alert, Button } from '@/components/ui/primitives';
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams(); const t = dictionary(params.locale === 'en' ? 'en' : 'ar');
  return <div className="container page stack"><Alert tone="error"><h1>{t.error}</h1><p>{t.errorBody}</p></Alert><div><Button onClick={reset}>{t.retry}</Button></div></div>;
}
