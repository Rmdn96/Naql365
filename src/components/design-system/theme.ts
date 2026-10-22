'use client';

export const themeModes = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof themeModes)[number];
export const parseThemeMode = (value: unknown): ThemeMode =>
  value === 'light' || value === 'dark' ? value : 'system';

export function subscribeTheme(listener: () => void) {
  window.addEventListener('naql365-theme-change', listener);
  return () => window.removeEventListener('naql365-theme-change', listener);
}

export function readTheme(): ThemeMode {
  return parseThemeMode(document.documentElement.dataset.theme);
}

export function chooseTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  document.cookie =
    'naql365_theme=' +
    mode +
    '; Path=/; Max-Age=31536000; SameSite=Lax' +
    (location.protocol === 'https:' ? '; Secure' : '');
  window.dispatchEvent(new Event('naql365-theme-change'));
}
