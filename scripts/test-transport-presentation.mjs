// Component/browser contract test. Controlled HTTP fixtures, not a substitute for RLS tests.
// Uses actual canonical components and scoped CSS. No Auth, database or cloud writes.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertBrowserPortFree } from './browser-server.mjs';

const output = resolve(process.env.NAQL365_TRANSPORT_OUTPUT || 'test-results/transport-components');
mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:3019';
const records = {
  syntheticHttpOnly: true,
  databaseWrites: false,
  journeys: [],
  captures: [],
  quoteStates: [],
  pass: false,
};
const router = `const router={push:(url)=>{window.__transportNavigation=url},refresh:()=>{}};export const useRouter=()=>router;`;
const link = `import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{...props,href},children)}`;
// Reuse the app's locally bundled approved font files; no external font download.
const fontCSS = readdirSync('.next/static/chunks')
  .filter((f) => f.endsWith('.css'))
  .flatMap((f) =>
    [
      ...readFileSync(resolve('.next/static/chunks', f), 'utf8').matchAll(
        /@font-face\{font-family:(?:Alexandria|Inter);[^}]+\}/g,
      ),
    ].map((m) => m[0]),
  )
  .join('')
  .replaceAll('../media/', '/__font/');
await assertBrowserPortFree(3019);
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: { exclude: ['next/link', 'next/navigation', 'next/image'] },
  server: { host: '127.0.0.1', port: 3019, strictPort: true },
  resolve: {
    alias: { '@': resolve('src'), 'server-only': resolve('tests/helpers/server-only.ts') },
  },
  plugins: [
    {
      name: 'transport-controlled-next-boundaries',
      enforce: 'pre',
      resolveId(id) {
        if (['next/link', 'next/navigation', 'next/image'].includes(id)) return '\0transport:' + id;
      },
      load(id) {
        if (id === '\0transport:next/link') return link;
        if (id === '\0transport:next/navigation') return router;
        if (id === '\0transport:next/image')
          return `import {createElement} from 'react';export default function Image(props){return createElement('img',props)}`;
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
            res.end(readFileSync(resolve('.next/static/media', req.url.slice('/__font/'.length))));
            return;
          }
          if (req.url?.startsWith('/?') || req.url === '/') {
            vite
              .transformIndexHtml(
                '/',
                '<!doctype html><html style="--font-arabic:Alexandria;--font-english:Inter;--font-body:Arial"><head><title>Transport component test</title><link rel="stylesheet" href="/__fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/transport-ui/entry.tsx"></script></body></html>',
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
let browser;
try {
  await server.listen();
  const { transportFixture, serviceId } = await server.ssrLoadModule(
    '/tests/transport-ui/fixture.ts',
  );
  const { customerDictionary } = await server.ssrLoadModule('/src/i18n/customer.ts');
  browser = await chromium.launch();
  for (const locale of ['ar', 'en'])
    for (const guest of [false, true]) {
      let fixture = transportFixture(),
        saves = 0,
        submissions = 0;
      const context = await browser.newContext({
        viewport: { width: guest ? 390 : 1440, height: 900 },
      });
      try {
        await context.route('**/*', async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname === '/__fixture') return route.fulfill({ json: fixture });
          if (url.pathname.startsWith('/api/')) {
            if (url.pathname === '/api/public/analytics') return route.fulfill({ status: 204 });
            const expected = `/api/${guest ? 'guest' : 'customer'}/requests/${fixture.request.id}`;
            expect(url.pathname).toBe(expected);
            if (request.method() === 'GET') return route.fulfill({ json: fixture });
            const command = request.postDataJSON();
            expect(command.revision).toBe(fixture.request.revision);
            expect(command.mutationId).toMatch(/^[a-f0-9-]{36}$/);
            if (command.operation === 'save') {
              fixture.payload = command.payload;
              saves++;
            } else if (command.operation === 'submit') {
              submissions++;
              fixture.request.status = 'SUBMITTED';
            } else throw Error('UNEXPECTED_COMPONENT_COMMAND');
            fixture.request.revision++;
            return route.fulfill({
              json: {
                ...fixture.request,
                reference: fixture.request.status === 'SUBMITTED' ? 'TEST-R' : null,
              },
            });
          }
          return request.method() === 'GET' ? route.continue() : route.abort();
        });
        const page = await context.newPage(),
          t = customerDictionary(locale);
        page.setDefaultTimeout(10000);
        const url = `${origin}/?locale=${locale}${guest ? '&guest' : ''}`;
        await page.goto(url);
        await page.locator('#service').selectOption(serviceId);
        await expect(page.locator('.save-status')).toHaveText(t.saved);
        expect(saves).toBe(1);
        await page.reload();
        await expect(page.locator('#service')).toHaveValue(serviceId);
        await page.locator('.wizard-progress button').nth(1).click();
        await expect(page.locator('h1')).toBeFocused();
        for (const kind of ['pickup', 'delivery']) {
          await page.locator(`#${kind}-city`).selectOption(fixture.cities[0].id);
          await page.locator(`#${kind}-address`).fill(`TEST ${kind}`);
        }
        await expect(page.locator('.save-status')).toHaveText(t.saved);
        await page.locator('.wizard-progress button').nth(7).click();
        await page.getByRole('button', { name: t.submit, exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        expect(submissions).toBe(0); // Required business fields cannot be bypassed by step navigation.
        await page.locator('.wizard-progress button').nth(2).click();
        await page.locator('#description').fill('TEST shipment');
        await page.getByRole('button', { name: t.addItem, exact: true }).click();
        await page.locator('#item-0').fill('TEST carton');
        await page.locator('.wizard-progress button').nth(5).click();
        await page.locator('#date').fill('2099-10-22');
        await page.locator('#time-window').selectOption('morning');
        await page.locator('.wizard-progress button').nth(6).click();
        await page.locator('#contact_name').fill('TEST Customer');
        await page.locator('#contact_phone').fill('+201000000001');
        await page.locator('.wizard-progress button').nth(7).click();
        await expect(page.locator('.request-summary')).toContainText('TEST carton');
        await page.getByRole('button', { name: t.submit, exact: true }).click();
        await expect
          .poll(() => page.evaluate(() => window.__transportNavigation))
          .toContain(`/${locale}/${guest ? 'guest' : 'account'}/requests/`);
        expect(submissions).toBe(1);
        records.journeys.push({
          locale,
          guest,
          autosave: saves > 0,
          refresh: true,
          validation: true,
          submitted: true,
          focus: true,
        });

        for (const view of ['wizard', 'summary', 'quote', 'tracking'])
          for (const theme of ['light', 'dark', 'system']) {
            // Start each visual state from a clean, controlled draft; no app database exists here.
            fixture = transportFixture();
            await page.goto(`${url}&view=${view}&theme=${theme}`);
            await expect(page.locator('h1')).toBeVisible();
            if (view === 'wizard') await expect(page.locator('#service')).toBeEnabled();
            await page.evaluate(() => document.fonts.ready);
            if (view === 'wizard')
              expect(
                await page
                  .locator('.wizard-progress')
                  .evaluate((el) => getComputedStyle(el).display),
              ).toBe('flex');
            for (const width of [360, 390, 768, 1280, 1440]) {
              await page.setViewportSize({ width, height: 900 });
              expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
              ).toBe(true);
            }
            const violations = (
              await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
            ).violations;
            expect(violations).toEqual([]);
            const file = `${view}-${locale}-${theme}-${guest ? 390 : 1440}.png`;
            await page.setViewportSize({ width: guest ? 390 : 1440, height: 900 });
            await page.screenshot({ path: resolve(output, file), fullPage: true });
            records.captures.push({ view, locale, theme, width: guest ? 390 : 1440, file });
          }
        for (const status of ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']) {
          await page.goto(`${url}&view=quote&status=${status}`);
          await expect(page.locator('.quote-response')).toHaveCount(
            ['SENT', 'VIEWED'].includes(status) ? 1 : 0,
          );
          records.quoteStates.push({
            locale,
            guest,
            status,
            actionable: ['SENT', 'VIEWED'].includes(status),
          });
        }
      } finally {
        await context.close();
      }
    }
  records.pass = true;
  console.log(
    'Transport component browser: 4 Guest/Customer AR/EN draft/autosave/validation/submit journeys PASS; 48 presentation captures; 20 quote-state checks.',
  );
} finally {
  await browser?.close();
  await server.close();
  writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(records, null, 2));
}
