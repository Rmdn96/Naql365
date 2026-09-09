'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { dictionary } from '@/i18n/dictionaries';
export default function NotFound() {
  const params = useParams();
  const locale = params.locale === 'en' ? 'en' : 'ar';
  const t = dictionary(locale);
  return (
    <div className="container page">
      <h1>{t.notFound}</h1>
      <Link href={`/${locale}`}>{t.back}</Link>
    </div>
  );
}
