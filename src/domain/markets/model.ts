import { z } from 'zod';

export const marketSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  name_ar: z.string(),
  name_en: z.string(),
  active: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string(),
  phone_country_code: z.string(),
});
export type Market = z.infer<typeof marketSchema>;

export function marketDate(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
export function marketDateTime(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
// Derive candidate offsets from IANA/Intl, then round-trip each candidate. No seasonal offsets.
// Ambiguous/nonexistent local input is rejected instead of silently scheduling another instant.
export function localScheduleToInstant(local: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Invalid local schedule');
  const nominal = Date.parse(local + ':00Z');
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 16) !== local)
    throw new Error('Invalid local schedule');
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = nominal + hours * 3_600_000;
    offsets.add(Date.parse(marketDateTime(new Date(sample), timezone) + ':00Z') - sample);
  }
  const candidates = [...offsets]
    .map((offset) => new Date(nominal - offset))
    .filter((date) => marketDateTime(date, timezone) === local);
  if (candidates.length !== 1) throw new Error('Ambiguous or nonexistent market local time');
  return candidates[0]!.toISOString();
}
export function formatMoney(minor: number, currency: string, locale: 'ar' | 'en'): string {
  if (!Number.isSafeInteger(minor) || !/^[A-Z]{3}$/.test(currency))
    throw new Error('Invalid money');
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export function normalizeMarketPhone(value: string, callingCode?: string): string {
  const normalized = value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s()-]/g, '');
  if (normalized.startsWith('+')) return normalized;
  if (normalized.startsWith('00')) return '+' + normalized.slice(2);
  if (callingCode && /^0[1-9]\d+$/.test(normalized)) return callingCode + normalized.slice(1);
  return normalized;
}
