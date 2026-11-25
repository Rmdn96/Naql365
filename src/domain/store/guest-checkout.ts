import { z } from 'zod';

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(/^[^<>\p{Cc}]+$/u);

const line = z.strictObject({
  listing_id: z.uuid(),
  quantity: z.number().int().min(1).max(99),
  // The database compares this displayed EGP price with its approved integer-minor price.
  unit_price: z
    .number()
    .finite()
    .positive()
    .max(Number.MAX_SAFE_INTEGER / 100),
});

export const guestCheckout = z.strictObject({
  request_id: z.uuidv4(),
  items: z
    .array(line)
    .min(1)
    .max(30)
    .refine((items) => new Set(items.map((x) => x.listing_id)).size === items.length),
  full_name: text(2, 120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/),
  governorate: z.enum(['CAIRO', 'GIZA']),
  area: text(1, 100),
  address: text(3, 500),
  payment_method: z.enum(['CASH', 'BANK_TRANSFER', 'VODAFONE_CASH', 'INSTAPAY']),
  notes: text(1, 500).optional(),
});
