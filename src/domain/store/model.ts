import { z } from 'zod';

export const storeAction = z.enum([
  'cart',
  'checkout',
  'reserve_proof',
  'submit_proof',
  'discard_proof',
  'request_cancel',
  'request_return',
  'accept',
  'send',
  'prepare',
  'dispatch',
  'deliver',
  'exception',
  'recover',
  'report_cash',
  'cancel',
  'return',
  'confirm_transfer',
  'reject_proof',
  'confirm_cash',
  'money_request',
  'money_unknown',
  'money_verify',
  'money_failed',
  'contract_draft',
  'contract_approve',
  'contract_revoke',
  'media',
]);
export const storeCommand = z.strictObject({
  action: storeAction,
  mutationId: z.uuid(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  target: z.uuid().optional(),
  payload: z.record(z.string(), z.json()).default({}),
});
export const storeReadKind = z.enum([
  'cart',
  'orders',
  'order',
  'admin',
  'finance',
  'reconciliation',
]);
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const productContent = z.object({
  title_ar: z.string(),
  title_en: z.string(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
});
export const storeProduct = z.object({
  slug: z.string(),
  listingId: z.uuid(),
  revision: z.number().int(),
  category: z.string(),
  content: productContent,
  amountMinor: money,
  currency: z.literal('EGP'),
  media: z.object({ src: z.string(), altAr: z.string(), altEn: z.string() }).array().max(5),
});
export const storeCatalog = z.object({
  status: z.enum(['AVAILABLE', 'NOT_AVAILABLE']),
  items: storeProduct.array().max(20),
  nextCursor: z.string().nullable(),
});
export const storeCart = z.object({
  revision: z.number().int(),
  checkedOutOrderId: z.uuid().nullable(),
  items: z
    .object({
      listingId: z.uuid(),
      revision: z.number().int(),
      savedRevision: z.number().int(),
      quantity: z.number().int(),
      content: productContent,
      amountMinor: money,
      available: z.boolean(),
      slug: z.string(),
    })
    .array()
    .max(30),
  contracts: z
    .object({
      id: z.uuid(),
      revision: z.number().int(),
      regions: z.string().array(),
      deliveryMinor: money,
      taxMode: z.enum(['INCLUDED', 'ADDITIVE']),
      taxBps: z.number().int(),
      taxDelivery: z.boolean(),
      destinationIds: z.uuid().array().max(30),
      codRelease: z.boolean(),
      termsAr: z.string(),
      termsEn: z.string(),
    })
    .array(),
  destinations: z
    .object({
      id: z.uuid(),
      channel: z.enum(['VODAFONE_CASH', 'INSTAPAY']),
      labelAr: z.string(),
      labelEn: z.string(),
    })
    .array(),
});
export const storeOrderRow = z.object({
  id: z.uuid(),
  reference: z.string(),
  orderState: z.string(),
  fulfillmentState: z.string(),
  paymentStatus: z.string(),
  method: z.string(),
  totalMinor: money,
  currency: z.literal('EGP'),
  createdAt: z.string(),
});
export const storeOrderPage = z.object({
  items: storeOrderRow.array().max(30),
  nextCursor: z.uuid().nullable(),
});
export const storeOrder = z.object({
  id: z.uuid(),
  reference: z.string(),
  revision: z.number().int(),
  orderState: z.string(),
  fulfillmentState: z.string(),
  createdAt: z.string(),
  address: z.object({ name: z.string(), phone: z.string(), region: z.string(), line: z.string() }),
  subtotalMinor: money,
  deliveryMinor: money,
  taxMinor: money,
  totalMinor: money,
  currency: z.literal('EGP'),
  termsAr: z.string(),
  termsEn: z.string(),
  supplierEntitlementMinor: money.optional(),
  items: z
    .object({ content: productContent, quantity: z.number().int(), unitPriceMinor: money })
    .array(),
  payment: z.object({
    method: z.string(),
    status: z.string(),
    collector: z.string(),
    destination: z
      .object({
        channel: z.string(),
        beneficiaryAr: z.string(),
        beneficiaryEn: z.string(),
        accountNumber: z.string().nullable(),
        bankAr: z.string(),
        bankEn: z.string(),
      })
      .nullable(),
  }),
  proofs: z
    .object({
      id: z.uuid(),
      status: z.string(),
      customerReference: z.string().nullable(),
      submittedAt: z.string().nullable(),
    })
    .array()
    .max(20),
  events: z.object({ action: z.string(), at: z.string() }).array().max(50),
  moneyOperations: z
    .object({
      id: z.uuid(),
      kind: z.string(),
      state: z.string(),
      amountMinor: money,
      reference: z.string(),
    })
    .array(),
  entries: z
    .object({
      id: z.uuid(),
      kind: z.string(),
      holder: z.string(),
      amountMinor: money,
      reversesId: z.uuid().nullable(),
    })
    .array(),
  permissions: z.object({
    orders: z.boolean().optional(),
    fulfillment: z.boolean().optional(),
    verify: z.boolean().optional(),
    settle: z.boolean().optional(),
  }),
});
export type StoreProduct = z.infer<typeof storeProduct>;
export type StoreCart = z.infer<typeof storeCart>;
export type StoreOrder = z.infer<typeof storeOrder>;
export type StoreOrderPage = z.infer<typeof storeOrderPage>;
export type StoreCommand = z.infer<typeof storeCommand>;
