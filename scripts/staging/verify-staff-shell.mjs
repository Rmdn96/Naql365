// Hosted restricted-role shell smoke. Scoped synthetic tenant; canonical protected Staging only.
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
import AxeBuilder from '@axe-core/playwright';
import { acceptanceTarget, protectionHeaders } from './target.mjs';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';
const { origin } = acceptanceTarget();
if (origin !== 'https://naql365-staging-ux-stage3-naql365.vercel.app')
  throw Error('STAGE3_ORIGIN_REQUIRED');
const ref = stagingProject();
const headers = protectionHeaders();
const probe = await fetch(origin + '/en/login', {
  headers,
  redirect: 'manual',
  signal: AbortSignal.timeout(20000),
});
if (probe.status !== 200) throw Error('PROTECTED_PREFLIGHT_FAILED');
const release = acquireHostedRun();
const keys = JSON.parse(
  supabase(['projects', 'api-keys', '--project-ref', ref, '--reveal', '--output', 'json']),
);
const admin = createClient(
  'https://' + ref + '.supabase.co',
  keys.find((k) => k.type === 'secret').api_key,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const org = randomUUID(),
  users = [],
  ledger = { org, users, cleanup: false };
const output = 'test-results/staff-hosted-' + Date.now();
mkdirSync(output, { recursive: true });
const save = () => writeFileSync(output + '/ledger.json', JSON.stringify(ledger, null, 2));
const sql = (input) => {
  const rows = query(ref, input);
  return rows?.[0]?.count === undefined ? '' : String(rows[0].count);
};
const roles = [
  ['SUPER_ADMIN', ['quotes', 'operations', 'finance', 'finance/banks', 'support']],
  ['SALES', ['quotes']],
  ['OPERATIONS', ['operations']],
  ['DISPATCHER', ['operations']],
  ['FINANCE', ['finance']],
  ['CUSTOMER_SERVICE', ['support']],
];
let browser;
let checkpoint = 'build';
const evidence = [];
try {
  release.track('organization', org);
  sql(
    `insert into public.organizations(id,name) values('${org}','Synthetic staff workspace'); insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values('${org}','SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966'),('${org}','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');`,
  );
  save();
  browser = await chromium.launch();
  for (const [role, allowed] of roles.filter(
    ([role]) =>
      !process.env.STAFF_ROLE_FILTER || process.env.STAFF_ROLE_FILTER.split(',').includes(role),
  )) {
    const password = randomBytes(24).toString('base64url'),
      email = `staff-${randomUUID()}@example.invalid`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw Error('HOSTED_FIXTURE_IDENTITY_FAILED');
    const id = created.data.user.id;
    users.push(id);
    release.track('auth', id);
    save();
    sql(
      `insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${id}','staff'); insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${id}',id from public.roles where code='${role}';`,
    );
    for (const locale of ['ar', 'en']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
        page = await context.newPage();
      await context.route('**/*', (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            ...(new URL(route.request().url()).origin === origin ? headers : {}),
          },
        }),
      );
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
          checkpoint = role + ' ' + locale + ' overflow ' + width;
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await expect(page.locator('html')).toHaveAttribute(
            'dir',
            locale === 'ar' ? 'rtl' : 'ltr',
          );
          if (width < 1024) {
            checkpoint = role + ' ' + locale + ' drawer ' + width;
            const trigger = page.locator('.staff-drawer-trigger');
            await trigger.click();
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(trigger).toBeFocused();
          }
          if (width === 360) {
            checkpoint = role + ' ' + locale + ' axe ' + width;
            expect(
              (
                await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
              ).violations.map((v) => v.id),
            ).toEqual([]);
          }
          const filename = `${role.toLowerCase()}-${locale}-${width}-empty-dashboard.png`;
          await page.screenshot({ path: output + '/' + filename, fullPage: true });
          evidence.push({
            applicationSha: '1b1e02fc6c316950d53d70e671faeeca82be004e',
            capturedAt: new Date().toISOString(),
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
        }
        for (const denied of ['quotes', 'operations', 'finance', 'finance/banks', 'support'].filter(
          (item) => !allowed.includes(item),
        )) {
          checkpoint = role + ' ' + locale + ' denied route ' + denied;
          await page.goto(origin + '/' + locale + '/portal/' + denied);
          if (denied === 'support') {
            await expect(page.locator('section[role="alert"]')).toBeVisible();
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
          `PASS hosted ${role} ${locale}: normal login, refresh, direct login, granted modules, responsive drawer, axe, logout`,
        );
      } catch (error) {
        console.log(
          JSON.stringify({
            checkpoint,
            path: new URL(page.url()).pathname,
            alerts: await page.getByRole('alert').count(),
            staffShell: await page.locator('.staff-app').count(),
            supportCards: await page.locator('.staff-support-card').count(),
            heading: await page.locator('h1').allTextContents(),
            overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            axe: (
              await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
            ).violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
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
    'HOSTED_STAFF_FAILED',
    checkpoint,
    error instanceof Error
      ? error.name +
          ': ' +
          (/^HOSTED_[A-Z_]+$/.test(error.message)
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
    if (r.error) throw Error('HOSTED_CLEANUP_FAILED');
  }
  const remaining = sql(
    `select count(*) from auth.users where id=any(array[${users.map((id) => `'${id}'::uuid`).join(',')}]::uuid[]);`,
  );
  if (remaining !== '0') throw Error('HOSTED_IDENTITY_CLEANUP_FAILED');
  ledger.cleanup = true;
  save();
  release();
  console.log(
    `Hosted evidence: ${output}; captures=${evidence.length}; owned fixture cleanup PASS`,
  );
}
