import type { MetadataRoute } from 'next';
import { appUrl } from '@/infrastructure/config/server-env';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: ['/ar$', '/en$'], disallow: ['/ar/account','/en/account','/ar/portal','/en/portal','/ar/driver','/en/driver','/ar/login','/en/login','/ar/design-system','/en/design-system','/auth/'] }, sitemap: new URL('/sitemap.xml', appUrl()).href };
}
