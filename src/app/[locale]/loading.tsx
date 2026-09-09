'use client';
import { useParams } from 'next/navigation';
import { dictionary } from '@/i18n/dictionaries';
import { LoadingState } from '@/components/ui/primitives';
export default function Loading() {
  const params = useParams();
  return <LoadingState label={dictionary(params.locale === 'en' ? 'en' : 'ar').loading} />;
}
