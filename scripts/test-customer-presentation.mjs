// Component-only before/after visual verification. No real Auth or database access.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertBrowserPortFree } from './browser-server.mjs';

const root = process.cwd(),
  output = resolve(process.env.NAQL365_CUSTOMER_OUTPUT || 'test-results/customer-components'),
  baseline = process.env.NAQL365_CUSTOMER_BASELINE;
mkdirSync(output, { recursive: true });
if (
  baseline &&
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: resolve(baseline),
    encoding: 'utf8',
  }).trim() !== 'fd87bc8dffdfbddeca2c03251e8a13e4e3160158'
)
  throw Error('CUSTOMER_BASELINE_MISMATCH');
const origin = 'http://127.0.0.1:3019',
  evidence = {
    syntheticComponentsOnly: true,
    databaseWrites: false,
    captures: [],
    quoteStates: [],
    profileChecks: [],
    pass: false,
  };
const resume = process.env.NAQL365_CUSTOMER_RESUME === 'after';
if (resume) {
  const previous = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));
  evidence.captures = previous.captures.filter((c) => c.phase === 'before');
  if (
    evidence.captures.length !== 78 ||
    evidence.captures.some(
      (c) =>
        !/^[a-z0-9-]+\.png$/.test(c.file) ||
        createHash('sha256')
          .update(readFileSync(resolve(output, c.file)))
          .digest('hex') !== c.sha256,
    )
  )
    throw Error('BASELINE_CAPTURE_INTEGRITY_FAILED');
}
const fontRoot = resolve('.next/static'),
  fontCSS = readdirSync(resolve(fontRoot, 'chunks'))
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
const fixture = `import{customerFixture}from'/tests/customer-ui/fixture.ts';const q=new URLSearchParams(location.search);const f=customerFixture(q.get('status')||'SENT',q.get('state')==='empty');`;
const mocks = {
  'next/navigation': `const q=new URLSearchParams(location.search),l=q.get('locale')==='ar'?'ar':'en',v=q.get('view');const path='/'+l+(v==='store-history'?'/store/orders':v==='store-detail'?'/store/orders/10000000-0000-4000-8000-000000000001':v==='requests'?'/account/requests':v==='quotes'||v==='quote'?'/account/quotes':v==='detail'?'/account/requests/10000000-0000-4000-8000-000000000001':v==='tracking'?'/account/orders/10000000-0000-4000-8000-000000000001':'/account');export const usePathname=()=>path;export const useRouter=()=>({push:url=>{window.__customerNavigation=url},refresh(){}});export const redirect=()=>{throw Error('UNEXPECTED_COMPONENT_REDIRECT')};export const notFound=()=>{throw Error('UNEXPECTED_COMPONENT_NOT_FOUND')};`,
  'next/link': `import{createElement}from'react';export default function Link({href,children,prefetch,replace,scroll,...props}){return createElement('a',{...props,href},children)}`,
  'next/image': `import{createElement}from'react';export default function Image({priority,preload,fill,...props}){return createElement('img',props)}`,
  'server-only': '',
  '@/infrastructure/config/public-env': `export const getPublicEnv=()=>({configured:true});`,
  '@/infrastructure/supabase/server': `export const createSupabaseServerClient=async()=>({auth:{getUser:async()=>({data:{user:{id:'10000000-0000-4000-8000-000000000001'}},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{display_name:'TEST Customer',phone:'+201000000000',locale:'en'},error:null})})})}),rpc:async()=>({data:new URLSearchParams(location.search).get('state')==='onboarding'?'new':'active',error:null})});`,
  '@/infrastructure/requests/list': fixture + `export const customerRequests=async()=>f.requests;`,
  '@/infrastructure/requests/page-access': fixture + `export const detailsPage=async()=>f.detail;`,
  '@/infrastructure/pricing/service':
    fixture +
    `export const customerQuotes=async()=>f.quotes;export const customerQuoteDetails=async()=>f.quote;`,
  '@/infrastructure/markets/service':
    fixture + `export const availableMarkets=async()=>[f.detail.market];`,
  '@/infrastructure/markets/public': `export const selectedPublicCountry=async()=>'EG';export const publicCatalogue=async()=>[];`,
  '@/infrastructure/operations/service':
    fixture + `export const customerProgress=async()=>f.progress;`,
  '@/infrastructure/payments/service': fixture + `export const getPayment=async()=>f.payment;`,
  '@/infrastructure/store/service':
    fixture +
    `export const storeRead=async kind=>kind==='order'?f.order:f.storeOrders;export const storeShop=async()=>({status:'PAUSED',items:[],nextCursor:null});export const storeCategories=async()=>[];`,
  '@/infrastructure/store/access': `export const storeStaffModules=async()=>({});`,
  '@/infrastructure/identity/access': `export const portalAccess=async()=>({status:'unconfigured'});`,
  '@/infrastructure/config/launch': `export const launchFlags=()=>({customerLiveTracking:false});`,
  '@/infrastructure/store/catalog-trace': `export const catalogTrace=()=>{};`,
  '@/infrastructure/supabase/browser': `export const createSupabaseBrowserClient=()=>({auth:{getUser:async()=>({data:{user:null}})}});`,
  '@/app/auth/customer-actions': `export const customerLogout=async()=>{};export const customerAuth=async()=>({status:'error',code:'unavailable'});export async function customerProfile(locale,previous,form){return fetch('/__profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))}).then(r=>r.json())}`,
};
let browser,
  server,
  pageErrors = [],
  checkpoint = 'startup';
try {
  browser = await chromium.launch();
  for (const phase of baseline && !resume ? ['before', 'after'] : ['after']) {
    const application = phase === 'before' ? resolve(baseline) : root;
    await assertBrowserPortFree(3019);
    server = await createServer({
      configFile: false,
      root,
      envPrefix: [],
      cacheDir: resolve('node_modules/.vite/customer-' + phase),
      logLevel: 'error',
      optimizeDeps: { exclude: ['next/link', 'next/navigation', 'next/image'] },
      server: {
        host: '127.0.0.1',
        port: 3019,
        strictPort: true,
        fs: { allow: [root, application] },
      },
      resolve: { alias: { '@': resolve(application, 'src') }, dedupe: ['react', 'react-dom'] },
      plugins: [
        {
          name: 'explicit-customer-component-boundaries',
          enforce: 'pre',
          resolveId(id) {
            const prefix = resolve(application, 'src').replaceAll('\\', '/') + '/';
            const normalized = id.replaceAll('\\', '/');
            const key = normalized.startsWith(prefix) ? '@/' + normalized.slice(prefix.length) : id;
            if (Object.hasOwn(mocks, key)) return '\0customer:' + key;
            if (
              key.startsWith('@/components/customer/') ||
              key === '@/styles/customer-workspace.css'
            ) {
              const mapped = resolve(root, 'src', key.slice(2));
              return [mapped, mapped + '.tsx', mapped + '.ts'].find(existsSync);
            }
          },
          load(id) {
            if (id.startsWith('\0customer:')) return mocks[id.slice('\0customer:'.length)];
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
                res.end(readFileSync(resolve(fontRoot, 'media', req.url.slice('/__font/'.length))));
                return;
              }
              if (req.url === '/' || req.url?.startsWith('/?')) {
                vite
                  .transformIndexHtml(
                    '/',
                    '<!doctype html><html style="--font-arabic:Alexandria;--font-english:Inter;--font-body:Arial"><head><title>Customer component verification</title><link rel="stylesheet" href="/__fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/customer-ui/entry.tsx"></script></body></html>',
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
        await context.route('**/*', async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname === '/api/public/analytics') return route.fulfill({ status: 204 });
          if (url.pathname === '/api/store')
            return route.fulfill({
              json: {
                revision: 0,
                checkedOutOrderId: null,
                items: [],
                contracts: [],
                destinations: [],
              },
            });
          if (url.pathname === '/api/notifications') return route.fulfill({ json: [] });
          if (url.pathname === '/__profile')
            return route.fulfill({
              json: { status: 'error', code: 'validation', fields: ['phone'] },
            });
          if (url.pathname.startsWith('/api/'))
            return route.fulfill({ status: 403, json: { error: 'forbidden' } });
          return route.continue();
        });
        const page = await context.newPage();
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        const errors = [];
        page.on('pageerror', (e) => {
          const exported = e.message.match(
            /does not provide an export named ['"]([a-zA-Z0-9_]+)['"]/,
          );
          const missing = e.message.match(/([a-zA-Z0-9_$]+) is not defined/);
          const hook = e.message.match(/reading ['"]([a-zA-Z0-9_]+)['"]/);
          const event = {
            type: e.name,
            classification: exported
              ? 'MISSING_EXPORT'
              : missing
                ? 'MISSING_GLOBAL'
                : hook
                  ? 'NULL_PROPERTY'
                  : 'OTHER',
            symbol: exported?.[1] || missing?.[1] || hook?.[1] || null,
          };
          errors.push(event);
          pageErrors.push(event);
          console.error('CUSTOMER_COMPONENT_RUNTIME ' + JSON.stringify(event));
        });
        for (const theme of ['light', 'dark', 'system']) {
          await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' });
          for (const view of [
            'dashboard',
            'profile',
            'requests',
            'detail',
            'quotes',
            'quote',
            'tracking',
            'store-history',
            'store-detail',
          ]) {
            checkpoint = [phase, locale, theme, view].join(':');
            await page.goto(
              `${origin}/?phase=${phase}&locale=${locale}&theme=${theme}&view=${view}`,
            );
            await page.waitForFunction(
              () => document.documentElement.dataset.customerRender === 'ready',
            );
            const heading = view.startsWith('store-')
              ? page
                  .locator('.store-experience .cm-section-heading')
                  .getByRole('heading', { level: 2 })
              : page.locator(phase === 'before' ? 'h1,h2' : 'h1').first();
            await expect(heading).toBeVisible();
            expect(errors).toEqual([]);
            if (view === 'profile') await page.locator('.profile-settings summary').click();
            for (const width of view === 'dashboard'
              ? [360, 390, 768, 1280, 1440]
              : [theme === 'dark' ? 390 : 1440]) {
              await page.setViewportSize({ width, height: 900 });
              await page.evaluate(() => document.fonts.ready);
              if (phase === 'after') {
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                const violations = (
                  await new AxeBuilder({ page })
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                    .analyze()
                ).violations;
                if (violations.length)
                  writeFileSync(
                    resolve(output, 'axe-failure.json'),
                    JSON.stringify(
                      {
                        checkpoint,
                        width,
                        violations: violations.map((v) => ({
                          id: v.id,
                          nodes: v.nodes.map((n) => ({
                            target: n.target,
                            checks: n.any.map((c) => ({ id: c.id, data: c.data })),
                          })),
                        })),
                      },
                      null,
                      2,
                    ),
                  );
                expect(violations).toEqual([]);
                expect(await page.locator('body').innerText()).not.toMatch(
                  /supplierEntitlementMinor|supplier_cost|PRIVATE-SUPPLIER/,
                );
              }
              const file = `${phase}-${locale}-${theme}-${view}-${width}.png`;
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
        if (phase === 'after') {
          for (const status of ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']) {
            checkpoint = 'quote-status:' + locale + ':' + status;
            await page.goto(
              `${origin}/?phase=after&locale=${locale}&theme=light&view=quote&status=${status}`,
            );
            await expect(page.locator('h1')).toBeVisible();
            await expect(page.locator('.quote-response')).toHaveCount(
              ['SENT', 'VIEWED'].includes(status) ? 1 : 0,
            );
            evidence.quoteStates.push({ locale, status, pass: true });
          }
          await page.goto(`${origin}/?phase=after&locale=${locale}&theme=light&view=profile`);
          await page.locator('.profile-settings summary').click();
          await page.locator('input[name=phone]').fill('invalid-test');
          await page.locator('.profile-form button').click();
          await expect(page.locator('input[name=phone]')).toHaveAttribute('aria-invalid', 'true');
          evidence.profileChecks.push({ locale, validationFeedback: true });
          await page.goto(
            `${origin}/?phase=after&locale=${locale}&theme=light&view=dashboard&state=empty`,
          );
          await expect(page.locator('.cm-records article')).toHaveCount(0);
          await expect(page.locator('.cx-next')).toHaveCount(0);
        }
        await context.tracing.stop();
      } catch (error) {
        await context
          .pages()[0]
          ?.screenshot({
            path: resolve(output, phase + '-' + locale + '-failure.png'),
            fullPage: true,
          })
          .catch(() => {});
        await context.tracing
          .stop({ path: resolve(output, phase + '-' + locale + '-failure-trace.zip') })
          .catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }
    await server.close();
    server = null;
  }
  evidence.pass = true;
} catch (error) {
  evidence.failure = { checkpoint, classification: error.name, pageErrors };
  console.error('CUSTOMER_PRESENTATION_FAILURE ' + JSON.stringify(evidence.failure));
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
    quoteStates: evidence.quoteStates.length,
    profileChecks: evidence.profileChecks.length,
  }),
);
