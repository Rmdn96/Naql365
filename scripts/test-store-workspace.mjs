// Real local Auth, private uploads and application commands. No cloud endpoints.
import { localSupabase } from './local-supabase.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
const local = localSupabase(),
  origin = 'http://127.0.0.1:3017';
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
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
const output = 'test-results/store-local-' + Date.now(),
  users = [],
  captures = [],
  checks = [];
mkdirSync(output, { recursive: true });
const ledger = {
  organization: '91000000-0000-4000-8000-000000000001',
  users,
  cleanup: false,
  credentialReuseDenied: false,
};
const save = () => writeFileSync(output + '/ledger.json', JSON.stringify(ledger, null, 2));
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: origin,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
  STAGING_AUTH_SMOKE_ENABLED: 'false',
};
for (const key of Object.keys(env))
  if (key.startsWith('VERCEL') || /^SUPABASE_.*(TOKEN|PASSWORD|SERVICE|SECRET)/.test(key))
    delete env[key];
const tables = [
  'store_purchase_events',
  'store_purchase_receipts',
  'store_money_entries',
  'store_money_operations',
  'manual_collection_receipts',
  'store_payment_proofs',
  'store_payments',
  'store_order_items',
  'store_orders',
  'store_carts',
  'store_checkout_contracts',
  'store_events',
  'store_command_receipts',
  'store_market_prices',
  'store_supplier_offers',
  'store_product_market_listings',
  'store_products',
  'store_categories',
  'store_supplier_agreements',
  'store_suppliers',
  'store_policy_versions',
];
let server,
  browser,
  seeded = false,
  checkpoint = 'preflight';
const password = randomBytes(24).toString('hex');
async function login(page, identity, locale) {
  await page.goto(origin + '/' + locale + '/login');
  await page.locator('input[name=email]').fill(identity.email);
  await page.locator('input[name=password]').fill(password);
  await page.locator('.auth-form button:not([type=button])').click();
  await expect(page).not.toHaveURL(new RegExp('/' + locale + '/login$'), { timeout: 20000 });
  const r = await page.request.post(origin + '/api/public/market', {
    headers: { Origin: origin },
    data: { country: 'EG' },
  });
  if (!r.ok()) throw Error('Local Market setup rejected');
}
async function capture(page, locale, width, theme, state) {
  await page.setViewportSize({ width, height: 900 });
  await page
    .context()
    .addCookies([{ name: 'naql365_theme', value: theme, url: origin, sameSite: 'Lax' }]);
  if (theme === 'system') await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('.store-experience')).toBeVisible();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    throw Error('Store page overflow');
  const navigation = page.locator('.store-nav a').first();
  await navigation.focus();
  await expect(navigation).toBeFocused();
  await page.keyboard.press('Tab');
  const a = await new AxeBuilder({ page }).include('.store-experience').analyze();
  if (a.violations.length) {
    writeFileSync(
      output + '/axe-failure.json',
      JSON.stringify(
        a.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        null,
        2,
      ),
    );
    throw Error('Store axe violations: ' + a.violations.map((x) => x.id).join(','));
  }
  const file = locale + '-' + width + '-' + theme + '-' + state + '.png';
  await page.screenshot({ path: output + '/' + file, fullPage: true });
  captures.push({
    route: new URL(page.url()).pathname,
    locale,
    width,
    theme,
    state,
    mode: 'real local application with synthetic fixtures',
    file,
    sha256: createHash('sha256')
      .update(readFileSync(output + '/' + file))
      .digest('hex'),
  });
}
try {
  if (sql('select ' + tables.map((t) => `(select count(*) from private.${t})`).join('+')) !== '0')
    throw Error('Local Store baseline not empty; preserving existing records');
  checkpoint = 'build';
  execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 240000,
    maxBuffer: 16 * 1024 * 1024,
  });
  server = spawn(process.execPath, ['scripts/guarded-next.mjs', 'start', '-p', '3017'], {
    env,
    stdio: 'ignore',
    windowsHide: true,
  });
  for (let i = 0; i < 60; i++) {
    if (
      await fetch(origin + '/en/login')
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (i === 59) throw Error('Local server unavailable');
    await new Promise((r) => setTimeout(r, 1000));
  }
  checkpoint = 'synthetic Auth setup';
  for (let i = 1; i <= 6; i++) {
    const email = 'store-' + Date.now() + '-' + i + '@example.invalid';
    const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (r.error || !r.data.user) throw Error('Local synthetic Auth failed');
    users.push({ id: r.data.user.id, email });
    save();
  }
  let fixture = readFileSync('supabase/tests/store_purchase.test.sql', 'utf8').split(
    '-- FIXTURE END.',
  )[0];
  fixture = fixture.replace(
    /insert into auth\.users\(id\) select[\s\S]*?generate_series\(1,6\) n;/,
    '',
  );
  fixture = fixture.replace(
    /insert into public\.organization_memberships\(organization_id,profile_id,member_type\)[\s\S]*?generate_series\(1,6\) n;/,
    () =>
      `insert into public.organization_memberships(organization_id,profile_id,member_type) values ${users.map((u, i) => `('${i === 4 ? '91000000-0000-4000-8000-000000000002' : ledger.organization}','${u.id}','${[0, 3, 4].includes(i) ? 'customer' : i === 5 ? 'driver' : 'staff'}')`).join(',')};`,
  );
  fixture = fixture.replace(
    "where m.profile_id::text like '92000000%';",
    () => `where m.profile_id in (${users.map((u) => "'" + u.id + "'").join(',')});`,
  );
  for (let i = 1; i <= 6; i++)
    fixture = fixture.replaceAll(
      '92000000-0000-4000-8000-' + String(i).padStart(12, '0'),
      users[i - 1].id,
    );
  sql(fixture + '\ncommit;');
  seeded = true;
  save();
  browser = await chromium.launch();
  const customerContext = await browser.newContext(),
    financeContext = await browser.newContext();
  const page = await customerContext.newPage(),
    finance = await financeContext.newPage();
  checkpoint = 'Customer password login';
  await login(page, users[0], 'en');
  await page.goto(origin + '/en/store');
  await expect(page.getByRole('heading', { name: 'Synthetic product' })).toBeVisible();
  await capture(page, 'en', 1280, 'light', 'catalog');
  checkpoint = 'cart';
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByText('Confirmed result saved.', { exact: true })).toBeVisible();
  await page.goto(origin + '/en/store/cart');
  await expect(page.locator('.store-line')).toHaveCount(1);
  await page.getByRole('link', { name: 'Continue', exact: true }).click();
  await capture(page, 'en', 390, 'dark', 'checkout');
  await page.locator('#store-name').fill('SYNTHETIC Customer');
  await page.locator('#store-phone').fill('SYNTHETIC');
  await page.locator('#store-region').selectOption('SYNTHETIC-REGION');
  await page.locator('#store-address').fill('Synthetic address only');
  await page.locator('#store-method').selectOption('VODAFONE_CASH');
  await page.locator('#destination').selectOption('99000000-0000-4000-8000-000000000002');
  await page.locator('.store-check input').check();
  checkpoint = 'place order';
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/store\/orders\/[a-f0-9-]+$/, { timeout: 20000 });
  const id = new URL(page.url()).pathname.split('/').at(-1);
  await page.reload();
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();
  checks.push('registered Customer checkout and refresh');
  checkpoint = 'proof upload';
  await page.locator('#store-proof').setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 60, height: 40, channels: 3, background: '#ffffff' } })
      .png()
      .toBuffer(),
  });
  await page.locator('#store-customer-reference').fill('SYNTHETIC-UNVERIFIED');
  await page.getByRole('button', { name: 'Submit proof for review' }).click();
  await expect(page.getByText('Under review', { exact: true })).toBeVisible({ timeout: 15000 });
  checks.push('real normalized private proof uploaded; funds remain under review');
  await capture(page, 'en', 1280, 'system', 'under-review');
  checkpoint = 'cross Customer proof denial';
  const stranger = await browser.newContext(),
    other = await stranger.newPage();
  await login(other, users[3], 'en');
  const denied = await other.request.get(origin + '/api/store?kind=order&target=' + id);
  if (denied.status() !== 403) throw Error('Other Customer order not denied');
  await stranger.close();
  checkpoint = 'Finance password login';
  await login(finance, users[1], 'en');
  await finance.goto(origin + '/en/portal/store/finance');
  await expect(finance.locator('.store-experience')).toBeVisible();
  await finance.goto(origin + '/en/portal/store/orders/' + id);
  const act = async (action, fields = {}) => {
    await finance.locator('#store-action').selectOption(action);
    for (const [name, value] of Object.entries(fields))
      await finance.locator('[name="' + name + '"]').fill(String(value));
    const check = finance.locator('.store-check input');
    if (await check.count()) await check.check();
    await finance.getByRole('button', { name: 'Execute action', exact: true }).click();
    await expect(finance.getByText('Confirmed result saved.', { exact: true })).toBeVisible();
    await finance.reload();
  };
  await act('accept');
  if (await finance.locator('#store-action option[value=send]').count())
    throw Error('Unpaid transfer release visible');
  await act('confirm_transfer', {
    evidenceReference: 'SYNTHETIC-VERIFIED',
    reference: 'SYNTHETIC-UI-RECEIPT-50',
  });
  for (const action of ['send', 'prepare', 'dispatch', 'deliver']) await act(action);
  checks.push(
    'authorized Finance receipt verification followed by separate real supplier fulfillment commands',
  );
  checkpoint = 'Arabic mobile order';
  await page.goto(origin + '/ar/store/orders/' + id);
  await expect(
    page.locator('.store-status').getByText('تم التسليم', { exact: true }),
  ).toBeVisible();
  await capture(page, 'ar', 360, 'dark', 'delivered');
  await capture(page, 'ar', 1280, 'light', 'delivered');
  await finance.goto(origin + '/ar/portal/store/orders/' + id);
  await capture(finance, 'ar', 390, 'system', 'reconciliation');
  checks.push('AR/EN; Light/Dark/System; 360/390/1280; no page overflow; axe smoke');
  await page.goto(origin + '/en/login');
  await expect(page).toHaveURL(/\/en\/account/);
  checks.push('Customer direct login recognizes session');
  await finance.goto(origin + '/en/login');
  await expect(finance).toHaveURL(/\/en\/portal$/);
  checks.push('Staff direct login recognizes session');
  await customerContext.close();
  await financeContext.close();
} catch (error) {
  console.error(
    'Store local failure at ' +
      checkpoint +
      ': ' +
      (error instanceof Error ? error.message : 'unknown'),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server?.pid) {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        /* already stopped */
      }
    } else server.kill();
  }
  if (seeded) {
    const organization = ledger.organization;
    if (
      sql(
        'select ' +
          tables
            .map(
              (t) => `(select count(*) from private.${t} where organization_id<>'${organization}')`,
            )
            .join('+'),
      ) !== '0'
    )
      throw Error('Cleanup ownership guard failed');
    const paths = JSON.parse(
      sql("select coalesce(json_agg(object_path),'[]') from private.store_payment_proofs"),
    );
    if (paths.length) {
      const r = await admin.storage.from('store-proofs').remove(paths);
      if (r.error) throw Error('Local proof cleanup failed');
    }
    sql(
      `begin;truncate ${tables.map((t) => 'private.' + t).join(',')};delete from public.bank_accounts where organization_id='${organization}';delete from public.customers where organization_id in ('${organization}','91000000-0000-4000-8000-000000000002');delete from public.user_roles where profile_id in (${users.map((u) => "'" + u.id + "'").join(',')});delete from public.role_permissions where role_id='94000000-0000-4000-8000-000000000001';delete from public.roles where id='94000000-0000-4000-8000-000000000001';delete from public.organization_memberships where profile_id in (${users.map((u) => "'" + u.id + "'").join(',')});delete from public.markets where organization_id='${organization}';delete from public.audit_logs where organization_id in ('${organization}','91000000-0000-4000-8000-000000000002');delete from public.organizations where id in ('${organization}','91000000-0000-4000-8000-000000000002');drop function public.store_purchase_error(text,text,text);drop function public.store_purchase_assert(boolean,text);drop table public.store_purchase_test_results;commit;`,
    );
  }
  for (const u of users) {
    const r = await admin.auth.admin.deleteUser(u.id);
    if (r.error) throw Error('Local identity cleanup failed');
  }
  if (users.length) {
    const r = await admin.auth.signInWithPassword({ email: users[0].email, password });
    if (!r.error) throw Error('Deleted identity reuse succeeded');
    ledger.credentialReuseDenied = true;
  }
  if (seeded) {
    if (sql('select ' + tables.map((t) => `(select count(*) from private.${t})`).join('+')) !== '0')
      throw Error('Independent local data cleanup verification failed');
    if (sql("select count(*) from storage.objects where bucket_id='store-proofs'") !== '0')
      throw Error('Local Storage cleanup verification failed');
    ledger.cleanup = true;
  }
  save();
  writeFileSync(
    output + '/evidence.json',
    JSON.stringify(
      {
        checks,
        captures,
        checkpoint,
        passed: !process.exitCode,
        cleanup: ledger.cleanup,
        credentialReuseDenied: ledger.credentialReuseDenied,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      captures: captures.length,
      cleanup: ledger.cleanup,
      credentialReuseDenied: ledger.credentialReuseDenied,
      passed: !process.exitCode,
    }),
  );
}
