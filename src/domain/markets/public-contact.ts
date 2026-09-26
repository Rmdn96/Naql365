import { z } from 'zod';

export const publicCountry = z.enum(['SA', 'EG']);
export type PublicCountry = z.infer<typeof publicCountry>;

// Intentionally public contact configuration. Payment destinations are never read here.
export const marketContact = {
  SA: { display: '0558985250', destination: '966558985250' },
  EG: { display: '01009402374', destination: '201009402374' },
} as const satisfies Record<PublicCountry, { display: string; destination: string }>;

const requestReference = z
  .string()
  .regex(/^N365-[0-9]{6}-[0-9]{6,}$/)
  .max(40);

export function whatsappUrl(
  country: PublicCountry,
  locale: 'ar' | 'en',
  reference?: string,
): string {
  const contact = marketContact[publicCountry.parse(country)];
  // Accept a reference only, never free-form text, a URL, contact data or a token.
  const safeReference = reference === undefined ? undefined : requestReference.parse(reference);
  const message = safeReference
    ? locale === 'ar'
      ? `مرحبًا، أحتاج مساعدة بخصوص طلب Naql365 رقم ${safeReference}.`
      : `Hello, I need help with Naql365 request ${safeReference}.`
    : locale === 'ar'
      ? 'مرحبًا، أتواصل معكم من موقع Naql365 وأحتاج مساعدة بخصوص خدمة نقل.'
      : 'Hello, I am contacting you from Naql365 and need help with a transport service.';
  return `https://wa.me/${contact.destination}?text=${encodeURIComponent(message)}`;
}
