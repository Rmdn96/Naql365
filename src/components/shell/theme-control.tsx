'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n/config';

type ThemeMode = 'light' | 'dark' | 'system';
const themeCookie = 'naql365_theme';

export function ThemeControl({ locale, initialMode }: { locale: Locale; initialMode: ThemeMode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const labels =
    locale === 'ar'
      ? { label: 'المظهر', light: 'فاتح', dark: 'داكن', system: 'حسب النظام' }
      : { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' };

  function changeTheme(next: ThemeMode) {
    setMode(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }

  return (
    <label className="theme-control">
      <span className="sr-only">{labels.label}</span>
      <select
        aria-label={labels.label}
        value={mode}
        onChange={(event) => changeTheme(event.target.value as ThemeMode)}
      >
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
        <option value="system">{labels.system}</option>
      </select>
    </label>
  );
}
