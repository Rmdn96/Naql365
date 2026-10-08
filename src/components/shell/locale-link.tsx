'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';

export function LocaleLink({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const other = locale === 'ar' ? 'en' : 'ar';
  // Only the localized path survives. Never copy fragment capabilities or auth query codes.
  const safePath = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  const href = safePath.startsWith(`/${other}`) ? safePath : `/${other}`;
  return (
    <Link className="language-link" href={href} lang={other} hrefLang={other}>
      {label}
    </Link>
  );
}
