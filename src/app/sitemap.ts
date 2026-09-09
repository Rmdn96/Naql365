import type { MetadataRoute } from 'next';
import { appUrl } from '@/infrastructure/config/server-env';
import { preventIndexing } from '@/infrastructure/config/deployment-env';
export default function sitemap(): MetadataRoute.Sitemap {
  if (preventIndexing()) return [];
  const origin = appUrl().origin;
  return ['ar', 'en'].map((locale) => ({
    url: `${origin}/${locale}`,
    alternates: { languages: { ar: `${origin}/ar`, en: `${origin}/en` } },
  }));
}
