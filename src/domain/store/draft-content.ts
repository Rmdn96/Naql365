/** Optional public descriptions are absent, never empty SQL-invalid strings. */
export function optionalDescriptions(ar: string, en: string) {
  return {
    ...(ar.trim() ? { description_ar: ar.trim() } : {}),
    ...(en.trim() ? { description_en: en.trim() } : {}),
  };
}
