import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { StoreExperience } from '@/components/store/experience';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();
  const q = await searchParams;
  return (
    <StoreExperience
      locale={locale}
      path={path}
      query={{
        search: typeof q.search === 'string' ? q.search : undefined,
        category: typeof q.category === 'string' ? q.category : undefined,
        after: typeof q.after === 'string' ? q.after : undefined,
      }}
    />
  );
}
