'use client';
import '@/styles/lovable.css';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { DesignFoundation } from '@/components/design-system/foundation';
import { Brand } from '@/components/design-system/brand';
import { ThemeControl } from '@/components/shell/theme-control';
import { driverDictionary } from '@/i18n/driver';
/** Original DriverPreview shell. Visual framing never grants operational authority. */
export function DriverFrame({
  locale,
  themeMode,
  children,
}: {
  locale: Locale;
  themeMode: 'light' | 'dark' | 'system';
  children?: ReactNode;
}) {
  const path = usePathname(),
    ar = locale === 'ar';
  if (path.replace(/\/$/, '') === `/${locale}/driver/login`) return children;
  return (
    <DesignFoundation
      family="driver"
      className="cx dx driver-workspace"
      lang={locale}
      dir={ar ? 'rtl' : 'ltr'}
    >
      <a className="skip-link" href="#driver-content">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <header className="dx-top">
        <Brand locale={locale} href={`/${locale}/driver`} size="driver" />
        <span className="driver-workspace-title">{driverDictionary(locale).title}</span>
        <div className="driver-preferences">
          <ThemeControl locale={locale} initialMode={themeMode} />
          <Link href={`/${locale}`}>{ar ? 'الصفحة الرئيسية' : 'Homepage'}</Link>
        </div>
      </header>
      <div id="driver-content" className="dx-main" tabIndex={-1}>
        {children}
      </div>
    </DesignFoundation>
  );
}
