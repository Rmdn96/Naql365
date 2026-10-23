// Component-only visual verification; explicit synthetic services are not Auth/RLS acceptance.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertBrowserPortFree } from './browser-server.mjs';
const root = process.cwd(),
  baseline = process.env.NAQL365_DRIVER_BASELINE
    ? resolve(process.env.NAQL365_DRIVER_BASELINE)
    : null,
  output = resolve(process.env.NAQL365_DRIVER_OUTPUT || 'test-results/driver-components');
if (
  baseline &&
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: baseline, encoding: 'utf8' }).trim() !==
    'b5c9614bcddb0ca06eceeee978384ece1300b75d'
)
  throw Error('DRIVER_BASELINE_MISMATCH');
mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:3023',
  fontRoot = resolve('.next/static');
const fontCSS = readdirSync(resolve(fontRoot, 'chunks'))
  .filter((f) => f.endsWith('.css'))
  .flatMap((f) =>
    [
      ...readFileSync(resolve(fontRoot, 'chunks', f), 'utf8').matchAll(
        /@font-face\{font-family:(?:Alexandria|Inter);[^}]+\}/g,
      ),
    ].map((m) => m[0]),
  )
  .join('')
  .replaceAll('../media/', '/__font/');
const mocks = {
  'next/navigation': `const q=new URLSearchParams(location.search),l=q.get('locale')==='ar'?'ar':'en';export const usePathname=()=>'/'+l+'/driver';export const useRouter=()=>({refresh(){}});export const notFound=()=>{throw Error('UNEXPECTED_NOT_FOUND')};export const redirect=()=>{throw Error('UNEXPECTED_REDIRECT')};`,
  'next/link': `import{createElement}from'react';export default function Link({href,children,prefetch,replace,scroll,...props}){return createElement('a',{...props,href},children)}`,
  'server-only': '',
  '@/infrastructure/supabase/browser': `export const createSupabaseBrowserClient=()=>({auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}}});`,
  '@/app/auth/driver-actions': `export async function driverLogout(){}`,
  '@/infrastructure/driver/service': `import{driverFixture}from'/tests/driver-ui/fixture.ts';const v=new URLSearchParams(location.search).get('view');export const getDriverTrip=async()=>driverFixture(v);export const getDriverTrips=async()=>v==='empty'?[]:[driverFixture(v)];`,
  '@/infrastructure/payments/service': `export const getPaymentClearance=async()=>({executionAllowed:new URLSearchParams(location.search).get('view')!=='blocked'});`,
};
let browser,
  server,
  checkpoint = 'startup';
const evidence = {
  syntheticComponentsOnly: true,
  databaseWrites: false,
  captures: [],
  accessibility: [],
  pass: false,
};
try {
  if (process.env.NAQL365_DRIVER_RESUME === 'after') {
    const previous = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));
    evidence.captures = previous.captures.filter((c) => c.phase === 'before');
    if (
      evidence.captures.length !== 114 ||
      evidence.captures.some(
        (c) =>
          !/^[a-z0-9-]+\.png$/.test(c.file) ||
          createHash('sha256')
            .update(readFileSync(resolve(output, c.file)))
            .digest('hex') !== c.sha256,
      )
    )
      throw Error('DRIVER_BASELINE_CAPTURE_MISMATCH');
  }
  browser = await chromium.launch();
  for (const phase of process.env.NAQL365_DRIVER_RESUME === 'after'
    ? ['after']
    : baseline
      ? ['before', 'after']
      : ['after']) {
    const application = phase === 'before' ? baseline : root;
    await assertBrowserPortFree(3023);
    server = await createServer({
      configFile: false,
      root,
      envPrefix: [],
      cacheDir: resolve('node_modules/.vite/driver-' + phase),
      logLevel: 'error',
      optimizeDeps: { exclude: ['next/link', 'next/navigation', 'next/image'] },
      server: {
        host: '127.0.0.1',
        port: 3023,
        strictPort: true,
        fs: { allow: [root, application] },
      },
      resolve: { alias: { '@': resolve(application, 'src') }, dedupe: ['react', 'react-dom'] },
      plugins: [
        {
          name: 'explicit-driver-visual-boundaries',
          enforce: 'pre',
          resolveId(id) {
            const prefix = resolve(application, 'src').replaceAll('\\', '/') + '/',
              normalized = id.replaceAll('\\', '/'),
              key = normalized.startsWith(prefix) ? '@/' + normalized.slice(prefix.length) : id;
            if (
              key === '@/components/driver/frame' ||
              key === '@/components/driver/state' ||
              key === '@/styles/driver-source.css' ||
              key === '@/styles/driver-workspace.css'
            )
              return resolve(root, 'src', key.slice(2) + (key.includes('/styles/') ? '' : '.tsx'));
            if (Object.hasOwn(mocks, key)) return '\0driver:' + key;
          },
          load(id) {
            if (id.startsWith('\0driver:')) return mocks[id.slice(8)];
          },
          configureServer(vite) {
            vite.middlewares.use((req, res, next) => {
              if (req.url === '/__fonts.css') {
                res.setHeader('Content-Type', 'text/css');
                res.end(fontCSS);
                return;
              }
              if (/^\/__font\/[a-zA-Z0-9_.-]+\.woff2$/.test(req.url || '')) {
                res.setHeader('Content-Type', 'font/woff2');
                res.end(readFileSync(resolve(fontRoot, 'media', req.url.slice(8))));
                return;
              }
              if (req.url === '/' || req.url?.startsWith('/?')) {
                vite
                  .transformIndexHtml(
                    '/',
                    '<!doctype html><html style="--font-arabic:Alexandria;--font-english:Inter"><head><title>Driver synthetic visual verification</title><link rel="stylesheet" href="/__fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/driver-ui/entry.tsx"></script></body></html>',
                  )
                  .then((html) => {
                    res.setHeader('Content-Type', 'text/html');
                    res.end(html);
                  })
                  .catch(next);
              } else next();
            });
          },
        },
      ],
    });
    await server.listen();

    for (const locale of ['ar', 'en']) {
      const context = await browser.newContext();
      try {
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname.startsWith('/api/'))
            return route.fulfill({ status: 403, json: { error: 'forbidden' } });
          return route.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.name));
        for (const theme of ['light', 'dark', 'system']) {
          await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' });
          for (const view of [
            'dashboard',
            'detail',
            'tracking',
            'issue',
            'pod',
            'history',
            'blocked',
            'empty',
            'loading',
            'error',
            'unauthorized',
          ]) {
            checkpoint = [phase, locale, theme, view].join(':');
            await page.goto(
              origin +
                '/?phase=' +
                phase +
                '&locale=' +
                locale +
                '&theme=' +
                theme +
                '&view=' +
                view,
            );
            await page.waitForFunction(
              () => document.documentElement.dataset.driverRender === 'ready',
            );
            if (phase === 'before' && ['loading', 'error'].includes(view))
              await expect(page.getByRole(view === 'loading' ? 'status' : 'alert')).toBeVisible();
            else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
            expect(errors).toEqual([]);
            if (view === 'dashboard')
              await expect(page.locator('.driver-trip-card')).toHaveCount(1);
            if (view === 'empty') await expect(page.locator('.driver-trip-card')).toHaveCount(0);
            if (view === 'blocked')
              await expect(page.locator('.driver-command > .button--primary')).toBeDisabled();
            if (view === 'pod') await expect(page.locator('#pod-recipient')).toBeEnabled();
            if (view === 'history') {
              await expect(page.locator('.driver-command,.driver-pod')).toHaveCount(0);
              await expect(page.locator('body')).not.toContainText('TEST Cairo pickup');
              await expect(page.locator('body')).not.toContainText('Synthetic instructions');
            }

            if (view === 'issue') await page.locator('summary').click();
            for (const width of ['dashboard', 'detail'].includes(view)
              ? [360, 390, 768, 1280, 1440]
              : [theme === 'dark' ? 390 : 1440]) {
              checkpoint = [phase, locale, theme, view, width].join(':');
              await page.setViewportSize({ width, height: 900 });
              await page.evaluate(() => document.fonts.ready);
              if (phase === 'after') {
                await expect(page.locator('.driver-workspace')).toHaveAttribute(
                  'dir',
                  locale === 'ar' ? 'rtl' : 'ltr',
                );
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                const a = await new AxeBuilder({ page })
                  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                  .analyze();
                evidence.accessibility.push({
                  locale,
                  theme,
                  view,
                  width,
                  violations: a.violations.map((v) => ({
                    id: v.id,
                    targets: v.nodes.map((n) => n.target),
                    contrast: v.nodes.flatMap((n) =>
                      n.any
                        .filter((c) => c.id === 'color-contrast')
                        .map((c) => ({
                          fgColor: c.data?.fgColor,
                          bgColor: c.data?.bgColor,
                          contrastRatio: c.data?.contrastRatio,
                        })),
                    ),
                  })),
                });
                if (a.violations.length) {
                  evidence.styles = await page.evaluate(() =>
                    [
                      '.driver-workspace',
                      '.dx-top',
                      '#driver-content',
                      '.driver-shell',
                      '.driver-nav a',
                      '.theme-control select',
                    ].map((selector) => {
                      const el = document.querySelector(selector),
                        style = getComputedStyle(el);
                      return {
                        selector,
                        color: style.color,
                        background: style.backgroundColor,
                        variables: [
                          '--background',
                          '--foreground',
                          '--card',
                          '--theme-background',
                          '--naql-color-background',
                        ].map((name) => ({ name, value: style.getPropertyValue(name) })),
                      };
                    }),
                  );
                  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true });
                }
                expect(a.violations).toEqual([]);
              }
              const file = [phase, locale, theme, view, width].join('-') + '.png';
              await page.screenshot({ path: resolve(output, file), fullPage: true });
              evidence.captures.push({
                phase,
                locale,
                theme,
                view,
                width,
                file,
                sha256: createHash('sha256')
                  .update(readFileSync(resolve(output, file)))
                  .digest('hex'),
              });
            }
          }
        }
      } finally {
        await context.close();
      }
    }
    await server.close();
    server = null;
  }
  evidence.pass = true;
} catch (error) {
  evidence.failure = { checkpoint, classification: error.name };
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(evidence, null, 2));
}
console.log(
  JSON.stringify({
    pass: evidence.pass,
    captures: evidence.captures.length,
    accessibility: evidence.accessibility.length,
    failure: evidence.failure,
  }),
);
