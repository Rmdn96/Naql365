import { localSupabase } from './local-supabase.mjs';
// Local-only real Auth + restricted-role browser regression. No cloud credentials or bypass.
import { execFileSync } from 'node:child_process';
import { assertBrowserPortFree, startBrowserServer, stopBrowserServer } from './browser-server.mjs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { financeRow } from '../src/domain/payments/model.ts';
const local = localSupabase();
if (new URL(local.API_URL).hostname !== '127.0.0.1') throw Error('LOCAL_ONLY');
const externalServer = process.env.NAQL365_EXISTING_BROWSER_ORIGIN;
if (externalServer && externalServer !== 'http://127.0.0.1:3000')
  throw Error('Existing server must be the approved loopback origin');
const origin = externalServer || 'http://127.0.0.1:3013';
if (externalServer) {
  const settings = readFileSync('.env.local', 'utf8');
  const value = (name) =>
    settings
      .split(/\r?\n/)
      .find((line) => line.startsWith(name + '='))
      ?.slice(name.length + 1)
      .trim();
  if (
    value('NEXT_PUBLIC_SUPABASE_URL') !== local.API_URL ||
    value('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') !== local.PUBLISHABLE_KEY
  )
    throw Error('Existing server local backend binding mismatch');
  if ((await fetch(origin + '/api/store?kind=cart')).status !== 401)
    throw Error('Existing server anonymous auth check failed');
}
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: origin,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  STAGING_AUTH_SMOKE_ENABLED: 'false',
};
for (const key of [
  'VERCEL_ENV',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
])
  delete env[key];
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const org = randomUUID(),
  users = [],
  ledger = { org, users, cleanup: false };
const output = 'test-results/staff-local-' + Date.now();
mkdirSync(output, { recursive: true });
const save = () => writeFileSync(output + '/ledger.json', JSON.stringify(ledger, null, 2));
const sql = (input) =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_naql365',
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
const roles = [
  ['SUPER_ADMIN', ['quotes', 'operations', 'finance', 'finance/banks', 'support']],
  ['SALES', ['quotes']],
  ['OPERATIONS', ['operations']],
  ['DISPATCHER', ['operations']],
  ['FINANCE', ['finance']],
  ['CUSTOMER_SERVICE', ['support']],
];
let server, browser;
let checkpoint = 'build';
const evidence = [];
const financeFixtures = [];
try {
  if (!externalServer) {
    await assertBrowserPortFree(3013);
    // Build before creating any fixture. Child output is withheld, never raw provider logs.
    execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
      maxBuffer: 16 * 1024 * 1024,
    });
    server = await startBrowserServer(env, 3013);
  }
  sql(
    `insert into public.organizations(id,name) values('${org}','Synthetic staff workspace'); insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values('${org}','SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966'),('${org}','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');`,
  );
  save();
  const customerUser = await admin.auth.admin.createUser({
    email: 'finance-customer-' + randomUUID() + '@example.invalid',
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
  });
  if (customerUser.error || !customerUser.data.user) throw Error('LOCAL_CUSTOMER_FIXTURE_FAILED');
  users.push(customerUser.data.user.id);
  save();
  const customerId = randomUUID();
  sql(
    `insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${customerUser.data.user.id}','customer');insert into public.customers(id,organization_id,profile_id) values('${customerId}','${org}','${customerUser.data.user.id}');`,
  );
  for (const country of ['SA', 'EG']) {
    const request = randomUUID(),
      quote = randomUUID(),
      version = randomUUID(),
      order = randomUUID();
    const market = sql(
        `select id from public.markets where organization_id='${org}' and country_code='${country}'`,
      ),
      currency = country === 'SA' ? 'SAR' : 'EGP';
    const reference = 'O-N365-202610-' + (country === 'SA' ? '980001' : '980002');
    sql(`begin;
    insert into public.requests(id,organization_id,customer_id,market_id,contact_name) values('${request}','${org}','${customerId}','${market}','SYNTHETIC FINANCE ${country}');
    insert into public.quotes(id,organization_id,request_id) values('${quote}','${org}','${request}');
    insert into public.quote_versions(id,organization_id,quote_id,version,status,sent_at,expires_at,distance_km,distance_source,distance_verified_at,currency) values('${version}','${org}','${quote}',1,'ACCEPTED',now(),now()+interval '2 days',10,'MANUAL_VERIFIED',now(),'${currency}');
    insert into public.orders(id,organization_id,quote_id,accepted_quote_version_id,idempotency_key,reference,request_id,customer_id,distance_km,distance_source,accepted_at,currency) values('${order}','${org}','${quote}','${version}','${order}','${reference}','${request}','${customerId}',10,'MANUAL_VERIFIED',now(),'${currency}');
    insert into public.payments(organization_id,order_id,market_id,customer_id,currency,amount_minor,method,status,revision) values('${org}','${order}','${market}','${customerId}','${currency}',0,'CASH','CASH_DUE',1);
    commit;`);
    financeFixtures.push({ country, order, reference });
  }
  browser = await chromium.launch();
  for (const [role, allowed] of roles) {
    const password = randomBytes(24).toString('base64url'),
      email = `staff-${randomUUID()}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw Error('LOCAL_FIXTURE_IDENTITY_FAILED');
    const id = created.data.user.id;
    users.push(id);
    save();
    sql(
      `insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${id}','staff'); insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${id}',id from public.roles where code='${role}';`,
    );
    for (const locale of ['ar', 'en']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
        page = await context.newPage();
      try {
        await page.goto(origin + '/' + locale + '/login');
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(password);
        checkpoint = role + ' ' + locale + ' submit';
        const submitted = page.waitForResponse(
          (response) =>
            response.url() === origin + '/' + locale + '/login' &&
            response.request().method() === 'POST',
        );
        const landing = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/' + locale + '/portal' &&
            response.request().headers()['rsc'] === '1',
        );
        await page.locator('.auth-form button:not([type=button])').click();
        const signedIn = await submitted;
        if (signedIn.status() !== 200 && signedIn.status() !== 303)
          throw Error('LOCAL_LOGIN_HTTP_FAILURE');
        await landing;
        await page.waitForURL(new RegExp('/' + locale + '/portal$'));
        await page.waitForFunction(() => {
          const node = document.querySelector('#staff-market');
          if (!node) return false;
          const key = Object.keys(node).find((k) => k.startsWith('__reactProps'));
          return !!key && typeof Reflect.get(node, key)?.onChange === 'function';
        });
        console.log('STAFF_READY ' + role + ' ' + locale);
        checkpoint = role + ' ' + locale + ' destination';
        await expect(page).toHaveURL(new RegExp('/' + locale + '/portal$'), { timeout: 20000 });
        await expect(page.locator('.staff-app')).toBeVisible();
        checkpoint = role + ' ' + locale + ' refresh';
        await page.reload();
        await expect(page.locator('.staff-app')).toBeVisible();
        checkpoint = role + ' ' + locale + ' direct login';
        await page.goto(origin + '/' + locale + '/login');
        await page.waitForURL(new RegExp('/' + locale + '/portal$'));
        await expect(page).toHaveURL(new RegExp('/' + locale + '/portal$'));
        checkpoint = role + ' ' + locale + ' workspaceModule visibility';
        const nav = page.locator('.staff-sidebar nav');
        for (const country of ['EG', 'SA']) {
          checkpoint = role + ' ' + locale + ' Market navigation ' + country;
          // Wait for the real controlled input handler, not just server-rendered HTML.
          await page.waitForFunction(() => {
            const node = document.querySelector('#staff-market');
            if (!node) return false;
            const props = Object.keys(node).find((k) => k.startsWith('__reactProps'));
            return props && typeof Reflect.get(node, props)?.onChange === 'function';
          });
          const changed = page.waitForResponse(
            (r) => r.url().endsWith('/api/public/market') && r.request().method() === 'POST',
          );
          const refreshedMarket = page.waitForResponse(
            (r) =>
              new URL(r.url()).pathname === new URL(page.url()).pathname &&
              r.request().headers()['rsc'] === '1',
          );
          await page.locator('#staff-market').selectOption(country);
          const marketResponse = await changed.catch(() => {
            throw Error('LOCAL_MARKET_REQUEST_TIMEOUT');
          });
          if (marketResponse.status() !== 200) throw Error('LOCAL_MARKET_HTTP_FAILURE');
          if ((await refreshedMarket).status() !== 200) throw Error('LOCAL_MARKET_REFRESH_FAILED');
          console.log('STAFF_MARKET_RESPONSE ' + role + ' ' + locale + ' ' + country);
          await expect(page.locator('#staff-market')).toHaveValue(country);
          await expect(page.locator('.staff-organization-context')).toContainText(
            country === 'SA'
              ? locale === 'ar'
                ? 'السعودية'
                : 'Saudi Arabia'
              : locale === 'ar'
                ? 'مصر'
                : 'Egypt',
          );
          await page.reload();
          await page.waitForFunction(() => {
            const node = document.querySelector('#staff-market');
            const key = node && Object.keys(node).find((k) => k.startsWith('__reactProps'));
            return !!key && typeof Reflect.get(node, key)?.onChange === 'function';
          });
          await expect(page.locator('#staff-market')).toHaveValue(country);
          const other = locale === 'ar' ? 'en' : 'ar';
          await page.goto(origin + '/' + other + '/portal');
          await page.waitForFunction(() => {
            const node = document.querySelector('#staff-market');
            const key = node && Object.keys(node).find((k) => k.startsWith('__reactProps'));
            return !!key && typeof Reflect.get(node, key)?.onChange === 'function';
          });
          await expect(page.locator('#staff-market')).toHaveValue(country);
          await page.goto(origin + '/' + locale + '/portal');
          await expect(page.locator('.staff-organization-context')).toContainText(
            'Synthetic staff workspace',
          );
        }
        for (const workspaceModule of [
          'quotes',
          'operations',
          'finance',
          'finance/banks',
          'support',
        ]) {
          const entry = nav.locator(`a[href="/${locale}/portal/${workspaceModule}"]`);
          if (allowed.includes(workspaceModule)) await expect(entry).toHaveCount(1);
          else await expect(entry).toHaveCount(0);
        }
        for (const width of [360, 390, 768, 1280, 1440]) {
          checkpoint = role + ' ' + locale + ' responsive ' + width;
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await expect(page.locator('html')).toHaveAttribute(
            'dir',
            locale === 'ar' ? 'rtl' : 'ltr',
          );
          if (width < 1024) {
            const trigger = page.locator('.staff-drawer-trigger');
            await trigger.click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(trigger).toBeFocused();
          }
          if (width === 360)
            expect(
              (
                await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
              ).violations.map((v) => v.id),
            ).toEqual([]);
          const filename = `${role.toLowerCase()}-${locale}-${width}-empty-dashboard.png`;
          await page.screenshot({ path: output + '/' + filename, fullPage: true });
          evidence.push({
            role,
            locale,
            width,
            state: 'empty-dashboard',
            result: 'PASS',
            filename,
            sha256: createHash('sha256')
              .update(readFileSync(output + '/' + filename))
              .digest('hex'),
          });
          writeFileSync(output + '/index.json', JSON.stringify(evidence, null, 2));
        }
        for (const workspaceModule of allowed) {
          checkpoint = role + ' ' + locale + ' route ' + workspaceModule;
          console.log('STAFF_ROUTE ' + role + ' ' + locale + ' ' + workspaceModule);
          await page.goto(origin + '/' + locale + '/portal/' + workspaceModule);
          await expect(page.locator('.staff-app')).toBeVisible();
          await expect(page.locator('.staff-workspace-content h1')).toBeVisible();
          if (workspaceModule === 'finance') {
            await expect(page.locator('.staff-workspace-content')).toContainText(
              locale === 'ar' ? 'العناصر المعروضة' : 'Displayed items',
            );
            await expect(page.locator('.staff-workspace-content')).toContainText(
              'SYNTHETIC FINANCE SA',
            );
            await expect(page.locator('.staff-workspace-content')).not.toContainText(
              'SYNTHETIC FINANCE EG',
            );
            await page.locator('#finance-status').selectOption('PAID');
            await page
              .getByRole('button', { name: locale === 'ar' ? 'تطبيق' : 'Apply', exact: true })
              .click();
            await page.waitForURL(
              (url) =>
                url.pathname === '/' + locale + '/portal/finance' &&
                url.searchParams.get('status') === 'PAID',
            );
            await expect(page.locator('.staff-workspace-content')).toContainText(
              locale === 'ar' ? 'لا توجد دفعات' : 'No payments match',
            );
            await page.locator('#finance-status').selectOption('CASH_DUE');
            await page
              .getByRole('button', { name: locale === 'ar' ? 'تطبيق' : 'Apply', exact: true })
              .click();
            await page.waitForURL(
              (url) =>
                url.pathname === '/' + locale + '/portal/finance' &&
                url.searchParams.get('status') === 'CASH_DUE',
            );
            const changed = page.waitForResponse(
              (r) => r.url().endsWith('/api/public/market') && r.request().method() === 'POST',
            );
            const refreshedFinance = page.waitForResponse(
              (r) =>
                new URL(r.url()).pathname === '/' + locale + '/portal/finance' &&
                r.request().headers()['rsc'] === '1',
            );
            await page.locator('#staff-market').selectOption('EG');
            expect((await changed).status()).toBe(200);
            if ((await refreshedFinance).status() !== 200)
              throw Error('LOCAL_FINANCE_REFRESH_FAILED');
            await expect(page.locator('.staff-organization-context')).toContainText(
              locale === 'ar' ? 'مصر' : 'Egypt',
            );
            await expect(page.locator('.staff-workspace-content')).toContainText(
              'SYNTHETIC FINANCE EG',
            );
            await expect(page.locator('.staff-workspace-content')).not.toContainText(
              'SYNTHETIC FINANCE SA',
            );
            await expect(page.locator('#finance-status')).toHaveValue('CASH_DUE');
            await page.reload();
            await expect(page.locator('.staff-workspace-content')).toContainText(
              'SYNTHETIC FINANCE EG',
            );
            const eg = financeFixtures.find((f) => f.country === 'EG'),
              sa = financeFixtures.find((f) => f.country === 'SA');
            await page.goto(origin + '/' + locale + '/portal/finance/' + sa.order);
            await expect(page.locator('#payment-reference')).toHaveCount(0);
            await page.goto(origin + '/' + locale + '/portal/finance/' + eg.order);
            await expect(page.locator('#payment-reference')).toBeVisible();
            await page.goto(origin + '/' + locale + '/portal/finance');
          }
        }
        for (const denied of ['quotes', 'operations', 'finance', 'finance/banks', 'support'].filter(
          (item) => !allowed.includes(item),
        )) {
          checkpoint = role + ' ' + locale + ' denied route ' + denied;
          await page.goto(origin + '/' + locale + '/portal/' + denied);
          if (denied === 'support') {
            await expect(page.locator('.staff-dashboard-panel[role="alert"]')).toBeVisible();
            await expect(page.locator('.staff-support-card')).toHaveCount(0);
          } else if (denied === 'finance/banks') {
            await expect(
              page.locator('meta[name="robots"][content*="noindex"]').first(),
            ).toBeAttached();
            await expect(page.locator('.staff-workspace-content')).toHaveCount(0);
            await expect(page.locator('input[name="iban"]')).toHaveCount(0);
          } else await expect(page).toHaveURL(new RegExp('/' + locale + '/portal$'));
        }
        await page.goto(origin + '/' + locale + '/portal');
        // Explicit logout uses the normal trusted application action.
        checkpoint = role + ' ' + locale + ' logout';
        await page.locator('.staff-topbar form button').click();
        await page.waitForURL(new RegExp('/' + locale + '/login'));
        await expect(page).toHaveURL(new RegExp('/' + locale + '/login'), { timeout: 20000 });
        await page.goto(origin + '/' + locale + '/portal');
        await page.waitForURL(new RegExp('/' + locale + '/login'));
        await expect(page).toHaveURL(new RegExp('/' + locale + '/login'));
        console.log(
          `PASS local ${role} ${locale}: normal login, refresh, direct login, granted modules, responsive drawer, axe, logout`,
        );
      } catch (error) {
        writeFileSync(
          output + '/assertion-boundary.json',
          JSON.stringify(
            {
              checkpoint,
              matcher:
                error?.matcherResult?.name ??
                (error instanceof Error && error.message.includes('toHaveURL')
                  ? 'toHaveURL'
                  : error instanceof Error && error.message.includes('toBeVisible')
                    ? 'toBeVisible'
                    : 'OTHER'),
              shellVisible: await page
                .locator('.staff-app')
                .isVisible()
                .catch(() => false),
              path: new URL(page.url()).pathname,
              source:
                error instanceof Error && error.message.includes('.staff-app')
                  ? 'staff-shell'
                  : error instanceof Error && error.message.includes('toHaveURL')
                    ? 'route'
                    : 'OTHER',
            },
            null,
            2,
          ),
        );
        {
          const direct = createClient(local.API_URL, local.PUBLISHABLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const signed = await direct.auth.signInWithPassword({ email, password });
          const market = sql(
            `select id from public.markets where organization_id='${org}' and country_code='SA'`,
          );
          const rpc = signed.error
            ? null
            : await direct.rpc('finance_market_queue', { p_org: org, p_market: market });
          const parsed = Array.isArray(rpc?.data?.items)
            ? financeRow.array().safeParse(rpc.data.items)
            : null;
          const permission = signed.error
            ? null
            : await direct.rpc('has_permission', {
                organization_id: org,
                permission_code: 'portal.access',
              });
          writeFileSync(
            output + '/finance-boundary.json',
            JSON.stringify(
              {
                checkpoint,
                auth: !signed.error,
                portalPermission: permission?.data === true,
                permissionCode:
                  permission?.error?.code && /^[A-Z0-9]{5}$/.test(permission.error.code)
                    ? permission.error.code
                    : permission?.error
                      ? 'OTHER'
                      : null,
                rpcCode:
                  rpc?.error && /^[A-Z0-9]{5}$/.test(rpc.error.code)
                    ? rpc.error.code
                    : rpc?.error
                      ? 'OTHER'
                      : null,
                items: Array.isArray(rpc?.data?.items) ? rpc.data.items.length : null,
                validated: parsed?.success ?? false,
                issues:
                  parsed && !parsed.success
                    ? parsed.error.issues.map((i) => ({
                        path: i.path.map((p) => (typeof p === 'number' ? 'item' : String(p))),
                        code: i.code,
                      }))
                    : [],
                pageError: await page.locator('.staff-dashboard-panel[role=alert]').count(),
                staffShells: await page.locator('.staff-app').count(),
                routeAlerts: await page.getByRole('alert').count(),
                market: await page
                  .locator('#staff-market')
                  .inputValue()
                  .catch(() => null),
              },
              null,
              2,
            ),
          );
          if (/\/(ar|en)\/portal(?:\/|$)/.test(new URL(page.url()).pathname))
            await page.screenshot({ path: output + '/synthetic-failure.png', fullPage: true });
          await direct.auth.signOut();
        }
        console.error(
          'SAFE_BROWSER_DIAGNOSTIC',
          JSON.stringify({
            checkpoint,
            path: new URL(page.url()).pathname,
            workspaceErrors: await page.locator('.staff-dashboard-panel[role="alert"]').count(),
            alerts: await page.getByRole('alert').count(),
            supportCards: await page.locator('.staff-support-card').count(),
            category:
              error instanceof Error && /strict mode violation/.test(error.message)
                ? 'MULTIPLE_MATCHES'
                : error instanceof Error && /Timeout|timed out/.test(error.message)
                  ? 'TIMEOUT'
                  : 'ASSERTION',
          }),
        );
        throw error;
      } finally {
        await context.close();
      }
    }
  }
} catch (error) {
  console.error(
    'LOCAL_STAFF_FAILED',
    checkpoint,
    error instanceof Error
      ? error.name +
          ': ' +
          (/^LOCAL_[A-Z_]+$/.test(error.message)
            ? error.message
            : 'Browser assertion failed; provider and action details withheld')
      : 'unknown',
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  // Only the run-owned tenant, identities and synthetic Finance fixtures. No Storage data.
  sql(
    `begin;set local app.fixture_cleanup='on';delete from public.payments where organization_id='${org}';delete from public.orders where organization_id='${org}';delete from public.quote_versions where organization_id='${org}';delete from public.quotes where organization_id='${org}';delete from public.requests where organization_id='${org}';delete from public.customers where organization_id='${org}'; delete from public.user_roles where organization_id='${org}'; delete from public.organization_memberships where organization_id='${org}'; delete from public.markets where organization_id='${org}'; delete from public.audit_logs where organization_id='${org}'; delete from public.organizations where id='${org}'; commit;`,
  );
  for (const id of users) {
    const r = await admin.auth.admin.deleteUser(id);
    if (r.error) throw Error('LOCAL_CLEANUP_FAILED');
  }
  const remaining = sql(
    `select count(*) from auth.users where id=any(array[${users.map((id) => `'${id}'::uuid`).join(',')}]::uuid[]);`,
  );
  if (remaining !== '0') throw Error('LOCAL_IDENTITY_CLEANUP_FAILED');
  ledger.cleanup = true;
  save();
  if (!externalServer) await stopBrowserServer(server, 3013);
  console.log(`Local evidence: ${output}; captures=${evidence.length}; owned fixture cleanup PASS`);
}
