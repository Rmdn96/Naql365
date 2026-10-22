// Presentation-only local regression. No Supabase configuration, fixtures or grants.
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { assertBrowserPortFree, startBrowserServer, stopBrowserServer } from './browser-server.mjs';

const origin = 'http://127.0.0.1:3013';
const output = resolve(process.env.NAQL365_DESIGN_OUTPUT || 'test-results/design-foundation');
const baseline = process.env.NAQL365_DESIGN_BASELINE;
const approved = '2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891';
const identity = JSON.parse(readFileSync('.naql365-build-identity.json', 'utf8'));
if (identity.environment !== 'local' || identity.backend !== '')
  throw Error('DESIGN_TEST_REQUIRES_UNCONFIGURED_LOCAL_BUILD');
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: identity.origin,
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
  STAGING_AUTH_SMOKE_ENABLED: 'false',
};
if (!['http://127.0.0.1:3000', origin].includes(identity.origin))
  throw Error('DESIGN_TEST_REQUIRES_LOOPBACK_ORIGIN');
for (const name of [
  'VERCEL_ENV',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
])
  delete env[name];
const reference = baseline
  ? JSON.parse(readFileSync(resolve(baseline, 'manifest.json'), 'utf8'))
  : null;
if (reference && reference.source !== approved) throw Error('DESIGN_REFERENCE_MISMATCH');
mkdirSync(output, { recursive: true });
const evidence = { source: approved, databaseWrites: false, entries: [], pass: false };
let server, browser;
try {
  await assertBrowserPortFree(3013);
  server = await startBrowserServer(env, 3013);
  browser = await chromium.launch();
  for (const locale of ['ar', 'en'])
    for (const width of [1440, 390])
      for (const theme of ['light', 'dark', 'system']) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: 'light',
        });
        // Disallow accidentally reaching an external backend, even after future changes.
        await context.route('**/*', (route) => {
          const request = route.request();
          return new URL(request.url()).origin === origin && request.method() === 'GET'
            ? route.continue()
            : route.abort();
        });
        await context.addCookies([{ name: 'naql365_theme', value: theme, url: origin }]);
        const page = await context.newPage();
        try {
          await page.goto(origin + '/' + locale);
          await expect(page.locator('.cm-hero')).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator('html')).toHaveAttribute(
            'dir',
            locale === 'ar' ? 'rtl' : 'ltr',
          );
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('.cm-header .brand-mark')).toBeVisible();
          await expect
            .poll(() =>
              page
                .locator('.cm-hero img')
                .evaluate((image) => image.complete && image.naturalWidth > 0),
            )
            .toBe(true);
          const metrics = await page.evaluate(() => {
            const measure = (selector) => {
              const element = document.querySelector(selector);
              const rect = element.getBoundingClientRect();
              const css = getComputedStyle(element);
              return { height: rect.height, width: rect.width, fontFamily: css.fontFamily };
            };
            return {
              header: measure('.cm-header'),
              hero: measure('.cm-hero'),
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          expect(metrics.overflow).toBe(false);
          const name = `homepage-${locale}-${theme}-${width}`;
          const before = reference?.entries.find(
            (entry) =>
              entry.scenario === 'homepage' &&
              entry.locale === locale &&
              entry.width === width &&
              entry.theme === theme,
          );
          if (reference) expect(before).toBeTruthy();
          if (before) {
            for (const part of ['header', 'hero']) {
              expect(metrics[part].height).toBe(before.integration[part].height);
              expect(metrics[part].width).toBe(before.integration[part].width);
            }
            const bytes = readFileSync(resolve(baseline, before.integration.file));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(
              before.integration.sha256,
            );
            copyFileSync(
              resolve(baseline, before.integration.file),
              resolve(output, name + '-before.png'),
            );
          }
          expect(metrics.header.fontFamily).toContain(locale === 'ar' ? 'Alexandria' : 'Inter');
          await page.screenshot({ path: resolve(output, name + '-after.png') });
          evidence.entries.push({ locale, width, theme, metrics, paired: !!before });
          if (theme === 'light') {
            for (const route of ['/login', '/driver/login']) {
              await page.goto(origin + '/' + locale + route);
              await expect(page.locator('[data-naql-brand]').first()).toBeVisible();
              await expect(page.locator('[data-naql-brand] .brand-mark').first()).toBeVisible();
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
              ).toBe(false);
              await page.screenshot({
                path: resolve(
                  output,
                  `${route.includes('driver') ? 'driver' : 'auth'}-${locale}-${width}-after.png`,
                ),
              });
            }
          }
        } finally {
          await context.close();
        }
      }
  expect(evidence.entries).toHaveLength(12);
  evidence.pass = true;
  console.log('Design foundation: 12/12 AR/EN theme/width comparisons PASS. No database fixtures.');
} finally {
  await browser?.close();
  if (server) await stopBrowserServer(server, 3013);
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(evidence, null, 2));
}
