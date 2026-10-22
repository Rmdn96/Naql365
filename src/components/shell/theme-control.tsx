'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/i18n/config';
import { useHydrated } from '@/components/ui/use-hydrated';

import {
  subscribeTheme,
  readTheme,
  chooseTheme,
  type ThemeMode,
} from '@/components/design-system/theme';

export function ThemeControl({ locale, initialMode }: { locale: Locale; initialMode: ThemeMode }) {
  const mode = useSyncExternalStore(subscribeTheme, readTheme, () => initialMode);
  const hydrated = useHydrated();
  const labels =
    locale === 'ar'
      ? { label: 'المظهر', light: 'فاتح', dark: 'داكن', system: 'حسب النظام' }
      : { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' };

  return (
    <label className="theme-control">
      <span className="sr-only">{labels.label}</span>
      <select
        aria-label={labels.label}
        disabled={!hydrated}
        aria-busy={!hydrated}
        value={mode}
        onChange={(event) => chooseTheme(event.target.value as ThemeMode)}
      >
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
        <option value="system">{labels.system}</option>
      </select>
    </label>
  );
}
