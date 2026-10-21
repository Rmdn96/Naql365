import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { publicCountry, marketCookie } from '@/domain/markets/public-contact';
import { guestDatabase } from '@/infrastructure/guest/session';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { AppError } from '@/domain/shared/errors';
import { homeStep, homeSyncStep } from './home-trace';
import { catalogTrace } from '@/infrastructure/store/catalog-trace';
export { marketCookie } from '@/domain/markets/public-contact';
export async function selectedPublicCountry() {
  return publicCountry.catch('EG').parse((await cookies()).get(marketCookie)?.value);
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
    cities: z
      .object({
        id: z.uuid(),
        nameAr: z.string(),
        nameEn: z.string(),
        pickupEligible: z.boolean(),
        deliveryEligible: z.boolean(),
      })
      .array(),
  })
  .array();
export async function publicCatalogue() {
  if (!getPublicEnv()) return [];
  const client = homeSyncStep('public-catalogue-client', () => guestDatabase());
  const result = await homeStep('public-catalogue-rpc', () =>
    client.rpc('public_market_catalogue'),
  );
  catalogTrace({
    stage: 'public-catalogue-rpc',
    rpcError: !!result.error,
    httpStatus: result.status,
  });
  if (result.error) throw new AppError('internal', 'Service catalogue unavailable');
  return homeSyncStep('public-catalogue-parse', () => catalogue.parse(result.data));
}
