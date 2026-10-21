'use client';
import { parseThemeMode, type ThemeMode } from './adapter';
export function subscribeTheme(listener: () => void) {
  window.addEventListener('naql365-theme-change', listener);
  return () => window.removeEventListener('naql365-theme-change', listener);
}
export function readTheme() {
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
