export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export function direction(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
export function localizedPath(locale: Locale, path = '') {
  return `/${locale}${path ? `/${path.replace(/^\/+/, '')}` : ''}`;
}
