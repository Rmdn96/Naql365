import { z } from 'zod';
import copy from '@/content/legal.json';
import type { Locale } from '@/i18n/config';
const approvedCopy = z
  .object({
    title: z.string().min(1),
    paragraphs: z.array(z.string().min(1)).min(1),
    approvedRevision: z.string().min(1),
  })
  .nullable();
export const legalKind = z.enum(['privacy', 'terms']);
export function legalContent(kind: z.infer<typeof legalKind>, locale: Locale) {
  // Only owner/legal-reviewed text with an explicit approval revision may be published.
  return approvedCopy.parse(copy[kind][locale]);
}
