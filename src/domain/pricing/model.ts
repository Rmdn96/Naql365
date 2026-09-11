import { z } from 'zod';

export const distanceSource = z.enum(['MANUAL_VERIFIED', 'ROUTING_PROVIDER']);
export type DistanceSource = z.infer<typeof distanceSource>;

export const calculatePriceInput = z
  .object({
    requestId: z.uuid(),
    distanceKm: z
      .number()
      .positive()
      .max(5000)
      .refine((value) => /^\d+(?:\.\d{1,3})?$/.test(String(value)), 'Use at most three decimals'),
    sourceNote: z.string().trim().max(300).optional().default(''),
    vehicleClassId: z.uuid(),
    workerCount: z.number().int().min(1).max(50),
    mutationId: z.uuid(),
  })
  .strict();

export const createQuoteInput = z
  .object({
    evaluationId: z.uuid(),
    adjustmentMinor: z.number().int().safe(),
    adjustmentReason: z.string().trim().max(500).optional().default(''),
    validitySeconds: z.number().int().min(1).max(2_592_000).default(172_800),
    mutationId: z.uuid(),
  })
  .strict()
  .refine((value) => value.adjustmentMinor === 0 || value.adjustmentReason.length > 0, {
    path: ['adjustmentReason'],
    message: 'Adjustment reason is required',
  });

export const quoteResponseInput = z
  .object({
    action: z.enum(['accept', 'reject']),
    idempotencyKey: z.string().min(1).max(200),
    reason: z.string().trim().max(500).optional().default(''),
  })
  .strict();

export function parseSarToMinor(value: string): number | null {
  const match = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? '').padEnd(2, '0'));
  const amount = whole * 100 + fraction;
  if (!Number.isSafeInteger(amount)) return null;
  return match[1] ? -amount : amount;
}

export function formatSar(minor: number, locale: 'ar' | 'en'): string {
  if (!Number.isSafeInteger(minor)) throw new Error('Invalid money amount');
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export interface DistanceProvider {
  calculateRoute(input: {
    originReference: string;
    destinationReference: string;
  }): Promise<
    | { available: true; distanceKm: string; source: 'ROUTING_PROVIDER'; calculatedAt: Date }
    | { available: false; reason: string }
  >;
}
