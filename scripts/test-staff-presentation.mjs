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
  baseline = process.env.NAQL365_STAFF_BASELINE
    ? resolve(process.env.NAQL365_STAFF_BASELINE)
    : null,
  output = resolve(process.env.NAQL365_STAFF_OUTPUT || 'test-results/staff-components');
if (
  baseline &&
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: baseline, encoding: 'utf8' }).trim() !==
    '3df7069445a2b84677c0d81e8dbc5005a3ba1fe5'
)
  throw Error('STAFF_BASELINE_MISMATCH');
mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:3021',
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
const fixture = `import{customerFixture}from'/tests/customer-ui/fixture.ts';const f=customerFixture('SENT',new URLSearchParams(location.search).get('view')==='empty');`;
const mocks = {
  'next/navigation': `const q=new URLSearchParams(location.search),l=q.get('locale')==='ar'?'ar':'en',v=q.get('view');export const usePathname=()=>'/'+l+'/portal'+(v==='quotes'?'/quotes':v==='catalog'||v==='form'?'/store/catalog':v==='orders'?'/store/orders':'');export const useRouter=()=>({refresh(){},push(){}});export const notFound=()=>{throw Error('UNEXPECTED_NOT_FOUND')};export const redirect=()=>{throw Error('UNEXPECTED_REDIRECT')};`,
  'next/link': `import{createElement}from'react';export default function Link({href,children,prefetch,replace,scroll,...props}){return createElement('a',{...props,href},children)}`,
  'next/image': `import{createElement}from'react';export default function Image({priority,preload,fill,...props}){return createElement('img',props)}`,
  'server-only': '',
  '@/infrastructure/markets/public': `export const selectedPublicCountry=async()=>'EG';`,
  '@/infrastructure/identity/staff-context': `export const staffModules=async()=>({context:{status:'authorized'},sales:true,operations:false,finance:false,support:false});`,
  '@/infrastructure/pricing/service':
    fixture +
    `export const salesQueue=async()=>f.requests.map(r=>({...r,contact_name:'TEST Customer',quotes:[{quote_versions:[f.quote]}]}));`,
  '@/infrastructure/operations/service': `export const operationsWorkspace=async()=>null;`,
  '@/infrastructure/store/access': `export const storeStaffModules=async()=>({orders:true,catalog:true});`,
  '@/infrastructure/store/service':
    fixture +
    `export const storeRead=async()=>f.storeOrders;export const storeShop=async()=>({status:'PAUSED',items:[],nextCursor:null});export const storeCategories=async()=>[];`,
  '@/infrastructure/store/catalog': `import{z}from'zod';export const catalogKind=z.enum(['products','categories','listings','prices','references','offers','suppliers','agreements','policies']);export const storeCatalogAdmin=async()=>({manage:true,publish:false,sourcing:false,policies:false,page:{items:[{id:'10000000-0000-4000-8000-000000000001',sku:'TEST-BOX',revision:1,state:'DRAFT',content:{title_ar:'صندوق اختباري',title_en:'TEST box',description_ar:'مسودة اصطناعية',description_en:'Synthetic draft',specifications:[]}}],nextCursor:null}});`,
};
let browser,
  server,
  checkpoint = 'startup';
const evidence = {
  syntheticComponentsOnly: true,
  databaseWrites: false,
  captures: [],
  keyboard: [],
  accessibility: [],
  pass: false,
};
try {
  browser = await chromium.launch();
  const resume = process.env.NAQL365_STAFF_RESUME === 'after';
  if (resume) {
    const previous = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'));
    evidence.captures = previous.captures.filter((c) => c.phase === 'before');
    if (
      evidence.captures.length !== 104 ||
      evidence.captures.some(
        (c) =>
          !/^[a-z0-9-]+\.png$/.test(c.file) ||
          createHash('sha256')
            .update(readFileSync(resolve(output, c.file)))
            .digest('hex') !== c.sha256,
      )
    )
      throw Error('STAFF_BASELINE_CAPTURE_MISMATCH');
  }
  for (const phase of resume || !baseline ? ['after'] : ['before', 'after']) {
    const application = phase === 'before' ? baseline : root;
    await assertBrowserPortFree(3021);
    server = await createServer({
      configFile: false,
      root,
      envPrefix: [],
      cacheDir: resolve('node_modules/.vite/staff-' + phase),
      logLevel: 'error',
      optimizeDeps: { exclude: ['next/link', 'next/navigation', 'next/image'] },
      server: {
        host: '127.0.0.1',
        port: 3021,
        strictPort: true,
        fs: { allow: [root, application] },
      },
      resolve: { alias: { '@': resolve(application, 'src') }, dedupe: ['react', 'react-dom'] },
      plugins: [
        {
          name: 'explicit-staff-visual-boundaries',
          enforce: 'pre',
          resolveId(id) {
            const prefix = resolve(application, 'src').replaceAll('\\', '/') + '/',
              normalized = id.replaceAll('\\', '/'),
              key = normalized.startsWith(prefix) ? '@/' + normalized.slice(prefix.length) : id;
            if (Object.hasOwn(mocks, key)) return '\0staff:' + key;
            if (key === '@/components/staff/presentation') {
              return resolve(root, 'src/components/staff/presentation.tsx');
            }
          },
          load(id) {
            if (id.startsWith('\0staff:')) return mocks[id.slice(7)];
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
                    '<!doctype html><html style="--font-arabic:Alexandria;--font-english:Inter"><head><title>Staff synthetic visual verification</title><link rel="stylesheet" href="/__fonts.css"></head><body><div id="root"></div><script type="module" src="/tests/staff-ui/entry.tsx"></script></body></html>',
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
        const page = await context.newPage(),
          errors = [];
        page.on('pageerror', (e) => errors.push(e.name));
        for (const theme of ['dark', 'light', 'system']) {
          await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' });
          for (const view of [
            'dashboard',
            'quotes',
            'catalog',
            'form',
            'orders',
            'empty',
            'loading',
            'error',
            'unauthorized',
          ]) {
            checkpoint = [phase, locale, theme, view].join(':');
            await page.goto(
              `${origin}/?phase=${phase}&locale=${locale}&theme=${theme}&view=${view}`,
            );
            await page.waitForFunction(
              () => document.documentElement.dataset.staffRender === 'ready',
            );
            if (view === 'loading')
              await expect(
                page.locator('.staff-workspace-content [role="status"]').first(),
              ).toBeVisible();
            else
              await expect(
                page.locator(view === 'unauthorized' ? 'h1' : '.staff-app h1').first(),
              ).toBeVisible();
            expect(errors).toEqual([]);
            if (view === 'form')
              await page
                .locator('summary')
                .filter({ hasText: locale === 'ar' ? 'إضافة مسودة' : 'Create draft' })
                .first()
                .click();
            for (const width of view === 'dashboard' || view === 'catalog'
              ? [360, 390, 768, 1280, 1440]
              : [theme === 'dark' ? 390 : 1440]) {
              checkpoint = [phase, locale, theme, view, width].join(':');
              await page.setViewportSize({ width, height: 900 });
              await page.evaluate(() => document.fonts.ready);
              if (phase === 'after') {
                await expect(
                  page.locator(view === 'unauthorized' ? '.staff-access' : '.staff-app'),
                ).toHaveAttribute('lang', locale);
                await expect(
                  page.locator(view === 'unauthorized' ? '.staff-access' : '.staff-app'),
                ).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
                expect(
                  await page
                    .locator(view === 'unauthorized' ? '.staff-access' : '.staff-app')
                    .evaluate((el) => getComputedStyle(el).fontFamily),
                ).toContain(locale === 'ar' ? 'Alexandria' : 'Inter');
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                const violations = (
                  await new AxeBuilder({ page })
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                    .analyze()
                ).violations;
                evidence.accessibility.push({
                  locale,
                  theme,
                  view,
                  width,
                  violations: violations.map((v) => v.id),
                });
                if (violations.length)
                  writeFileSync(
                    resolve(output, 'axe-failure.json'),
                    JSON.stringify(
                      {
                        checkpoint,
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
              writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(evidence, null, 2));
            }
          }
        }
        {
          await page.setViewportSize({ width: 390, height: 900 });
          await page.goto(`${origin}/?locale=${locale}&view=dashboard&theme=light`);
          const trigger = page.locator('.staff-drawer-trigger');
          await trigger.click();
          await expect(page.getByRole('dialog')).toBeVisible();
          const drawerFile = `${phase}-${locale}-light-drawer-390.png`;
          await page.screenshot({ path: resolve(output, drawerFile), fullPage: true });
          evidence.captures.push({
            phase,
            locale,
            theme: 'light',
            view: 'drawer',
            width: 390,
            file: drawerFile,
            sha256: createHash('sha256')
              .update(readFileSync(resolve(output, drawerFile)))
              .digest('hex'),
          });
          await page.keyboard.press('Escape');
          await expect(trigger).toBeFocused();
          expect(await trigger.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe(
            'none',
          );
          evidence.keyboard.push({ locale, mobileDrawerFocusRestore: true, visibleFocus: true });
          await page
            .getByRole('combobox', { name: locale === 'ar' ? 'المظهر' : 'Theme', exact: true })
            .selectOption('system');
          await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
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
    keyboard: evidence.keyboard.length,
    failure: evidence.failure,
  }),
);
