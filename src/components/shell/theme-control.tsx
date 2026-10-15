'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/i18n/config';
import { useHydrated } from '@/components/ui/use-hydrated';

type ThemeMode = 'light' | 'dark' | 'system';
const themeCookie = 'naql365_theme';
const themeChange = 'naql365-theme-change';

function subscribe(listener: () => void) {
  window.addEventListener(themeChange, listener);
  return () => window.removeEventListener(themeChange, listener);
}

function currentTheme(): ThemeMode {
  const value = document.documentElement.dataset.theme;
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function ThemeControl({ locale, initialMode }: { locale: Locale; initialMode: ThemeMode }) {
  const mode = useSyncExternalStore(subscribe, currentTheme, () => initialMode);
  const hydrated = useHydrated();
  const labels =
    locale === 'ar'
      ? { label: 'المظهر', light: 'فاتح', dark: 'داكن', system: 'حسب النظام' }
      : { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' };

  function changeTheme(next: ThemeMode) {
    document.documentElement.dataset.theme = next;
    document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    window.dispatchEvent(new Event(themeChange));
  }

  return (
    <label className="theme-control">
      <span className="sr-only">{labels.label}</span>
      <select
        aria-label={labels.label}
        disabled={!hydrated}
        aria-busy={!hydrated}
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
