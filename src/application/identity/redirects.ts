import type { Locale } from '@/i18n/config';
export function safeRedirect(value: string | null, locale: Locale): string {
  const fallback = `/${locale}/account`;
  if (!value || /[\\\u0000-\u0020%]/.test(value)) return fallback;
  if (!/^\/(ar|en)(?:\/(?:account|portal|driver|password))?\/?$/.test(value)) return fallback;
  return value;
}
