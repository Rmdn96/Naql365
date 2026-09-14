import { z } from 'zod';
import { marketDate, normalizeMarketPhone } from '@/domain/markets/model';

export const normalizePhone = (value: string) => normalizeMarketPhone(value);
export const phoneInput = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));
export const profileInput = z.strictObject({
  name: z.string().trim().min(1).max(200),
  phone: phoneInput,
  locale: z.enum(['ar', 'en']),
});
const text = (max: number) => z.string().max(max);
export const locationInput = z.strictObject({
  city: text(120),
  city_id: z.union([z.uuid(), z.literal('')]).default(''),
  postal_code: text(20).default(''),
  building: text(100).default(''),
  unit: text(60).default(''),
  district: text(120),
  address: text(500),
  notes: text(1000),
  floor: z.number().int().min(-5).max(200).nullable(),
  elevator: z.boolean().nullable(),
  access_notes: text(1000),
});
export const draftInput = z.strictObject({
  service_id: z.union([z.uuid(), z.literal('')]),
  description: text(2000),
  notes: text(2000),
  pickup: locationInput,
  delivery: locationInput,
  items: z
    .array(
      z.strictObject({
        description: text(200),
        quantity: z.number().int().min(1).max(10000),
        notes: text(1000),
      }),
    )
    .max(50),
  additional_service_ids: z
    .array(z.uuid())
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length),
  preferred_date: z.union([z.iso.date(), z.literal('')]),
  time_window: z.enum(['', 'morning', 'afternoon', 'evening', 'flexible']),
  contact_name: text(200),
  contact_phone: z.union([phoneInput, z.literal('')]),
  contact_email: z.union([z.email().max(254), z.literal('')]),
  contact_notes: text(1000),
});
export type RequestDraft = z.infer<typeof draftInput>;
export const commandInput = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('save'),
    revision: z.number().int().nonnegative(),
    mutationId: z.uuid(),
    payload: draftInput,
  }),
  z.strictObject({
    operation: z.enum(['submit', 'cancel']),
    revision: z.number().int().nonnegative(),
    mutationId: z.uuid(),
  }),
]);
export const commandResult = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'CANCELLED']),
  reference: z.string().nullable(),
});
export function submissionIssues(draft: RequestDraft, timezone: string): string[] {
  const missing: string[] = [];
  if (!draft.service_id) missing.push('service');
  if (
    !draft.pickup.city_id ||
    !draft.pickup.address.trim() ||
    !draft.delivery.city_id ||
    !draft.delivery.address.trim()
  )
    missing.push('route');
  if (
    !draft.description.trim() ||
    !draft.items.length ||
    draft.items.some((i) => !i.description.trim())
  )
    missing.push('shipment');
  if (
    !draft.preferred_date ||
    draft.preferred_date < marketDate(new Date(), timezone) ||
    !draft.time_window
  )
    missing.push('schedule');
  if (!draft.contact_name.trim() || !phoneInput.safeParse(draft.contact_phone).success)
    missing.push('contact');
  return missing;
}
export const emptyLocation = (): RequestDraft['pickup'] => ({
  city: '',
  city_id: '',
  postal_code: '',
  building: '',
  unit: '',
  district: '',
  address: '',
  notes: '',
  floor: null,
  elevator: null,
  access_notes: '',
});
export function blankDraft(): RequestDraft {
  return {
    service_id: '',
    description: '',
    notes: '',
    pickup: emptyLocation(),
    delivery: emptyLocation(),
    items: [],
    additional_service_ids: [],
    preferred_date: '',
    time_window: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    contact_notes: '',
  };
}
export function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
