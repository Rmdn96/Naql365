'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { recordMvpEvent } from '@/components/public/analytics';
import { whatsappUrl, type PublicCountry } from '@/domain/markets/public-contact';
import type { Locale } from '@/i18n/config';
import { publicDictionary } from '@/i18n/public';
export function PublicContact({ country, locale }: { country: PublicCountry; locale: Locale }) {
  const pathname = usePathname();
  useEffect(() => {
    if (/^\/(ar|en)\/(portal|driver)(\/|$)/.test(pathname)) return;
    function recordClick(event: MouseEvent) {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || new URL(anchor.href).hostname !== 'wa.me') return;
      const context = pathname.includes('/payment')
        ? 'checkout'
        : pathname.includes('/quotes')
          ? 'quote'
          : pathname.includes('/orders')
            ? 'tracking'
            : pathname.includes('/request')
              ? 'request'
              : 'home';
      recordMvpEvent('whatsapp_clicked', anchor.dataset.marketCountry ?? country, context);
    }
    document.addEventListener('click', recordClick);
    return () => document.removeEventListener('click', recordClick);
  }, [pathname, country]);
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
