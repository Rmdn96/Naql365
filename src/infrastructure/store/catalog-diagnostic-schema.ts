import { z } from 'zod';
const field = z.enum([
  'root',
  'status',
  'items',
  'nextCursor',
  'slug',
  'listingId',
  'revision',
  'category',
  'content',
  'title_ar',
  'title_en',
  'description_ar',
  'description_en',
  'specifications',
  'label_ar',
  'label_en',
  'value_ar',
  'value_en',
  'amountMinor',
  'currency',
  'media',
  'src',
  'altAr',
  'altEn',
]);
export function catalogIssueFields(issues: readonly { path: PropertyKey[] }[]) {
  return [
    ...new Set(
      issues.map((issue) => {
        for (const part of [...issue.path].reverse()) {
          const parsed = field.safeParse(part);
          if (parsed.success) return parsed.data;
        }
        return 'root' as const;
      }),
    ),
  ].slice(0, 8);
}
export const diagnostic = z.strictObject({
  stage: z.enum([
    'startup',
    'configuration',
    'request',
    'client',
    'rpc',
    'projection',
    'render',
    'fallback',
  ]),
  outcome: z.enum(['started', 'ready', 'threw']).optional(),
  source: z.enum(['catalog', 'categories']).optional(),
  configured: z.boolean().optional(),
  loopback: z.boolean().optional(),
  backendPort: z.number().int().min(1).max(65535).optional(),
  country: z.enum(['EG', 'SA']).optional(),
  httpStatus: z.number().int().min(0).max(599).optional(),
  rpcError: z.boolean().optional(),
  code: z
    .string()
    .regex(/^[A-Z0-9]{5,10}$/)
    .optional(),
  available: z.boolean().optional(),
  items: z.number().int().nonnegative().max(20).optional(),
  valid: z.boolean().optional(),
  invalidFields: field.array().max(8).optional(),
});
export const diagnosticRecord = diagnostic.extend({
  version: z.literal(1),
  phase: z.enum(['build', 'runtime', 'unknown']),
  processId: z.number().int().positive(),
  requestId: z.number().int().nonnegative(),
  sequence: z.number().int().positive().max(128),
  build: z
    .string()
    .regex(/^[a-f0-9]{12}$/)
    .nullable(),
});
