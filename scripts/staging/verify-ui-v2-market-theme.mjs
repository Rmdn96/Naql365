// Public-only hosted verification. No Auth identities, business fixtures or account mutations.
import { chromium, expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { acceptanceTarget, protectionHeaders } from './target.mjs';

const expect = baseExpect.configure({ timeout: 20000 });
// The caller supplies a freshly issued same-project development OIDC token through an ignored file.
if (process.env.ACCEPTANCE_OIDC_ENV_FILE) {
  process.env.VERCEL_OIDC_TOKEN = parseEnv(
    readFileSync(process.env.ACCEPTANCE_OIDC_ENV_FILE, 'utf8'),
  ).VERCEL_OIDC_TOKEN;
}
const { origin } = acceptanceTarget();
if (origin !== 'https://naql365-staging-ui-v2-naql365.vercel.app')
  throw Error('CANONICAL_ORIGIN_REQUIRED');
const applicationSha = process.env.ACCEPTANCE_APPLICATION_SHA;
const deploymentSha = process.env.ACCEPTANCE_DEPLOYMENT_SHA;
if (![applicationSha, deploymentSha].every((value) => /^[a-f0-9]{40}$/.test(value ?? '')))
  throw Error('EXACT_IDENTITY_REQUIRED');
const headers = protectionHeaders();
const preflight = await fetch(origin + '/en/login', {
  headers,
  redirect: 'manual',
  signal: AbortSignal.timeout(20000),
});
if (preflight.status !== 200) throw Error('PROTECTED_PREFLIGHT_FAILED');
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (publicUrl !== 'https://zuvyfeflkzlciuaauxba.supabase.co')
  throw Error('STAGING_BACKEND_REQUIRED');
const client = createClient(publicUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const catalogue = await client.rpc('public_market_catalogue');
if (catalogue.error || !Array.isArray(catalogue.data)) throw Error('PUBLIC_CATALOGUE_FAILED');
for (const [country, currency] of [
  ['SA', 'SAR'],
  ['EG', 'EGP'],
]) {
  if (catalogue.data.find((market) => market.country === country)?.currency !== currency)
    throw Error('MARKET_CURRENCY_MISMATCH');
}

const output =
  process.env.UI_V2_THEME_RESUME_DIR || 'supabase/.temp/ui-v2-market-theme-' + Date.now();
if (!/^supabase\/\.temp\/ui-v2-market-theme-\d+$/.test(output)) throw Error('EVIDENCE_PATH_DENIED');
mkdirSync(output, { recursive: true });
const previous = process.env.UI_V2_THEME_RESUME_DIR
  ? JSON.parse(readFileSync(output + '/index.json', 'utf8'))
  : { applicationSha, deploymentSha, results: [], screenshots: [], markets: [] };
if (previous.applicationSha !== applicationSha || previous.deploymentSha !== deploymentSha)
  throw Error('EVIDENCE_IDENTITY_MISMATCH');
for (const screenshot of previous.screenshots) {
  if (
    !/^[a-z0-9-]+\.png$/.test(screenshot.filename) ||
    createHash('sha256')
      .update(readFileSync(output + '/' + screenshot.filename))
      .digest('hex') !== screenshot.sha256
  )
    throw Error('EVIDENCE_HASH_INVALID');
}
const { results, screenshots, markets } = previous;
const save = () =>
  writeFileSync(
    output + '/index.json',
    JSON.stringify({ applicationSha, deploymentSha, results, screenshots, markets }, null, 2),
  );
const browser = await chromium.launch();
let checkpoint = 'initial';
try {
  for (const locale of ['ar', 'en']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          ...(new URL(route.request().url()).origin === origin ? headers : {}),
        },
      }),
    );
    const page = await context.newPage();
    try {
      await page.goto(origin + '/' + locale);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
      for (const country of ['EG', 'SA']) {
        if (
          markets.some(
            (row) => row.locale === locale && row.country === country && row.result === 'PASS',
          )
        )
          continue;
        checkpoint = locale + ':market:' + country;
        const responsePromise = page.waitForResponse(
          (response) =>
            response.url() === origin + '/api/public/market' &&
            response.request().method() === 'POST',
        );
        await page.locator('#public-market').selectOption(country);
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        expect((await response.request().allHeaders()).origin).toBe(origin);
        const cookieHeader = (await response.allHeaders())['set-cookie'] ?? '';
        const cookieFlags = {
          secure: /;\s*Secure(?:;|$)/i.test(cookieHeader),
          httpOnly: /;\s*HttpOnly(?:;|$)/i.test(cookieHeader),
          sameSiteStrict: /;\s*SameSite=Strict(?:;|$)/i.test(cookieHeader),
          rootPath: /;\s*Path=\/(?:;|$)/i.test(cookieHeader),
        };
        expect(Object.values(cookieFlags).every(Boolean)).toBe(true);
        await expect(page.locator('#public-market')).toHaveValue(country);
        const coverage =
          country === 'SA'
            ? locale === 'ar'
              ? 'الرياض'
              : 'Riyadh'
            : locale === 'ar'
              ? 'القاهرة'
              : 'Cairo';
        await expect(page.locator('.coverage-note')).toContainText(coverage);
        await page.reload();
        await expect(page.locator('#public-market')).toHaveValue(country);
        await page.goto(origin + '/' + (locale === 'ar' ? 'en' : 'ar') + '/login');
        await expect(page.locator('#public-market')).toHaveValue(country);
        await page.goto(origin + '/' + locale);
        await expect(page.locator('#public-market')).toHaveValue(country);
        markets.push({
          locale,
          country,
          expectedOrigin: origin,
          status: response.status(),
          errorCategory: null,
          cookieFlags,
          coverage: true,
          persistence: true,
          currency: country === 'SA' ? 'SAR' : 'EGP',
          currencySource: 'public_market_catalogue',
          result: 'PASS',
        });
        save();
      }
      for (const mode of ['light', 'dark', 'system']) {
        checkpoint = locale + ':theme-selection:' + mode;
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect(page.locator('.desktop-header-nav .theme-control select')).toBeEnabled();
        await page
          .getByLabel(locale === 'ar' ? 'المظهر' : 'Theme', { exact: true })
          .filter({ visible: true })
          .selectOption(mode);
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        const server = await fetch(origin + '/' + locale, {
          headers: { ...headers, Cookie: 'naql365_theme=' + mode },
        });
        expect((await server.text()).includes('data-theme="' + mode + '"')).toBe(true);
        for (const path of ['', '/login', '/register', '/recover', '/password']) {
          if (
            [360, 390, 768, 1280, 1440].every((width) =>
              results.some(
                (row) =>
                  row.locale === locale &&
                  row.mode === mode &&
                  row.path === (path || '/home') &&
                  row.width === width &&
                  row.result === 'PASS',
              ),
            )
          )
            continue;
          await page.goto(origin + '/' + locale + path);
          // This public context has no account session. Password pages stream a trusted redirect.
          if (path === '/password') await expect(page).toHaveURL(origin + '/' + locale + '/login');
          await expect(page.locator('.desktop-header-nav .theme-control select')).toBeEnabled();
          await page.locator('main h1').first().waitFor();
          await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
          for (const width of [360, 390, 768, 1280, 1440]) {
            if (
              results.some(
                (row) =>
                  row.locale === locale &&
                  row.mode === mode &&
                  row.path === (path || '/home') &&
                  row.width === width &&
                  row.result === 'PASS',
              )
            )
              continue;
            checkpoint = [locale, mode, path || '/home', width].join(':');
            await page.setViewportSize({ width, height: 900 });
            if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
              throw Error('HOSTED_OVERFLOW');
            await expect(page.locator('html')).toHaveAttribute(
              'dir',
              locale === 'ar' ? 'rtl' : 'ltr',
            );
            const violations = (
              await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
            ).violations;
            if (violations.length)
              throw Error('AXE_' + violations.map((violation) => violation.id).join('_'));
            if (path === '' && [360, 1280].includes(width)) {
              const filename = [locale, mode, width, 'home'].join('-') + '.png';
              await page.screenshot({ path: output + '/' + filename, fullPage: true });
              screenshots.push({
                filename,
                sha256: createHash('sha256')
                  .update(readFileSync(output + '/' + filename))
                  .digest('hex'),
              });
            }
            results.push({
              locale,
              mode,
              path: path || '/home',
              presentation:
                path === '/password'
                  ? 'unauthenticated password-route redirect to login'
                  : 'public page',
              width,
              result: 'PASS',
              overflow: false,
              axeViolations: 0,
              timestamp: new Date().toISOString(),
            });
            save();
          }
        }
      }
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 22, 37)');
      await page.emulateMedia({ colorScheme: 'light' });
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 247, 250)');
    } catch (error) {
      const diagnostics = await page
        .evaluate(() => ({
          pathname: location.pathname,
          origin: location.origin,
          queryKeys: [...new URL(location.href).searchParams.keys()],
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          direction: document.documentElement.dir,
          theme: document.documentElement.dataset.theme,
        }))
        .catch(() => ({ unavailable: true }));
      writeFileSync(
        output + '/failure-' + Date.now() + '.json',
        JSON.stringify(
          {
            checkpoint,
            errorClass: error.name,
            assertion:
              error.message.match(
                /toHaveURL|toHaveAttribute|toBe\b|toEqual|Execution context was destroyed|frame was detached|Target closed|page\.evaluate|page\.goto/i,
              )?.[0] ?? 'other',
            category: /^HOSTED_|^AXE_/.test(error.message)
              ? error.message
              : /Timeout/i.test(error.message)
                ? 'TIMEOUT'
                : 'ASSERTION',
            diagnostics,
          },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  if (
    results.length !== 150 ||
    new Set(results.map((row) => [row.locale, row.mode, row.path, row.width].join(':'))).size !==
      150 ||
    markets.length !== 4
  )
    throw Error('MATRIX_INCOMPLETE');
  console.log(
    JSON.stringify({
      result: 'PASS',
      combinations: results.length,
      marketCases: markets.length,
      screenshots: screenshots.length,
      output,
      fixturesCreated: 0,
      systemPreference: 'PASS',
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      result: 'FAIL',
      checkpoint,
      category: /^AXE_|^MATRIX_|^HOSTED_/.test(error.message)
        ? error.message
        : /Timeout/i.test(error.message)
          ? 'TIMEOUT'
          : 'BROWSER_ASSERTION',
      output,
      completed: results.length,
    }),
  );
  process.exitCode = 1;
} finally {
  save();
  await browser.close();
}
