import { Brand } from '@/components/design-system/brand';
import type { Locale } from '@/i18n/config';

export function BrandLink({
  href,
  label,
  locale,
  size = 'public',
}: {
  href: string;
  label: string;
  locale?: Locale;
  size?: 'public' | 'auth' | 'customer' | 'driver' | 'mobile';
}) {
  return (
    <Brand
      href={href}
      label={label}
      locale={locale ?? (href.startsWith('/en') ? 'en' : 'ar')}
      size={size}
    />
  );
}
