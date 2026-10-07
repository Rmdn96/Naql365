import { z } from 'zod';
import type { RequestDraft } from './intake';
import { publicCountry } from '@/domain/markets/public-contact';

export const quickEntry = z.object({
  country: publicCountry,
  service: z.uuid(),
  pickupCity: z.uuid(),
  deliveryCity: z.uuid(),
});
export type QuickEntry = z.infer<typeof quickEntry>;
export function quickEntryQuery(input?: QuickEntry) {
  return input ? `?${new URLSearchParams(input)}` : '';
}
export function prefillQuickEntry(
  payload: RequestDraft,
  entry: QuickEntry | undefined,
  context: {
    country: string;
    revision: number;
    services: { id: string; active: boolean }[];
    cities: { id: string; name_ar: string; name_en: string }[];
    coverage: {
      service_id: string;
      city_id: string | null;
      pickup_eligible?: boolean;
      delivery_eligible?: boolean;
    }[];
  },
  locale: 'ar' | 'en',
): RequestDraft {
  if (
    !entry ||
    context.revision !== 0 ||
    entry.country !== context.country ||
    !context.services.some((s) => s.id === entry.service && s.active)
  )
    return payload;
  const pickup = context.cities.find((c) => c.id === entry.pickupCity),
    delivery = context.cities.find((c) => c.id === entry.deliveryCity);
  if (
    !pickup ||
    !delivery ||
    ![pickup, delivery].every((c, index) =>
      context.coverage.some(
        (a) =>
          a.city_id === c.id &&
          a.service_id === entry.service &&
          (index === 0 ? a.pickup_eligible === true : a.delivery_eligible === true),
      ),
    )
  )
    return payload;
  return {
    ...payload,
    service_id: entry.service,
    pickup: {
      ...payload.pickup,
      city_id: pickup.id,
      city: locale === 'ar' ? pickup.name_ar : pickup.name_en,
    },
    delivery: {
      ...payload.delivery,
      city_id: delivery.id,
      city: locale === 'ar' ? delivery.name_ar : delivery.name_en,
    },
  };
}
