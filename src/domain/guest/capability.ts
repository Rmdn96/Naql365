import { z } from 'zod';

// Versioned, canonical hexadecimal encoding: 32 independently random bytes.
export const guestSecret = z.string().regex(/^g1_[0-9a-f]{64}$/);
export const guestExchange = z.object({ token: guestSecret }).strict();
export const guestLifetimeDays = z.number().int().min(1).max(90);
export const guestCookieName = 'naql365_guest';

export function guestContinuationPath(locale: 'ar' | 'en', token: string): string {
  return `/${locale}/guest#${guestSecret.parse(token)}`;
}

// Parse only the entire fragment. No query-string fallback or reference/UUID lookup.
export function secretFromFragment(fragment: string): string | null {
  const result = guestSecret.safeParse(fragment.startsWith('#') ? fragment.slice(1) : '');
  return result.success ? result.data : null;
}
