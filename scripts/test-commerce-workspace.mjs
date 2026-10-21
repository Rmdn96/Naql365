// Real local Auth, private uploads and application commands. No cloud endpoints.
import { localSupabase } from './local-supabase.mjs';
import { execFileSync } from 'node:child_process';
import { assertBrowserPortFree, startBrowserServer, stopBrowserServer } from './browser-server.mjs';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createCatalogEvidence } from './catalog-evidence.mjs';
const local = localSupabase();
const externalServer = process.env.NAQL365_EXISTING_BROWSER_ORIGIN;
if (externalServer && externalServer !== 'http://127.0.0.1:3000')
  throw Error('Existing server must be the approved loopback origin');
const origin = externalServer || 'http://127.0.0.1:3017';
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
  const a = await new AxeBuilder({ page }).include('main').include('.cm-header').analyze();
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
    await assertBrowserPortFree(3017);
    checkpoint = 'build';
    console.log('CHECKPOINT ' + checkpoint);
    execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
      env: { ...env, NAQL365_CATALOG_PHASE: 'build' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    });
    server = await startBrowserServer(env, 3017, undefined, diagnostics.receive);
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
    market: await page.getByLabel('Service country', { exact: true }).inputValue(),
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
  checkpoint = 'guest add to cart';
  await page
    .locator('.commerce-products')
    .getByRole('button', { name: 'Add to cart', exact: true })
    .click();
  checkpoint = 'guest login navigation';
  await expect(page).toHaveURL(origin + '/en/login');
  if (sql('select count(*) from private.store_carts') !== '0') throw Error('Guest created cart');
  checks.push('Guest homepage add redirects to canonical login; no phantom cart');
  guestEvidence = false; // Never capture credentials, authenticated HTML or customer state.
  await login(page, users[0], 'en');
  checkpoint = 'customer dashboard';
  await page.goto(origin + '/en/account');
  await expect(page.locator('.cm-portal-nav')).toBeVisible();
  await expect(page.locator('.cm-portal-nav a[href="/en/store/orders"]')).toBeVisible();
  const deniedCatalog = await page.request.post(origin + '/api/store/catalog', {
    headers: { Origin: origin },
    data: { family: 'draft', operation: 'create_product', mutationId: randomUUID(), payload: {} },
  });
  if (deniedCatalog.status() !== 403) throw Error('Customer catalog administration was not denied');
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await login(staffPage, users[1], 'en');
  await staffPage.goto(origin + '/en/portal/store/catalog?kind=products');
  await expect(staffPage.locator('.st-admin-shell')).toBeVisible();
  await expect(staffPage.locator('#catalog-search')).toBeVisible();
  await staffContext.close();
  await page.goto(origin + '/en');
  await expect(page.locator('.commerce-cart-badge')).toHaveText('0');
  const add = page
    .locator('.commerce-products')
    .getByRole('button', { name: 'Add to cart', exact: true });
  await add.click();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('1');
  await expect(add).toBeEnabled();
  await add.evaluate((el) => {
    el.click();
    el.click();
  });
  await expect(page.locator('.commerce-cart-badge')).toHaveText('2');
  await expect(add).toBeEnabled();
  const actual = await (await page.request.get(origin + '/api/store?kind=cart')).json();
  if (actual.items.length !== 1 || actual.items[0].quantity !== 2)
    throw Error('Duplicate cart entry or lost quantity');
  checks.push('Homepage real cart add and immediate unit badge; double click blocked');
  await capture(page, 'en', 1280, 'light', 'commerce-home-cart');
  checkpoint = 'cart quantity';
  await page.goto(origin + '/en/store/cart');
  await page.locator('.store-line .cm-quantity button').last().click();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('3');
  await page.reload();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('3');
  await expect(page.locator('.store-line .cm-quantity output')).toHaveText('3');
  await page.goto(origin + '/en');
  await expect(page.locator('.commerce-cart-badge')).toHaveText('3');
  checks.push('Quantity edit, refresh and navigation retain authoritative cart');
  const other = await browser.newContext(),
    otherPage = await other.newPage();
  await login(otherPage, users[3], 'en');
  const otherCart = await otherPage.request.get(origin + '/api/store?kind=cart');
  if (!otherCart.ok() || (await otherCart.json()).items.length)
    throw Error('Customer cart isolation failed');
  await other.close();
  await page.locator('#commerce-search').fill('Synthetic');
  await page.locator('#commerce-search').press('Enter');
  await expect(page).toHaveURL(/\/en\/store\?search=Synthetic$/);
  await expect(page.locator('.store-product')).toHaveCount(1);
  await expect(page.locator('#store-category')).toBeVisible();
  if (/supplierEntitlement|unit_cost_minor|productDifferenceMinor/.test(await page.content()))
    throw Error('Private cost in customer HTML');
  checks.push('Search/categories use canonical public projection; private costs absent');
  checkpoint = 'checkout navigation';
  await page.goto(origin + '/en/store/cart');
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await page.waitForURL(origin + '/en/store/checkout');
  await expect(page).toHaveURL(origin + '/en/store/checkout');
  await expect(page.locator('#store-name')).toBeEditable();
  for (const method of ['CASH', 'VODAFONE_CASH', 'INSTAPAY'])
    await expect(page.locator('#store-method input[value="' + method + '"]').first()).toHaveCount(
      1,
    );
  await page.locator('#store-name').fill('SYNTHETIC Customer');
  await page.locator('#store-phone').fill('SYNTHETIC');
  await page.locator('#store-region').selectOption('SYNTHETIC-REGION');
  await page.locator('#store-address').fill('Synthetic address only');
  await page.locator('#store-method input[value="CASH"]').check();
  await page.locator('.store-check input').check();
  checkpoint = 'checkout command';
  const placed = page.waitForResponse(
    (response) =>
      response.url() === origin + '/api/store' &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.action === 'checkout',
  );
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const placedResponse = await placed;
  if (placedResponse.status() !== 200) throw Error('Checkout command rejected');
  await page.waitForURL(/\/en\/store\/orders\/[a-f0-9-]+$/);
  await expect(page).toHaveURL(/\/en\/store\/orders\/[a-f0-9-]+$/);
  await expect(page.locator('.commerce-cart-badge')).toHaveText('0');
  const orderId = new URL(page.url()).pathname.split('/').at(-1);
  await expect(page.locator('.cm-order-detail')).toBeVisible();
  await page.goto(origin + '/en/store/orders');
  await expect(
    page.locator('.cm-records a[href="/en/store/orders/' + orderId + '"]'),
  ).toBeVisible();
  await page.goto(origin + '/en/store/products/' + publicCatalog.data.items[0].slug);
  await expect(page.locator('.cm-product-detail')).toBeVisible();
  const snapshot = sql(
    "select to_jsonb(i)::text from private.store_order_items i where order_id='" + orderId + "'",
  );
  await page.goto(origin + '/en/store/cart');
  await expect(page.locator('.store-line')).toHaveCount(0);
  await page.goto(origin + '/en');
  await page
    .locator('.commerce-products')
    .getByRole('button', { name: 'Add to cart', exact: true })
    .click();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('1');
  const nextCart = await (await page.request.get(origin + '/api/store?kind=cart')).json();
  if (nextCart.checkedOutOrderId || nextCart.items.length !== 1 || nextCart.items[0].quantity !== 1)
    throw Error('Consumed order items leaked into the new cart');
  if (
    snapshot !==
    sql(
      "select to_jsonb(i)::text from private.store_order_items i where order_id='" + orderId + "'",
    )
  )
    throw Error('New cart altered the immutable order snapshot');
  checks.push(
    'Checkout consumes cart; new add starts at one; historical order snapshot unchanged; three payment choices retained',
  );
  await page.goto(origin + '/en/store/cart');
  await page.getByRole('button', { name: /^Remove / }).click();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('0');
  await page.reload();
  await expect(page.locator('.store-line')).toHaveCount(0);
  checks.push('Removal persists; other Customer remains isolated');
  for (const [locale, width, theme] of [
    ['ar', 360, 'dark'],
    ['en', 1280, 'light'],
    ['ar', 390, 'system'],
  ]) {
    await page.goto(origin + '/' + locale);
    await capture(page, locale, width, theme, 'commerce-home');
    if (width < 768) {
      await page
        .getByRole('button', { name: locale === 'ar' ? 'القائمة' : 'Menu', exact: true })
        .click();
      await expect(
        page.locator('[role=dialog] a[href="/' + locale + '/store"]').first(),
      ).toBeVisible();
      await expect(page.locator('[role=dialog]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.cm-theme button').first()).toBeEnabled();
    }
    checkpoint = 'transport CTA ' + locale;
    const request = page.locator('.commerce-hero a[href="/' + locale + '/request"]').first();
    await request.click();
    await expect(page).toHaveURL(origin + '/' + locale + '/request');
  }
  checks.push('AR/EN RTL/LTR themes, compact mobile menu and existing Transport request route');
  checkpoint = 'paused Store';
  console.log('CHECKPOINT ' + checkpoint);
  sql(
    "update private.store_policy_versions set scope_paused=true,revision=revision+1 where kind='STOREFRONT_SCOPE' and organization_id='" +
      ledger.organization +
      "'",
  );
  await page.goto(origin + '/en');
  await expect(page.locator('.commerce-products .store-product')).toHaveCount(0);
  await expect(page.locator('.store-notice')).toContainText('Purchasing is currently unavailable');
  // Paused scope permits ownership-scoped cart reads, but product eligibility
  // prevents additions/checkout. Assert the mutation barrier rather than hiding history.
  const pausedCartResponse = await page.request.get(origin + '/api/store?kind=cart');
  if (!pausedCartResponse.ok()) throw Error('Owned cart read failed');
  const pausedCart = await pausedCartResponse.json();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('0');
  const denied = await page.request.post(origin + '/api/store', {
    headers: { Origin: origin },
    data: {
      action: 'cart',
      mutationId: randomUUID(),
      revision: pausedCart.revision,
      payload: {
        items: [
          { listingId: actual.items[0].listingId, revision: actual.items[0].revision, quantity: 1 },
        ],
      },
    },
  });
  if (denied.status() !== 409) throw Error('Paused product mutation was not denied');
  const afterDenied = await (await page.request.get(origin + '/api/store?kind=cart')).json();
  if (afterDenied.revision !== pausedCart.revision || afterDenied.items.length)
    throw Error('Paused product denial changed the cart');
  await capture(page, 'en', 1280, 'dark', 'commerce-paused');
  checks.push(
    'Paused Store hides products; server denies product mutation without changing owned cart',
  );
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
  if (!externalServer) await stopBrowserServer(server, 3017);
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
