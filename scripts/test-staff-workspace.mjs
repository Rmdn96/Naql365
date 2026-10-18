// Local-only real Auth + restricted-role browser regression. No cloud credentials or bypass.
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ),
);
if (new URL(local.API_URL).hostname !== '127.0.0.1') throw Error('LOCAL_ONLY');
const origin = 'http://127.0.0.1:3013';
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: origin,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  STAGING_AUTH_SMOKE_ENABLED: 'false',
};
for (const key of ['VERCEL_ENV', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'])
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
try {
  // Build before creating any fixture. Child output is withheld, never raw provider logs.
  execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  server = spawn(process.execPath, ['scripts/guarded-next.mjs', 'start', '-p', '3013'], {
    env,
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let n = 0; n < 60; n++) {
    if (
      await fetch(origin + '/en/login')
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (n === 59) throw Error('LOCAL_START_FAILED');
    await new Promise((r) => setTimeout(r, 1000));
  }
  sql(
    `insert into public.organizations(id,name) values('${org}','Synthetic staff workspace'); insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values('${org}','SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966'),('${org}','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');`,
  );
  save();
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
        await page.locator('.auth-form button:not([type=button])').click();
        checkpoint = role + ' ' + locale + ' destination';
        await expect(page).toHaveURL(new RegExp('/' + locale + '/portal$'), { timeout: 20000 });
        await expect(page.locator('.staff-app')).toBeVisible();
        await page.reload();
        await expect(page.locator('.staff-app')).toBeVisible();
        await page.goto(origin + '/' + locale + '/login');
        await expect(page).toHaveURL(new RegExp('/' + locale + '/portal$'));
        checkpoint = role + ' ' + locale + ' workspaceModule visibility';
        const nav = page.locator('.staff-sidebar nav');
        for (const country of ['EG', 'SA']) {
          checkpoint = role + ' ' + locale + ' Market navigation ' + country;
          const changed = page.waitForResponse(
            (r) => r.url().endsWith('/api/public/market') && r.request().method() === 'POST',
          );
          await page.locator('#staff-market').selectOption(country);
          expect((await changed).status()).toBe(200);
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
          await expect(page.locator('#staff-market')).toHaveValue(country);
          const other = locale === 'ar' ? 'en' : 'ar';
          await page.goto(origin + '/' + other + '/portal');
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
          await page.goto(origin + '/' + locale + '/portal/' + workspaceModule);
          await expect(page.locator('.staff-app')).toBeVisible();
          await expect(page.locator('.staff-workspace-content h1')).toBeVisible();
          if (workspaceModule === 'finance') {
            await expect(page.locator('.staff-workspace-content')).toContainText(
              locale === 'ar'
                ? 'قائمة المالية غير متاحة مؤقتًا'
                : 'Finance queue temporarily unavailable',
            );
            await expect(page.locator('.finance-queue')).toHaveCount(0);
          }
        }
        for (const denied of ['quotes', 'operations', 'finance', 'finance/banks', 'support'].filter(
          (item) => !allowed.includes(item),
        )) {
          checkpoint = role + ' ' + locale + ' denied route ' + denied;
          await page.goto(origin + '/' + locale + '/portal/' + denied);
          if (denied === 'support') {
            await expect(page.getByRole('alert')).toBeVisible();
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
        await expect(page).toHaveURL(new RegExp('/' + locale + '/login'), { timeout: 20000 });
        await page.goto(origin + '/' + locale + '/portal');
        await expect(page).toHaveURL(new RegExp('/' + locale + '/login'));
        console.log(
          `PASS local ${role} ${locale}: normal login, refresh, direct login, granted modules, responsive drawer, axe, logout`,
        );
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
  // Only this run's exact tenant and identity ledger. No business/Storage fixtures are created.
  sql(
    `begin; delete from public.user_roles where organization_id='${org}'; delete from public.organization_memberships where organization_id='${org}'; delete from public.markets where organization_id='${org}'; delete from public.audit_logs where organization_id='${org}'; delete from public.organizations where id='${org}'; commit;`,
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
  if (server?.pid) {
    if (process.platform === 'win32')
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    else server.kill();
  }
  console.log(`Local evidence: ${output}; captures=${evidence.length}; owned fixture cleanup PASS`);
}
