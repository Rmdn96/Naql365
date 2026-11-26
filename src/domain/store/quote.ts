import { z } from 'zod';
import { storeProduct } from './model';
import { guestCheckout } from './guest-checkout';

const sku = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/);
export const quoteContact = guestCheckout.omit({
  request_id: true,
  items: true,
  payment_method: true,
});
export const quoteItem = z.strictObject({
  sku,
  quantity: z.number().int().min(1).max(99),
  revision: z.number().int().min(1).max(999999999999999),
});
export const quoteRequest = quoteContact.extend({
  request_id: z.uuidv4(),
  items: quoteItem
    .array()
    .min(1)
    .max(30)
    .refine((items) => new Set(items.map((item) => item.sku)).size === items.length),
});
export const quoteProduct = quoteItem.omit({ quantity: true }).extend({
  id: z.uuid(),
  slug: z.string(),
  category: z.string(),
  categoryAr: z.string(),
  categoryEn: z.string(),
  price: z.null(),
  media: storeProduct.shape.media,
  content: z.object({
    title_ar: z.string(),
    title_en: z.string(),
    description_ar: z.string().nullable(),
    description_en: z.string().nullable(),
    specifications: storeProduct.shape.content.shape.specifications,
  }),
});
export const quoteOffer = z.object({
  prices: z.record(sku, z.number().int().min(1).max(999999999)),
  delivery: z.number().int().min(0).max(999999999),
  total: z.number().int().positive(),
  version: z.number().int().positive(),
  currency: z.literal('EGP'),
});
export const quoteQueue = z.array(
  z.object({
    id: z.uuid(),
    reference: z.string(),
    contact: quoteContact,
    items: quoteProduct.extend({ quantity: quoteItem.shape.quantity }).array(),
    revision: z.number().int().nonnegative(),
    offer: quoteOffer.nullable(),
    confirmed_at: z.string().nullable(),
    created_at: z.string(),
  }),
);
