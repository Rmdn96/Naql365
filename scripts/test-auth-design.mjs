// Read-only loopback visual evidence; no configured backend or authentication fixtures.
import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startBrowserServer, stopBrowserServer } from './browser-server.mjs';

const root = process.cwd();
const output = resolve(process.env.NAQL365_AUTH_OUTPUT || 'test-results/auth-design');
const before = process.env.NAQL365_AUTH_BASELINE;
const identity = JSON.parse(readFileSync('.naql365-build-identity.json', 'utf8'));
if (identity.environment !== 'local' || identity.backend !== '')
  throw Error('AUTH_DESIGN_REQUIRES_UNCONFIGURED_LOCAL_BUILD');
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: 'http://127.0.0.1:3000',
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
  STAGING_AUTH_SMOKE_ENABLED: 'false',
};
for (const key of [
  'VERCEL_ENV',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
])
  delete env[key];
const origin = 'http://127.0.0.1:3013';
mkdirSync(output, { recursive: true });
const evidence = {
  approvedLovable: '2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891',
  cloudAccess: false,
  databaseWrites: false,
  pairs: [],
  pass: false,
};
const scenarios = [];
for (const locale of ['ar', 'en']) {
  for (const width of [1440, 390])
    for (const theme of ['light', 'dark', 'system'])
      scenarios.push({ locale, width, theme, route: 'login' });
  for (const route of ['register', 'recover', 'password', 'auth-complete', 'driver/login'])
    scenarios.push({ locale, width: 390, theme: 'light', route });
}
let browser;
try {
  browser = await chromium.launch();
  for (const phase of before ? ['before', 'after'] : ['after']) {
    process.chdir(phase === 'before' ? resolve(root, before) : root);
    const check = JSON.parse(readFileSync('.naql365-build-identity.json', 'utf8'));
    if (check.environment !== 'local' || check.backend !== '')
      throw Error('AUTH_BASELINE_BUILD_UNSAFE');
    let server;
    try {
      server = await startBrowserServer(env, 3013);
      for (const scenario of scenarios) {
        const { locale, width, theme, route } = scenario;
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          colorScheme: 'light',
        });
        try {
          await context.route('**/*', (request) =>
            new URL(request.request().url()).origin === origin &&
            request.request().method() === 'GET'
              ? request.continue()
              : request.abort(),
          );
          await context.addCookies([{ name: 'naql365_theme', value: theme, url: origin }]);
          const page = await context.newPage();
          const response = await page.goto(`${origin}/${locale}/${route}`);
          expect(response.status()).toBe(200);
          await expect(page.locator('h1')).toHaveCount(1);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator('html')).toHaveAttribute(
            'dir',
            locale === 'ar' ? 'rtl' : 'ltr',
          );
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          if (phase === 'after') {
            await expect(page.locator('.site-header, .site-footer, .floating-contact')).toHaveCount(
              0,
            );
            await expect(page.locator('.auth-toolbar')).toBeVisible();
            await expect(page.locator('.auth-v2 .brand-mark')).toBeVisible();
            await expect(page.locator('.auth-v2')).toBeVisible();
          }
          const filename = `${route.replaceAll('/', '-')}-${locale}-${theme}-${width}-${phase}.png`;
          await page.screenshot({ path: resolve(output, filename), fullPage: true });
          const metrics =
            phase === 'before' && route === 'driver/login'
              ? null
              : await page.locator('.auth-v2-surface').evaluate((el) => {
                  const r = el.getBoundingClientRect(),
                    css = getComputedStyle(el);
                  return {
                    width: r.width,
                    height: r.height,
                    background: css.backgroundColor,
                    font: css.fontFamily,
                  };
                }); // Old Driver login has no Auth panel; record that actual difference.
          evidence.pairs.push({
            ...scenario,
            phase,
            filename,
            metrics,
            sha256: createHash('sha256')
              .update(readFileSync(resolve(output, filename)))
              .digest('hex'),
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      await stopBrowserServer(server, 3013);
    }
  }
  evidence.pass = true;
} finally {
  process.chdir(root);
  await browser?.close();
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(evidence, null, 2));
}
console.log(JSON.stringify({ captures: evidence.pairs.length, pass: evidence.pass }));
