import { CommerceSurface } from '@/components/lovable/surface';
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
  if (!path?.length || ['products', 'cart', 'categories'].includes(path[0]!))
    return (
      <CommerceSurface
        locale={locale}
        view={
          path?.[0] === 'products'
            ? 'product'
            : path?.[0] === 'cart'
              ? 'cart'
              : path?.[0] === 'categories'
                ? 'categories'
                : 'catalog'
        }
        productId={path?.[1] ?? ''}
        query={{
          ...(typeof q.search === 'string' ? { search: q.search } : {}),
          ...(typeof q.category === 'string' ? { category: q.category } : {}),
          ...(typeof q.after === 'string' ? { after: q.after } : {}),
        }}
      />
    );
  return (
    <CommerceSurface locale={locale} view={path?.[0] ?? 'catalog'}>
      <StoreExperience
        locale={locale}
        path={path}
        query={{
          search: typeof q.search === 'string' ? q.search : undefined,
          category: typeof q.category === 'string' ? q.category : undefined,
          after: typeof q.after === 'string' ? q.after : undefined,
        }}
      />
    </CommerceSurface>
  );
}
