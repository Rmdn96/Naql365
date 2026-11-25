'use client';
import { useParams } from 'next/navigation';
import { dictionary } from '@/i18n/dictionaries';
import { Skeleton } from '@/components/ui/presentation';
export default function Loading() {
  const params = useParams();
  return (
    <div className="launch-loading">
      <Skeleton label={dictionary(params.locale === 'en' ? 'en' : 'ar').loading} />
    </div>
  );
}
