// Hosted restricted-role shell smoke. Scoped synthetic tenant; canonical protected Staging only.
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
import { acceptanceTarget, protectionHeaders } from './target.mjs';
import { stagingProject, supabase, query } from './supabase.mjs';
import { acquireHostedRun } from './exclusive-run.mjs';
const { origin } = acceptanceTarget();
if (origin !== 'https://naql365-staging-ui-v2-naql365.vercel.app')
  throw Error('UI_V2_ORIGIN_REQUIRED');
if (!/^[a-f0-9]{40}$/.test(process.env.ACCEPTANCE_APPLICATION_SHA ?? ''))
  throw Error('EXACT_APPLICATION_SHA_REQUIRED');
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
const output = 'test-results/ui-v2-auth-' + Date.now();
mkdirSync(output, { recursive: true });
const save = () => writeFileSync(output + '/ledger.json', JSON.stringify(ledger, null, 2));
const sql = (input) => {
  const rows = query(ref, input);
  return rows?.[0]?.count === undefined ? '' : String(rows[0].count);
};

let browser;
let checkpoint = 'fixtures';
const evidence = [],
  visuals = [];
async function captureFamily(page, locale, state) {
  for (const width of [360, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('main h1').first().waitFor();
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
      throw Error('HOSTED_OVERFLOW');
    const unlabelled = await page
      .locator('main input, main select')
      .evaluateAll(
        (es) =>
          es.filter(
            (e) => e.type !== 'hidden' && !e.labels?.length && !e.getAttribute('aria-label'),
          ).length,
      );
    if (unlabelled) throw Error('HOSTED_LABELS');
    const violations = (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations;
    if (violations.length) throw Error('HOSTED_AXE_' + violations.map((v) => v.id).join('_'));
    const filename = locale + '-' + width + '-' + state + '.png';
    await page.screenshot({
      path: output + '/' + filename,
      fullPage: true,
      mask: [page.locator('input[name=password]')],
    });
    visuals.push({
      locale,
      width,
      state,
      filename,
      applicationSha: process.env.ACCEPTANCE_APPLICATION_SHA,
      sha256: createHash('sha256')
        .update(readFileSync(output + '/' + filename))
        .digest('hex'),
      result: 'PASS',
      timestamp: new Date().toISOString(),
    });
    writeFileSync(output + '/visual-index.json', JSON.stringify(visuals, null, 2));
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

try {
  release.track('organization', org);
  save();
  sql(
    `insert into public.organizations(id,name) values('${org}','Synthetic UI V2 session control'); insert into public.markets(organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values('${org}','SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966'),('${org}','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');`,
  );
  browser = await chromium.launch();
  const selectedRoles = ['CUSTOMER', 'SUPER_ADMIN', 'DRIVER'].filter(
    (r) =>
      !process.env.UI_V2_AUTH_ROLE_FILTER ||
      process.env.UI_V2_AUTH_ROLE_FILTER.split(',').includes(r),
  );
  for (const role of selectedRoles) {
    const email = 'ui-v2-auth-' + randomUUID() + '@example.invalid',
      password = randomBytes(24).toString('base64url');
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw Error('HOSTED_IDENTITY_FAILED');
    const id = created.data.user.id;
    users.push(id);
    release.track('auth', id);
    save();
    const kind = role === 'CUSTOMER' ? 'customer' : role === 'DRIVER' ? 'driver' : 'staff';
    sql(
      `insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${id}','${kind}');insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${id}',id from public.roles where code='${role}';`,
    );
    if (role === 'CUSTOMER')
      sql(`insert into public.customers(organization_id,profile_id) values('${org}','${id}');`);
    if (role === 'DRIVER')
      sql(
        `insert into public.drivers(organization_id,profile_id,market_id,driver_type,display_name,active) select '${org}','${id}',id,'INTERNAL','Synthetic session driver',true from public.markets where organization_id='${org}' and country_code='SA';`,
      );
    for (const locale of ['ar', 'en']) {
      const destination = role === 'CUSTOMER' ? 'account' : role === 'DRIVER' ? 'driver' : 'portal';
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await context.route('**/*', (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            ...(new URL(route.request().url()).origin === origin ? headers : {}),
          },
        }),
      );
      try {
        if (role === 'CUSTOMER') {
          checkpoint = 'public visual ' + locale;
          for (const path of ['login', 'register', 'recover']) {
            await page.goto(origin + '/' + locale + '/' + path);
            await captureFamily(page, locale, path + '-initial');
          }
          await page.goto(origin + '/auth/callback?locale=' + locale);
          await expect(page).toHaveURL(
            new RegExp('/' + locale + '/login\\?notice=confirmation-link$'),
          );
          await expect(page.locator('main [role=alert]')).toBeVisible();
          await captureFamily(page, locale, 'confirmation-invalid');
          await page.goto(origin + '/' + locale + '/register');
          await page.locator('#email').fill(email);
          await page.locator('#password').fill(password);
          await page.locator('.auth-form button[type=submit]').click();
          await expect(page.locator('.auth-form [role=status]')).toBeVisible();
          await page.locator('#password').fill('');
          await page.locator('#email').fill('');
          await captureFamily(page, locale, 'signup-email-sent-existing-fixture');
          await page.goto(origin + '/' + locale + '/recover');
          await page.locator('#email').fill(email);
          await page.locator('.auth-form button[type=submit]').click();
          await expect(page.locator('.auth-form [role=status]')).toBeVisible();
          await page.locator('#email').fill('');
          await captureFamily(page, locale, 'recovery-email-sent');
          await page.goto(origin + '/' + locale + '/login');
          await page.locator('#email').fill(email);
          await page.locator('#password').fill(randomBytes(24).toString('base64url'));
          await page.locator('.auth-form button[type=submit]').click();
          await expect(page.locator('.auth-form [role=alert]')).toBeVisible();
          await page.locator('#password').fill('');
          await page.locator('#email').fill('');
          await captureFamily(page, locale, 'login-invalid-credentials');
        }
        checkpoint = role + ' ' + locale + ' login';
        await page.goto(origin + '/' + locale + '/login');
        await page.locator('#email').fill(email);
        await page.locator('#password').fill(password);
        await page.locator('.auth-form button[type=submit]').click();
        await expect(page).toHaveURL(new RegExp('/' + locale + '/' + destination + '$'));
        if (role === 'CUSTOMER') {
          await page.locator('.profile-settings summary').click();
          await captureFamily(page, locale, 'profile-existing-authorized-fields');
          await page.goto(origin + '/' + locale + '/password');
          await expect(page.locator('#password')).toHaveAttribute('autocomplete', 'new-password');
          const reveal = page.locator('.auth-v2-reveal');
          await reveal.click();
          await expect(page.locator('#password')).toHaveAttribute('type', 'text');
          await reveal.click();
          await expect(page.locator('#password')).toHaveAttribute('type', 'password');
          await captureFamily(page, locale, 'new-password-authorized-form');
          await page.goto(origin + '/' + locale + '/' + destination);
        }
        const authCookies = (await context.cookies()).filter((c) =>
          /^sb-.*-auth-token(?:\.\d+)?$/.test(c.name),
        );
        expect(authCookies.length).toBeGreaterThan(0);
        expect(
          authCookies.every(
            (c) =>
              c.secure &&
              c.sameSite === 'Lax' &&
              c.path === '/' &&
              c.domain === new URL(origin).hostname,
          ),
        ).toBe(true);
        await page.reload();
        await expect(page).toHaveURL(new RegExp('/' + locale + '/' + destination + '$'));
        for (const lang of [locale, locale === 'ar' ? 'en' : 'ar']) {
          checkpoint = role + ' ' + lang + ' public navigation';
          await page.goto(origin + '/' + lang);
          await expect(page.locator('.desktop-header-nav .identity-link')).toHaveAttribute(
            'href',
            '/' + lang + '/' + destination,
          );
          await page.locator('.mobile-menu > button').click();
          await expect(page.locator('.mobile-menu dialog .identity-link')).toBeVisible();
          await expect(page.locator('.mobile-menu dialog .identity-link')).toHaveAttribute(
            'href',
            '/' + lang + '/' + destination,
          );
          await page.keyboard.press('Escape');
          checkpoint = role + ' ' + lang + ' services';
          await page.goto(origin + '/' + lang + '#services');
          for (const country of ['EG', 'SA']) {
            checkpoint = role + ' ' + lang + ' market ' + country;
            await page.locator('#public-market').selectOption(country);
            await expect(page.locator('#public-market')).toHaveValue(country);
            await expect(page.locator('.desktop-header-nav .identity-link')).toHaveAttribute(
              'href',
              '/' + lang + '/' + destination,
            );
          }
          await page.goto(origin + '/' + lang + '/login');
          await expect(page).toHaveURL(new RegExp('/' + lang + '/' + destination + '$'));
        }
        checkpoint = role + ' cross-role denial';
        if (role !== 'SUPER_ADMIN') {
          await page.goto(origin + '/' + locale + '/portal');
          await expect(page.locator('.staff-app')).toHaveCount(0);
        }
        if (role !== 'DRIVER') {
          await page.goto(origin + '/' + locale + '/driver');
          await expect(page.locator('.driver-shell')).toHaveCount(0);
        }
        if (role !== 'CUSTOMER') {
          await page.goto(origin + '/' + locale + '/account');
          await expect(page.locator('.summary-grid')).toHaveCount(0);
        }
        await page.goto(origin + '/' + locale + '/' + destination);
        checkpoint = role + ' ' + locale + ' logout';
        await page
          .getByRole('button', { name: locale === 'ar' ? 'تسجيل الخروج' : 'Sign out', exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp('/' + locale + '/(driver/)?login'));
        await page.goBack();
        await expect(
          page.locator(
            role === 'DRIVER'
              ? '.driver-shell'
              : role === 'SUPER_ADMIN'
                ? '.staff-app'
                : '.customer-home',
          ),
        ).toHaveCount(0);
        await page.reload();
        await expect(page).toHaveURL(new RegExp('/' + locale + '/(driver/)?login'));
        await page.goto(origin + '/' + locale + '/' + destination);
        await expect(page).toHaveURL(new RegExp('/' + locale + '/(driver/)?login'));
        evidence.push({
          role,
          locale,
          result: 'PASS',
          applicationSha: process.env.ACCEPTANCE_APPLICATION_SHA,
          cookies: 'Secure Lax / host-only',
          timestamp: new Date().toISOString(),
        });
        writeFileSync(output + '/index.json', JSON.stringify(evidence, null, 2));
        console.log('PASS hosted session ' + role + ' ' + locale);
      } catch (error) {
        console.log(
          JSON.stringify({
            checkpoint,
            path: new URL(page.url()).pathname,
            strict: error.message?.includes('strict mode violation'),
            timeout: error.name === 'TimeoutError',
            identityLinks: await page
              .locator('header .identity-link')
              .evaluateAll((es) => es.map((e) => e.getAttribute('href'))),
            marketCount: await page.locator('#public-market').count(),
            alerts: await page.getByRole('alert').count(),
          }),
        );
        throw error;
      } finally {
        await context.close();
      }
    }
  }
  const counts = query(
    ref,
    `select m.profile_id,count(distinct m.organization_id)::int memberships,count(distinct ur.role_id)::int roles from public.organization_memberships m join public.user_roles ur on ur.organization_id=m.organization_id and ur.profile_id=m.profile_id where m.organization_id='${org}' group by m.profile_id`,
  );
  if (
    counts.length !== selectedRoles.length ||
    counts.some((r) => r.memberships !== 1 || r.roles !== 1)
  )
    throw Error('HOSTED_IDENTITY_DUPLICATION');
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
    `begin; delete from public.drivers where organization_id='${org}'; delete from public.customers where organization_id='${org}'; delete from public.user_roles where organization_id='${org}'; delete from public.organization_memberships where organization_id='${org}'; delete from public.markets where organization_id='${org}'; delete from public.audit_logs where organization_id='${org}'; delete from public.organizations where id='${org}'; commit;`,
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
