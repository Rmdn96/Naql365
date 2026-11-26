import { quoteCatalog, quoteMode } from '@/infrastructure/store/quotes';
import type { MetadataRoute } from 'next';
import { appUrl } from '@/infrastructure/config/server-env';
import { preventIndexing } from '@/infrastructure/config/deployment-env';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (preventIndexing()) return [];
  const origin = appUrl().origin;
  const paths = [''];
  if (quoteMode()) {
    const catalog = await quoteCatalog();
    paths.push('/transport', ...catalog.items.map((item) => '/store/products/' + item.slug));
  }
  return paths.flatMap((suffix) =>
    ['ar', 'en'].map((locale) => ({
      url: origin + '/' + locale + suffix,
      alternates: { languages: { ar: origin + '/ar' + suffix, en: origin + '/en' + suffix } },
    })),
  );
}
