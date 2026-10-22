import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const control = readFileSync('src/components/shell/theme-control.tsx', 'utf8');
const preference = readFileSync('src/components/design-system/theme.ts', 'utf8');

test('theme foundation defines semantic light, dark and system modes', () => {
  for (const token of [
    '--theme-background',
    '--theme-surface',
    '--theme-surface-elevated',
    '--theme-surface-muted',
    '--theme-text-primary',
    '--theme-text-secondary',
    '--theme-border',
    '--theme-brand',
    '--theme-accent',
    '--theme-success',
    '--theme-warning',
    '--theme-destructive',
    '--theme-focus',
    '--theme-shadow',
  ])
    expect(tokens).toContain(token);
  expect(tokens).toContain("html[data-theme='dark']");
  expect(tokens).toContain("html[data-theme='system']");
  expect(tokens).toContain('prefers-color-scheme: light');
});

test('theme control persists explicit choices without touching auth or backend state', () => {
  expect(control).toContain("from '@/components/design-system/theme'");
  expect(control).toContain('chooseTheme(event.target.value as ThemeMode)');
  expect(preference).toContain("['system', 'light', 'dark']");
  expect(preference).toContain('naql365_theme');
  expect(preference).toContain('SameSite=Lax');
  expect(preference).not.toContain('localStorage');
  expect(preference).not.toContain('supabase');
  expect(control).not.toContain('supabase');
});
