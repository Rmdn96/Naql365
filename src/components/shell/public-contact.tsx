'use client';
import { usePathname } from 'next/navigation';
import { whatsappUrl, type PublicCountry } from '@/domain/markets/public-contact';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
export function PublicContact({ country, locale }: { country: PublicCountry; locale: Locale }) {
  const pathname = usePathname();
  if (/^\/(ar|en)\/(portal|driver)(\/|$)/.test(pathname)) return null;
  return (
    <a
      className="floating-contact"
      href={whatsappUrl(country, locale)}
      rel="noreferrer"
      aria-label={publicDictionary(locale).whatsapp}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A9.5 9.5 0 0 1 12 2a9 9 0 0 1 9 9.5Z" />
        <path d="M7 9h10M7 13h7" />
      </svg>
      <span>{publicDictionary(locale).whatsapp}</span>
    </a>
  );
}
