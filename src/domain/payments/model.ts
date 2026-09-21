import { z } from 'zod';
export const paymentMethods = ['CASH', 'BANK_TRANSFER'] as const;
export const paymentStates = [
  'PENDING',
  'CASH_DUE',
  'AWAITING_TRANSFER_PROOF',
  'UNDER_REVIEW',
  'TRANSFER_REJECTED',
  'PAID',
] as const;
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const bankInstructions = z.object({
  id: z.uuid(),
  revision: z.number().int(),
  currency: z.enum(['SAR', 'EGP']),
  bankNameAr: z.string(),
  bankNameEn: z.string(),
  beneficiaryAr: z.string(),
  beneficiaryEn: z.string(),
  iban: z.string().nullable(),
  accountNumber: z.string().nullable(),
  bic: z.string().nullable(),
  instructionsAr: z.string(),
  instructionsEn: z.string(),
});
export const paymentDetails = z.object({
  orderId: z.uuid(),
  organizationId: z.uuid(),
  reference: z.string(),
  marketId: z.uuid(),
  country: z.enum(['SA', 'EG']),
  timezone: z.string(),
  currency: z.enum(['SAR', 'EGP']),
  subtotalMinor: money,
  taxMinor: money,
  totalMinor: money,
  taxLabelAr: z.string().nullable(),
  taxLabelEn: z.string().nullable(),
  paymentId: z.uuid().nullable(),
  revision: z.number().int().nonnegative(),
  method: z.enum(paymentMethods).nullable(),
  status: z.enum(paymentStates),
  executionAllowed: z.boolean(),
  canSwitch: z.boolean(),
  bank: bankInstructions.nullable(),
  attempts: z
    .array(
      z.object({
        id: z.uuid(),
        number: z.number().int(),
        state: z.enum(['RESERVED', 'SUBMITTED', 'REJECTED', 'CONFIRMED', 'REMOVING']),
        fileId: z.uuid(),
        mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
        submittedAt: z.string().nullable(),
        reviewedAt: z.string().nullable(),
        rejectionReason: z.string().nullable(),
        bank: bankInstructions,
        reviewer: z.uuid().nullable().optional(),
        financeNote: z.string().nullable().optional(),
        reference: z.string().nullable().optional(),
      }),
    )
    .max(20),
  receipt: z
    .object({
      id: z.uuid(),
      reference: z.string(),
      issuedAt: z.string(),
      kind: z.literal('PAYMENT_RECEIPT'),
    })
    .nullable(),
});
export type PaymentDetails = z.infer<typeof paymentDetails>;
const base = { orderId: z.uuid(), mutationId: z.uuid(), revision: z.number().int().nonnegative() };
const confirmation = {
  amountMinor: money,
  currency: z.enum(['SAR', 'EGP']),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
};
export const paymentCommand = z.discriminatedUnion('action', [
  z.strictObject({
    ...base,
    action: z.literal('choose'),
    payload: z.strictObject({ method: z.enum(paymentMethods) }),
  }),
  z.strictObject({
    ...base,
    action: z.literal('confirm_cash'),
    payload: z.strictObject(confirmation),
  }),
  z.strictObject({
    ...base,
    action: z.literal('confirm_transfer'),
    payload: z.strictObject({ ...confirmation, attemptId: z.uuid() }),
  }),
  z.strictObject({
    ...base,
    action: z.literal('reject_transfer'),
    payload: z.strictObject({
      attemptId: z.uuid(),
      reason: z.string().trim().min(1).max(500),
      note: z.string().trim().max(500).optional(),
    }),
  }),
]);
export const paymentResult = z.object({
  paymentId: z.uuid(),
  revision: z.number().int(),
  status: z.enum(paymentStates),
  method: z.enum(paymentMethods),
  executionAllowed: z.boolean(),
  attemptId: z.uuid().optional(),
  fileId: z.uuid().optional(),
  path: z.string().optional(),
});
export const financeRow = z.object({
  customerName: z.string(),
  marketNameAr: z.string(),
  marketNameEn: z.string(),
  timezone: z.string(),
  latestProof: z
    .object({
      id: z.uuid(),
      submittedAt: z.string(),
      bankNameAr: z.string(),
      bankNameEn: z.string(),
    })
    .nullable(),
  orderId: z.uuid(),
  reference: z.string(),
  customerId: z.uuid(),
  marketId: z.uuid(),
  currency: z.enum(['SAR', 'EGP']),
  amountMinor: money,
  method: z.enum(paymentMethods).nullable(),
  status: z.enum(paymentStates),
  createdAt: z.string(),
});
export const clearance = z.object({
  executionAllowed: z.boolean(),
  method: z.enum(paymentMethods).nullable().optional(),
  status: z.enum(paymentStates).optional(),
});
export const bankConfiguration = z.strictObject({
  organizationId: z.uuid(),
  marketId: z.uuid(),
  id: z.uuid(),
  revision: z.number().int().nonnegative(),
  mutationId: z.uuid(),
  details: z
    .strictObject({
      bankNameAr: z.string().trim().min(1).max(120),
      bankNameEn: z.string().trim().min(1).max(120),
      beneficiaryAr: z.string().trim().min(1).max(160),
      beneficiaryEn: z.string().trim().min(1).max(160),
      iban: z.union([z.literal(''), z.string().regex(/^[A-Z]{2}[0-9A-Z]{13,32}$/)]),
      accountNumber: z.union([z.literal(''), z.string().regex(/^[0-9A-Za-z-]{4,40}$/)]),
      bic: z.union([z.literal(''), z.string().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/)]),
      instructionsAr: z.string().max(1500),
      instructionsEn: z.string().max(1500),
      active: z.boolean(),
      primary: z.boolean(),
    })
    .refine((d) => Boolean(d.iban || d.accountNumber), {
      path: ['accountNumber'],
      message: 'Account required',
    }),
});
