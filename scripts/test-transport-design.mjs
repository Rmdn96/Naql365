// GET-only, loopback-only visual evidence. Optional Phase 2 and unchanged Lovable references.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { assertBrowserPortFree, startBrowserServer, stopBrowserServer } from './browser-server.mjs';

const root = process.cwd(),
  output = resolve(process.env.NAQL365_TRANSPORT_OUTPUT || 'test-results/transport-design');
const baseline = process.env.NAQL365_TRANSPORT_BASELINE,
  source = process.env.NAQL365_TRANSPORT_SOURCE;
const evidence = {
  source: '2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891',
  baseline: 'd530a4cc142769a66aad6fe3fc22875cc4053324',
  databaseWrites: false,
  captures: [],
  pass: false,
};
const resume = process.env.NAQL365_TRANSPORT_RESUME === 'true';
if (resume)
  evidence.captures = JSON.parse(
    readFileSync(resolve(output, 'manifest.json'), 'utf8'),
  ).captures.filter((c) => c.phase === 'before');
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
mkdirSync(output, { recursive: true });
let browser, server, sourceGeneratedPath, sourceGeneratedBytes;
const referenceFontCSS = readdirSync('.next/static/chunks')
  .filter((f) => f.endsWith('.css'))
  .flatMap((f) =>
    [
      ...readFileSync(resolve('.next/static/chunks', f), 'utf8').matchAll(
        /@font-face\{font-family:(?:Alexandria|Inter);[^}]+\}/g,
      ),
    ].map((m) => m[0]),
  )
  .join('')
  .replaceAll('../media/', 'http://127.0.0.1:4173/__reference-font/');
async function capture(page, phase, route, locale, theme, width) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('img').evaluateAll(async (images) => {
    for (const image of images) {
      const rect = image.getBoundingClientRect();
      if (rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight) await image.decode();
    }
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const file = `${phase}-${route.replaceAll('/', '-') || 'home'}-${locale}-${theme}-${width}.png`;
  await page.screenshot({ path: resolve(output, file), fullPage: true });
  evidence.captures.push({
    phase,
    route: route || 'home',
    locale,
    theme,
    width,
    file,
    sha256: createHash('sha256')
      .update(readFileSync(resolve(output, file)))
      .digest('hex'),
  });
}
try {
  browser = await chromium.launch();
  for (const phase of baseline && !resume ? ['before', 'after'] : ['after']) {
    process.chdir(phase === 'before' ? resolve(root, baseline) : root);
    const identity = JSON.parse(readFileSync('.naql365-build-identity.json', 'utf8'));
    if (identity.environment !== 'local' || identity.backend !== '')
      throw Error('TRANSPORT_VISUAL_REQUIRES_UNCONFIGURED_LOCAL_BUILD');
    server = await startBrowserServer(env, 3013);
    try {
      for (const locale of ['ar', 'en'])
        for (const theme of ['light', 'dark', 'system']) {
          const context = await browser.newContext({
            colorScheme: theme === 'system' ? 'dark' : theme,
          });
          try {
            await context.route('**/*', (route) =>
              new URL(route.request().url()).origin === 'http://127.0.0.1:3013' &&
              route.request().method() === 'GET'
                ? route.continue()
                : route.abort(),
            );
            await context.addCookies([
              { name: 'naql365_theme', value: theme, url: 'http://127.0.0.1:3013' },
            ]);
            const page = await context.newPage();
            const routes =
              phase === 'after'
                ? [
                    'transport',
                    '',
                    'request',
                    'login',
                    'account',
                    'guest',
                    'account/requests/10000000-0000-4000-8000-000000000001',
                  ]
                : [
                    '',
                    'request',
                    'login',
                    'account',
                    'guest',
                    'account/requests/10000000-0000-4000-8000-000000000001',
                  ];
            for (const route of routes) {
              await page.goto(`http://127.0.0.1:3013/${locale}/${route}`);
              await expect(page.locator('html')).toHaveAttribute(
                'dir',
                locale === 'ar' ? 'rtl' : 'ltr',
              );
              await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
              for (const width of route === 'transport'
                ? [360, 390, 768, 1280, 1440]
                : [390, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                await capture(page, phase, route, locale, theme, width);
              }
            }
          } finally {
            await context.close();
          }
        }
    } finally {
      await stopBrowserServer(server, 3013);
      server = null;
    }
  }
  if (source) {
    process.chdir(resolve(root, source));
    sourceGeneratedPath = resolve('src/routeTree.gen.ts');
    sourceGeneratedBytes = readFileSync(sourceGeneratedPath);
    await assertBrowserPortFree(4173);
    server = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
      { env, windowsHide: true, stdio: 'ignore', detached: process.platform !== 'win32' },
    );
    const deadline = Date.now() + 60000;
    while (true) {
      if (server.exitCode !== null) throw Error('LOVABLE_REFERENCE_EXITED');
      if (
        await fetch('http://127.0.0.1:4173/transport-home-preview')
          .then((r) => r.ok)
          .catch(() => false)
      )
        break;
      if (Date.now() >= deadline) throw Error('LOVABLE_REFERENCE_NOT_READY');
      await delay(100);
    }
    const context = await browser.newContext();
    try {
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2')
          return route.fulfill({ contentType: 'text/css', body: referenceFontCSS });
        if (
          url.origin === 'http://127.0.0.1:4173' &&
          /^\/__reference-font\/[a-zA-Z0-9_.-]+\.woff2$/.test(url.pathname)
        )
          return route.fulfill({
            contentType: 'font/woff2',
            body: readFileSync(
              resolve(root, '.next/static/media', url.pathname.slice('/__reference-font/'.length)),
            ),
          });
        return url.origin === 'http://127.0.0.1:4173' && route.request().method() === 'GET'
          ? route.continue()
          : route.abort();
      });
      const page = await context.newPage();
      for (const locale of ['ar', 'en']) {
        await page.goto('http://127.0.0.1:4173/transport-home-preview');
        if (locale === 'en')
          await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
        await expect(page.locator('h1')).toBeVisible();
        for (const width of [360, 390, 768, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await capture(page, 'lovable', 'transport', locale, 'dark', width);
        }
      }
    } finally {
      await context.close();
    }
    await stopBrowserServer(server, 4173);
    server = null;
  }
  evidence.pass = true;
} finally {
  if (server)
    await stopBrowserServer(
      server,
      source && process.cwd() === resolve(root, source) ? 4173 : 3013,
    );
  process.chdir(root);
  if (sourceGeneratedBytes) writeFileSync(sourceGeneratedPath, sourceGeneratedBytes);
  await browser?.close();
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(evidence, null, 2));
}
console.log(JSON.stringify({ pass: evidence.pass, captures: evidence.captures.length }));
