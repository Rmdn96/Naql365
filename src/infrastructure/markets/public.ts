import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { publicCountry, marketCookie } from '@/domain/markets/public-contact';
import { guestDatabase } from '@/infrastructure/guest/session';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { AppError } from '@/domain/shared/errors';
export { marketCookie } from '@/domain/markets/public-contact';
export async function selectedPublicCountry() {
  return publicCountry.catch('SA').parse((await cookies()).get(marketCookie)?.value);
}
const catalogue = z
  .object({
    id: z.uuid(),
    country: publicCountry,
    nameAr: z.string(),
    nameEn: z.string(),
    currency: z.enum(['SAR', 'EGP']),
    timezone: z.string(),
    services: z.object({ id: z.uuid(), nameAr: z.string(), nameEn: z.string() }).array(),
    cities: z.object({ id: z.uuid(), nameAr: z.string(), nameEn: z.string() }).array(),
  })
  .array();
export async function publicCatalogue() {
  if (!getPublicEnv()) return [];
  const result = await guestDatabase().rpc('public_market_catalogue');
  if (result.error) throw new AppError('internal', 'Service catalogue unavailable');
  return catalogue.parse(result.data);
}
