import { Brand as OfficialBrand } from '@/components/design-system/brand';
import type { Locale } from './types';

/** Compatibility entry point: retain the approved Commerce markup and styling. */
export function Brand({ locale }: { locale: Locale }) {
  return <OfficialBrand locale={locale} href={'/' + locale} sourceAppearance />;
}
