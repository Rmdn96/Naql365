import type { PublicCountry } from '@/domain/markets/public-contact';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
export function MarketSelector({
  locale,
  id = 'public-market',
}: {
  country: PublicCountry;
  locale: Locale;
  id?: string;
}) {
  return (
    <span id={id} className="market-control" aria-label={publicDictionary(locale).country}>
      🇪🇬 {publicDictionary(locale).eg}
    </span>
  );
}
