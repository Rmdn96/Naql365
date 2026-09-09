import type { MetadataRoute } from 'next';
import { appUrl } from '@/infrastructure/config/server-env';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = appUrl().origin;
  return ['ar','en'].map(locale => ({ url: `${origin}/${locale}`, alternates: { languages: { ar: `${origin}/ar`, en: `${origin}/en` } } }));
}
