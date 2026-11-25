// Real local Auth, private uploads and application commands. No cloud endpoints.
import { localSupabase } from './local-supabase.mjs';
import { execFileSync } from 'node:child_process';
import { assertBrowserPortFree, startBrowserServer, stopBrowserServer } from './browser-server.mjs';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { checkStaffRecovery } from './staff-recovery-browser.mjs';
import { checkGuestStorefront } from './commerce-launch-browser.mjs';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createCatalogEvidence } from './catalog-evidence.mjs';
const local = localSupabase();
const externalServer = process.env.NAQL365_EXISTING_BROWSER_ORIGIN;
if (externalServer && externalServer !== 'http://127.0.0.1:3000')
  throw Error('Existing server must be the approved loopback origin');
const origin = externalServer || 'http://127.0.0.1:3000';
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
  const response = await fetch(origin + '/api/store?kind=cart');
  if (response.status !== 401) throw Error('Existing server anonymous auth check failed');
}
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
const diagnostics = createCatalogEvidence(output);
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
  NAQL365_CATALOG_DIAGNOSTICS: '1',
  NAQL365_CATALOG_EVIDENCE_FILE: diagnostics.file,
  NAQL365_CATALOG_PHASE: 'runtime',
};
for (const key of Object.keys(env))
  if (key.startsWith('VERCEL') || /^SUPABASE_.*(TOKEN|PASSWORD|SERVICE|SECRET)/.test(key))
    delete env[key];
const tables = [
  'guest_rate_budgets',
  'store_supplier_reference_prices',
  'store_product_media',
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
  failurePage,
  guestEvidence = false,
  seeded = false,
  checkpoint = 'preflight';
console.log('CHECKPOINT ' + checkpoint);
const password = randomBytes(24).toString('hex');
async function login(page, identity, locale) {
  await page.goto(origin + '/' + locale + '/login');
  await page.locator('input[name=email]').fill(identity.email);
  await page.locator('input[name=password]').fill(password);
  const submitted = page.waitForResponse(
    (response) =>
      response.url() === origin + '/' + locale + '/login' && response.request().method() === 'POST',
  );
  await page.locator('.auth-form button:not([type=button])').click();
  const signedIn = await submitted;
  if (signedIn.status() !== 200 && signedIn.status() !== 303)
    throw Error('Local login HTTP failure');
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
  await expect(page.locator('.store-experience').first()).toBeVisible();
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
    throw Error('Store page overflow');
  const navigation = page.locator('.commerce-cart');
  await navigation.focus();
  await expect(navigation).toBeFocused();
  await page.keyboard.press('Tab');
  const a = await new AxeBuilder({ page }).include('main').include('.launch-header').analyze();
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
  if (!externalServer) {
    await assertBrowserPortFree(3000);
    checkpoint = 'build';
    console.log('CHECKPOINT ' + checkpoint);
    execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
      env: { ...env, NAQL365_CATALOG_PHASE: 'build' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    });
    server = await startBrowserServer(env, 3000, undefined, diagnostics.receive);
    checkpoint = 'server diagnostic acknowledgement';
    // Channel health is established before fixture assertions or product rendering.
    await expect
      .poll(() =>
        diagnostics
          .snapshot()
          .fileRecords.some(
            (event) =>
              event.stage === 'startup' &&
              event.phase === 'runtime' &&
              event.outcome === 'ready' &&
              event.build !== null,
          ),
      )
      .toBe(true);
  }
  if (externalServer) {
    // next dev compiles routes on first use; warm only read-only public entry routes.
    for (const locale of ['ar', 'en'])
      for (const route of ['/login', '/request', '/store', '/store/cart']) {
        const response = await fetch(origin + '/' + locale + route);
        if (response.status !== 200) throw Error('Public route preparation failed');
        await response.arrayBuffer();
      }
  }
  checkpoint = 'synthetic Auth setup';
  console.log('CHECKPOINT ' + checkpoint);
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
  fixture = fixture.replace("array['SYNTHETIC-REGION']", "array['CAIRO', 'GIZA']");
  fixture = fixture.replace("case n when 1 then 'VODAFONE_CASH'", "case n when 1 then 'BANK'");
  sql(fixture + '\ncommit;');
  seeded = true;
  save();
  // Diagnose fixture authority before crossing the HTTP/application boundary.
  const fixtureAuthority = JSON.parse(
    sql(
      "select json_build_object('suppliers',(select count(*) from private.store_suppliers),'products',(select count(*) from private.store_products),'categories',(select count(*) from private.store_categories where status='PUBLISHED'),'prices',(select count(*) from private.store_market_prices where status='APPROVED'),'offers',(select count(*) from private.store_supplier_offers where status='APPROVED'),'eligible',(select count(*) from private.store_product_market_listings l where private.store_listing_eligible(l.organization_id,l.id)))",
    ),
  );
  const publicClient = createClient(local.API_URL, local.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicCatalog = await publicClient.rpc('store_shop_v1', { p_country: 'EG' });
  const boundary = {
    fixtureAuthority,
    publicRpcError: publicCatalog.error
      ? /^[A-Z0-9]{5,10}$/.test(publicCatalog.error.code)
        ? publicCatalog.error.code
        : 'OTHER'
      : null,
    publicStatus: ['AVAILABLE', 'NOT_AVAILABLE'].includes(publicCatalog.data?.status)
      ? publicCatalog.data.status
      : 'UNKNOWN',
    publicItems: Array.isArray(publicCatalog.data?.items)
      ? Math.min(publicCatalog.data.items.length, 21)
      : null,
  };
  writeFileSync(output + '/catalog-boundary.json', JSON.stringify(boundary, null, 2));
  console.log('CATALOG_BOUNDARY ' + JSON.stringify(boundary));
  if (
    fixtureAuthority.eligible !== 1 ||
    publicCatalog.error ||
    publicCatalog.data?.items?.length !== 1
  )
    throw Error('Synthetic catalog authority/public RPC boundary failed');
  browser = await chromium.launch();
  const customerContext = await browser.newContext();
  const page = await customerContext.newPage();
  failurePage = page;
  guestEvidence = true;

  checkpoint = 'guest homepage';
  console.log('CHECKPOINT ' + checkpoint);
  const homepage = await page.goto(origin + '/en');
  await expect(page.locator('.commerce-cart-badge')).toHaveText('0');
  const rendered = {
    httpStatus: homepage?.status(),
    routeErrorVisible: await page
      .getByRole('heading', { name: 'Unable to complete the operation', exact: true })
      .isVisible(),
    ssrProductCards:
      (await homepage.text()).match(/<article[^>]*class="[^"]*\bstore-product\b/g)?.length ?? 0,
    productCards: await page.locator('.commerce-products .store-product').count(),
  };
  writeFileSync(output + '/homepage-boundary.json', JSON.stringify(rendered, null, 2));
  console.log('HOMEPAGE_BOUNDARY ' + JSON.stringify(rendered));
  if (!externalServer)
    await expect
      .poll(() =>
        diagnostics
          .snapshot()
          .fileRecords.some(
            (event) =>
              event.phase === 'runtime' &&
              event.stage === 'projection' &&
              event.valid === true &&
              event.available === true &&
              event.items === publicCatalog.data.items.length,
          ),
      )
      .toBe(true);
  expect(rendered.ssrProductCards).toBe(1);
  await expect(page.locator('.commerce-products .store-product')).toHaveCount(1);
  // Local-only fault injection tests artifact preservation; never alters application behavior.
  if (process.env.NAQL365_COMMERCE_DIAGNOSTIC_FAILURE === '1')
    throw Error('SIMULATED_DIAGNOSTIC_FAILURE');
  checkpoint = 'guest order and responsive storefront';
  const product = publicCatalog.data.items[0];
  const reference = await checkGuestStorefront({ page, origin, capture, product, checks });
  if (!/^S-[0-9a-f]{32}$/.test(reference)) throw Error('Invalid guest reference');
  const stored = JSON.parse(
    sql(
      "select json_build_object('subtotal',subtotal_minor,'fee',delivery_minor,'total',total_minor,'method',guest_payment_method) from private.store_orders where reference='" +
        reference +
        "'",
    ),
  );
  expect(stored).toEqual({ subtotal: 2000, fee: null, total: null, method: 'CASH' });
  const intent = {
    request_id: randomUUID(),
    items: [{ listing_id: product.listingId, quantity: 2, unit_price: product.amountMinor / 100 }],
    full_name: 'Synthetic Bank Customer',
    phone: '01012345679',
    governorate: 'GIZA',
    area: 'Synthetic area',
    address: 'Synthetic isolated address',
    payment_method: 'BANK_TRANSFER',
  };
  const post = (data) =>
    page.request.post(origin + '/api/store/guest-order', { headers: { Origin: origin }, data });
  expect((await post({ ...intent, governorate: 'ALEXANDRIA' })).status()).toBe(400);
  expect((await post({ ...intent, items: [{ ...intent.items[0], unit_price: 1 }] })).status()).toBe(
    409,
  );
  const transfer = await post(intent);
  expect(transfer.status()).toBe(201);
  const transferReference = (await transfer.json()).reference;
  expect((await (await post(intent)).json()).reference).toBe(transferReference);
  expect(sql('select count(*) from private.store_orders')).toBe('2');
  await page.goto(origin + '/en/portal/store/orders');
  await expect(page).toHaveURL(/\/en\/(login|forbidden)/);
  guestEvidence = false;
  await login(page, users[0], 'en');
  const denied = await page.request.post(origin + '/api/store/catalog', {
    headers: { Origin: origin },
    data: { family: 'draft', operation: 'create_product', mutationId: randomUUID(), payload: {} },
  });
  expect(denied.status()).toBe(403);
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await login(staff, users[1], 'en');
  await staff.goto(origin + '/en/portal/store/orders');
  await expect(staff.getByText(reference, { exact: false }).first()).toBeVisible();
  for (const [orderRef, bank] of [
    [reference, false],
    [transferReference, true],
  ]) {
    await staff.goto(origin + '/en/portal/store/orders');
    await staff.locator('a').filter({ hasText: orderRef }).first().click();
    const action = staff.locator('#store-action');
    const run = async (name, fields = {}) => {
      await action.selectOption(name);
      for (const [name, value] of Object.entries(fields))
        await staff.locator('[name="' + name + '"]').fill(value);
      const confirmed = staff.locator('.store-check input');
      if (await confirmed.count()) await confirmed.check();
      const request = staff.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/store' &&
          r.request().method() === 'POST' &&
          r.request().postDataJSON()?.action === name,
      );
      await staff.getByRole('button', { name: 'Execute action', exact: true }).click();
      expect((await request).status()).toBe(200);
      await staff.reload();
    };
    await run('quote_delivery', { deliveryEgp: '3' });
    await run('confirm_total', { evidenceReference: 'Synthetic call confirmation' });
    if (bank) {
      await expect(action.locator('option[value=send]')).toHaveCount(0);
      await run('verify_bank', {
        reference: 'SYNTHETIC-BANK-MVP',
        evidenceReference: 'Synthetic bank credit',
        receivedEgp: '23',
      });
    }
    for (const name of ['send', 'prepare', 'dispatch', 'deliver']) await run(name);
    if (!bank) {
      await run('report_cash', {
        amountMinor: '2300',
        reason: 'Synthetic collected',
        evidenceReference: 'Synthetic courier collection',
      });
      await run('confirm_cash', { evidenceReference: 'Synthetic finance confirmation' });
    }
    const details = await staff.request.get(
      origin + '/api/store?kind=order&target=' + new URL(staff.url()).pathname.split('/').at(-1),
    );
    expect((await details.json()).payment.status).toBe('VERIFIED');
  }
  checks.push(
    'Staff quote, client consent, bank verification before release and COD verification after delivery',
  );
  await staffContext.close();
  await checkStaffRecovery(browser, users[1].email, local.API_URL, origin);
  checks.push(
    'Isolated staff recovery message accepted in local inbox and PKCE callback opened password form',
  );
  checks.push(
    'Correct unquoted order in database, staff queue visible, customer denied administration',
  );
  await page.goto(origin + '/en/request');
  await expect(page).toHaveURL(/\/en\/request/);
  sql(
    "update private.store_policy_versions set scope_paused=true,revision=revision+1 where kind='STOREFRONT_SCOPE' and organization_id='" +
      ledger.organization +
      "'",
  );
  await page.goto(origin + '/en');
  await expect(page.locator('.store-product')).toHaveCount(0);
  await expect(page.getByText('Purchasing is currently unavailable.')).toBeVisible();
  const paused = await page.request.post(origin + '/api/store/guest-order', {
    headers: { Origin: origin },
    data: {
      request_id: randomUUID(),
      items: [
        { listing_id: product.listingId, quantity: 1, unit_price: product.amountMinor / 100 },
      ],
      full_name: 'Synthetic Guest',
      phone: '01012345678',
      governorate: 'GIZA',
      area: 'Synthetic area',
      address: 'Synthetic isolated address',
      payment_method: 'CASH',
    },
  });
  expect([403, 409]).toContain(paused.status());
  expect(sql('select count(*) from private.store_orders')).toBe('2');
  checks.push('Paused scope prevents new guest order; historical order preserved');
  await customerContext.close();
} catch (error) {
  diagnostics.snapshot();
  let screenshotSaved = false;
  if (guestEvidence && failurePage) {
    try {
      await failurePage.screenshot({ path: output + '/guest-failure.png', fullPage: true });
      screenshotSaved = true;
    } catch {
      // The structured boundary artifact remains available if the page/browser has exited.
    }
  }
  const failure = {
    checkpoint,
    kind:
      error instanceof Error && error.message === 'SIMULATED_DIAGNOSTIC_FAILURE'
        ? 'SIMULATED_DIAGNOSTIC_FAILURE'
        : 'HARNESS_FAILURE',
    screenshotSaved,
    assertion:
      error instanceof Error && error.message.includes('toHaveURL')
        ? 'route'
        : error instanceof Error && error.message.includes('toHaveText')
          ? 'text'
          : error instanceof Error && error.message.includes('toBeVisible')
            ? 'visibility'
            : 'other',
    route: failurePage ? new URL(failurePage.url()).pathname : null,
    // Raw Playwright traces can retain headers, tokens and submitted form values.
    trace: 'structured-boundaries-only',
  };
  writeFileSync(output + '/failure-evidence.json', JSON.stringify(failure, null, 2));
  console.error('COMMERCE_FAILURE ' + JSON.stringify(failure));
  process.exitCode = 1;
} finally {
  diagnostics.snapshot();
  await browser?.close();
  if (!externalServer) await stopBrowserServer(server, 3000);
  diagnostics.snapshot();
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
    const productPaths = JSON.parse(
      sql("select coalesce(json_agg(id::text||'.webp'),'[]') from private.store_product_media"),
    );
    if (productPaths.length) {
      const removed = await admin.storage.from('store-product-media').remove(productPaths);
      if (removed.error) throw Error('Local product-media cleanup failed');
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
    if (
      sql(
        "select count(*) from storage.objects where bucket_id in ('store-proofs','store-product-media')",
      ) !== '0'
    )
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
