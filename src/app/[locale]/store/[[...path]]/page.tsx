import { CommerceSurface } from '@/components/lovable/surface';
import { notFound, redirect } from 'next/navigation';
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
  if (!path?.length || path[0] === 'categories') {
    const params = new URLSearchParams();
    for (const field of ['search', 'category', 'after']) {
      if (typeof q[field] === 'string') params.set(field, q[field]);
    }
    redirect('/' + locale + (params.size ? '?' + params.toString() : ''));
  }
  if (path[0] === 'checkout') redirect('/' + locale + '/store/cart');
  if (path[0] === 'products') {
    if (path.length !== 2 || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(path[1] ?? '')) notFound();
    return <CommerceSurface locale={locale} view="product" productId={path[1]!} />;
  }
  if (path[0] === 'cart' && path.length === 1)
    return <CommerceSurface locale={locale} view="cart" />;
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
