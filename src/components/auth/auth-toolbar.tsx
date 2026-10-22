import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { PublicCountry } from '@/domain/markets/public-contact';
import { LocaleLink } from '@/components/shell/locale-link';
import { MarketSelector } from '@/components/shell/market-selector';
import { ThemeControl } from '@/components/shell/theme-control';

/** Original Auth Preview toolbar, without lab controls or simulated screen state. */
export function AuthToolbar({
  locale,
  country,
  themeMode,
}: {
  locale: Locale;
  country: PublicCountry;
  themeMode: 'light' | 'dark' | 'system';
}) {
  const ar = locale === 'ar';
  return (
    <header className="auth-toolbar">
      <a className="skip-link" href="#main">
        {ar ? 'تخطّ إلى المحتوى' : 'Skip to content'}
      </a>
      <Link href={`/${locale}`} className="auth-back">
        <ArrowLeft size={16} aria-hidden="true" />
        {ar ? 'العودة للرئيسية' : 'Back to home'}
      </Link>
      <nav aria-label={ar ? 'تفضيلات الحساب' : 'Account preferences'}>
        <MarketSelector locale={locale} country={country} id="auth-market" />
        <ThemeControl locale={locale} initialMode={themeMode} />
        <LocaleLink locale={locale} label={ar ? 'English' : 'العربية'} />
      </nav>
    </header>
  );
}
