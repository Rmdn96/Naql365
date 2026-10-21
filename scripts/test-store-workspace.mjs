// Real local Auth, private uploads and application commands. No cloud endpoints.
import { localSupabase } from './local-supabase.mjs';
import { execFileSync } from 'node:child_process';
import { assertBrowserPortFree, startBrowserServer, stopBrowserServer } from './browser-server.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { captureLovableComparisons } from './lovable-visual-evidence.mjs';
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
  if ((await fetch(origin + '/api/store?kind=cart')).status !== 401)
    throw Error('Existing server anonymous auth check failed');
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
const ledger = {
  organization: '91000000-0000-4000-8000-000000000001',
  users,
  cleanup: false,
  credentialReuseDenied: false,
};
const save = () => writeFileSync(output + '/ledger.json', JSON.stringify(ledger, null, 2));
const boundaries = [];
const recordBoundary = (event) => {
  boundaries.push({ elapsedMs: Date.now() - boundaryStart, checkpoint, ...event });
  writeFileSync(output + '/flow-boundaries.json', JSON.stringify(boundaries, null, 2));
};
const boundaryStart = Date.now();
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
  diagnosticPage,
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
  const navigation = page.locator('.store-nav a, .commerce-cart').first();
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
  if (!externalServer) {
    await assertBrowserPortFree(3017);
    checkpoint = 'build';
    console.log('CHECKPOINT ' + checkpoint);
    execFileSync(process.execPath, ['scripts/guarded-next.mjs', 'build'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 240000,
      maxBuffer: 16 * 1024 * 1024,
    });
    server = await startBrowserServer(env, 3017);
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
  browser = await chromium.launch();
  const customerContext = await browser.newContext(),
    financeContext = await browser.newContext();
  const page = await customerContext.newPage(),
    finance = await financeContext.newPage();
  diagnosticPage = finance;
  for (const observed of [page, finance]) {
    observed.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin !== origin) return;
      const path = url.pathname;
      const kind =
        path === '/api/store/catalog'
          ? 'catalog-command'
          : path === '/api/store'
            ? 'store-command'
            : /\/(ar|en)\/login$/.test(path)
              ? 'login'
              : /\/(ar|en)\/portal(?:\/|$)/.test(path)
                ? 'staff-page'
                : /\/(ar|en)\/store\/checkout$/.test(path)
                  ? 'checkout-page'
                  : null;
      if (
        kind &&
        (response.request().resourceType() === 'document' ||
          response.request().method() === 'POST' ||
          response.request().headers()['rsc'] === '1')
      )
        recordBoundary({
          layer: 'http',
          kind,
          status: response.status(),
          method: response.request().method(),
          nativeFormQuery: url.searchParams.has('slug') && url.searchParams.has('sku'),
          rsc: response.request().headers()['rsc'] === '1',
        });
    });
  }
  checkpoint = 'dynamic catalog management';
  console.log('CHECKPOINT ' + checkpoint);
  await login(finance, users[1], 'en');
  await finance.goto(origin + '/en/portal/store/catalog?kind=products');
  const creator = finance
    .locator('details')
    .filter({ has: finance.locator('summary', { hasText: 'Create draft' }) })
    .first();
  await creator.locator('summary').click();
  recordBoundary({
    layer: 'create-ready',
    hydrated: await creator.locator('form').evaluate((form) => {
      const key = Object.keys(form).find((name) => name.startsWith('__reactProps'));
      return !!key && typeof Reflect.get(form, key)?.onSubmit === 'function';
    }),
  });
  for (const [name, value] of Object.entries({
    slug: 'new-synthetic-product-31',
    sku: 'NEW-SYNTHETIC-31',
    title_ar: 'منتج جديد للاختبار',
    title_en: 'New synthetic product 31',
    category_id: '98000000-0000-4000-8000-000000000001',
    description_ar: 'اختبار فقط',
    description_en: 'Synthetic only',
  }))
    await creator.locator('[name="' + name + '"]').fill(value);
  const createdResponse = finance.waitForResponse(
    (response) =>
      response.url() === origin + '/api/store/catalog' && response.request().method() === 'POST',
  );
  const createdRefresh = finance.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/en/portal/store/catalog' &&
      response.request().headers()['rsc'] === '1',
  );
  await creator.getByRole('button', { name: 'Save', exact: true }).click();
  recordBoundary({
    layer: 'create-click',
    invalidFields: await creator.locator(':invalid').count(),
  });
  const created = await createdResponse;
  if (created.status() !== 200) throw Error('Product creation command rejected');
  // The mutation response and the matching server refresh precede the strict DOM check.
  if ((await createdRefresh).status() !== 200) throw Error('Product refresh rejected');
  await expect(
    finance.getByRole('heading', { name: 'New synthetic product 31', exact: true }),
  ).toBeVisible();
  recordBoundary({
    layer: 'create-rendered',
    persisted:
      sql("select count(*) from private.store_products where sku='NEW-SYNTHETIC-31'") === '1',
  });
  const newCard = finance.locator('section.card').filter({
    has: finance.getByRole('heading', { name: 'New synthetic product 31', exact: true }),
  });
  await newCard.getByText('Edit draft', { exact: true }).click();
  await newCard.locator('[name="title_en"]').fill('Edited synthetic product 31');
  const editedRefresh = finance.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/en/portal/store/catalog' &&
      response.request().headers()['rsc'] === '1',
  );
  await newCard.getByRole('button', { name: 'Save', exact: true }).first().click();
  if ((await editedRefresh).status() !== 200) throw Error('Product edit refresh rejected');
  await expect(
    finance.getByRole('heading', { name: 'Edited synthetic product 31', exact: true }),
  ).toBeVisible();
  checks.push('Staff creates and edits a product outside the initial 30 through the website');
  const catalogCommand = async (operation, payload, target, revision, family = 'draft') => {
    const response = await finance.request.post(origin + '/api/store/catalog', {
      headers: { Origin: origin },
      data: {
        family,
        operation,
        payload,
        mutationId: crypto.randomUUID(),
        ...(target ? { target, revision } : {}),
      },
    });
    if (!response.ok())
      throw Error('Catalog command unconfirmed: ' + operation + ' HTTP ' + response.status());
    return response.json();
  };
  const newId = sql("select id from private.store_products where sku='NEW-SYNTHETIC-31'");
  await catalogCommand('suspend_product', { reason: 'Synthetic pause' }, newId, 2, 'publication');
  await finance.goto(
    origin + '/en/portal/store/catalog?kind=products&search=Edited+synthetic&state=SUSPENDED',
  );
  await expect(finance.getByRole('heading', { name: 'Edited synthetic product 31' })).toBeVisible();
  checks.push('Staff suspension and server-side state/search filters');
  await catalogCommand('resume_product', { reason: 'Synthetic resume' }, newId, 3, 'publication');
  const newListing = await catalogCommand('create_listing', { product_id: newId });
  const newOffer = await catalogCommand(
    'create_offer',
    {
      product_id: newId,
      supplier_id: '97000000-0000-4000-8000-000000000001',
      agreement_id: '97000000-0000-4000-8000-000000000002',
      offer_key: 'new-31',
      version: 1,
      unit_cost_minor: 600,
      effective_from: '2026-01-01T00:00:00Z',
      evidence_ref: 'SYNTHETIC local only',
    },
    undefined,
    undefined,
    'sourcing',
  );
  await catalogCommand('approve_offer', {}, newOffer.id, 1, 'sourcing');
  const initialRetail = await catalogCommand('create_price', {
    listing_id: newListing.id,
    version: 1,
    amount_minor: 1000,
    presentation_policy_id: '96000000-0000-4000-8000-000000000003',
    effective_from: '2026-01-01T00:00:00Z',
  });
  await catalogCommand('approve_price', {}, initialRetail.id, 1, 'publication');
  const publicationTerms = {
    product_revision: 4,
    category_revision: 1,
    offer_id: newOffer.id,
    offer_revision: 2,
    identity_policy_id: '96000000-0000-4000-8000-000000000002',
    identity_policy_revision: 1,
    delivery_policy_id: '96000000-0000-4000-8000-000000000004',
    delivery_policy_revision: 1,
    returns_policy_id: '96000000-0000-4000-8000-000000000005',
    returns_policy_revision: 1,
  };
  await catalogCommand(
    'publish_listing',
    { ...publicationTerms, price_id: initialRetail.id, price_revision: 2 },
    newListing.id,
    1,
    'publication',
  );
  await catalogCommand(
    'suspend_product',
    { reason: 'Only the new run-owned product is on sale in this isolated test' },
    '98000000-0000-4000-8000-000000000002',
    1,
    'publication',
  );

  checkpoint = 'product media upload';
  console.log('CHECKPOINT ' + checkpoint);
  await finance.goto(origin + '/en/portal/store/catalog?kind=listings&search=Edited+synthetic');
  await finance.getByText('Product images and order', { exact: true }).click();
  await finance.locator('input[type=file]').setInputFiles({
    name: 'synthetic-product.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 120, height: 100, channels: 3, background: '#bc955f' } })
      .png()
      .toBuffer(),
  });
  await finance.locator('input[name=rightsReference]').fill('SYNTHETIC generated local test image');
  const firstUpload = finance.waitForResponse(
    (response) =>
      response.url() === origin + '/api/store/media' && response.request().method() === 'POST',
  );
  await finance.getByRole('button', { name: 'Upload image', exact: true }).click();
  const firstUploadResponse = await firstUpload;
  if (!firstUploadResponse.ok()) throw Error('Product upload HTTP ' + firstUploadResponse.status());
  await expect(finance.getByRole('link', { name: 'Preview', exact: true })).toBeVisible();
  await finance.getByLabel('الوصف البديل العربي', { exact: true }).fill('صندوق تجريبي');
  await finance.getByLabel('English alternative text', { exact: true }).fill('Synthetic carton');
  await finance.locator('input[type=file]').setInputFiles({
    name: 'second-synthetic.png',
    mimeType: 'image/png',
    buffer: await sharp({ create: { width: 100, height: 120, channels: 3, background: '#d9bb8c' } })
      .png()
      .toBuffer(),
  });
  await finance.getByRole('button', { name: 'Upload image', exact: true }).click();
  await expect(finance.getByRole('link', { name: 'Preview', exact: true })).toHaveCount(2);
  await finance.reload();
  await finance.getByText('Product images and order', { exact: true }).click();
  await expect(
    finance.getByRole('button', { name: 'Select uploaded draft', exact: true }),
  ).toHaveCount(2);
  await finance.getByRole('button', { name: 'Select uploaded draft', exact: true }).last().click();
  await finance.getByRole('button', { name: 'Select uploaded draft', exact: true }).click();
  await finance.getByLabel('الوصف البديل العربي', { exact: true }).nth(0).fill('صندوق تجريبي');
  await finance
    .getByLabel('English alternative text', { exact: true })
    .nth(0)
    .fill('Synthetic carton');
  await finance
    .getByLabel('الوصف البديل العربي', { exact: true })
    .nth(1)
    .fill('زاوية ثانية تجريبية');
  await finance
    .getByLabel('English alternative text', { exact: true })
    .nth(1)
    .fill('Second synthetic view');
  checks.push('Unpublished uploaded images survive reload for governed publisher selection');
  await finance.getByRole('button', { name: 'Move up', exact: true }).nth(1).click();
  const publication = finance.waitForResponse(
    (response) =>
      response.url() === origin + '/api/store/catalog' &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.operation === 'attach_media',
  );
  await finance.getByRole('button', { name: 'Approve images and order', exact: true }).click();
  const publicationResponse = await publication;
  if (!publicationResponse.ok())
    throw Error('Image approval failed HTTP ' + publicationResponse.status());
  if (
    sql(
      "select revision from private.store_product_market_listings where id='" + newListing.id + "'",
    ) !== '3'
  )
    throw Error('Image approval revision unconfirmed');
  const mediaId = sql(
    "select id from private.store_product_media where status='READY' order by created_at limit 1",
  );
  const mediaResponse = await finance.request.get(origin + '/api/store/media/' + mediaId);
  if (!mediaResponse.ok() || !mediaResponse.headers()['content-type']?.startsWith('image/webp'))
    throw Error('Product image did not render');
  checks.push('Authorized normalized product-image upload, rights reference and publication');
  checkpoint = 'Customer password login';
  console.log('CHECKPOINT ' + checkpoint);
  await login(page, users[0], 'en');
  await page.goto(origin + '/en/store');
  await expect(page.getByRole('heading', { name: 'Edited synthetic product 31' })).toBeVisible();
  await expect(page.locator('.store-product img')).toHaveCount(1);
  await expect(page.locator('.store-product img')).toHaveAttribute('alt', 'Second synthetic view');
  await page.goto(origin + '/en/store/products/new-synthetic-product-31');
  await expect(page.locator('.cm-gallery .cm-thumbs button')).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator('.cm-gallery img')
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
    )
    .toBe(true);
  await capture(page, 'en', 1280, 'light', 'product-detail-images');
  await page.goto(origin + '/ar/store/products/new-synthetic-product-31');
  await expect(page.locator('.cm-gallery > img')).toHaveAttribute('alt', 'زاوية ثانية تجريبية');
  await capture(page, 'ar', 390, 'dark', 'product-detail-images');
  await page.goto(origin + '/en/store');
  checks.push(
    'Catalog/detail images render in approved order; bilingual alt metadata and no broken images',
  );
  await capture(page, 'en', 1280, 'light', 'catalog');
  checkpoint = 'cart';
  console.log('CHECKPOINT ' + checkpoint);
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.locator('.commerce-cart-badge')).toHaveText('1');
  await page.goto(origin + '/en/store/cart');
  await expect(page.locator('.store-line')).toHaveCount(1);
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  checkpoint = 'checkout navigation';
  console.log('CHECKPOINT ' + checkpoint);
  await page.waitForURL(origin + '/en/store/checkout');
  await expect(page).toHaveURL(origin + '/en/store/checkout');
  await expect(page.locator('#store-name')).toBeVisible();
  await expect(page.locator('#store-name')).toBeEditable();
  await capture(page, 'en', 390, 'dark', 'checkout');
  await captureLovableComparisons({
    phase: 'cart',
    page,
    finance,
    output,
    productSlug: 'new-synthetic-product-31',
  });
  await page.goto(origin + '/en/store/checkout');
  await expect(page.locator('#store-name')).toBeEditable();
  await page.locator('#store-name').fill('SYNTHETIC Customer');
  await page.locator('#store-phone').fill('SYNTHETIC');
  await page.locator('#store-region').selectOption('SYNTHETIC-REGION');
  await page.locator('#store-address').fill('Synthetic address only');
  await page.locator('#store-method input[value="VODAFONE_CASH"]').check();
  await page.locator('#destination').selectOption('99000000-0000-4000-8000-000000000002');
  await page.locator('.store-check input').check();
  checkpoint = 'place order';
  console.log('CHECKPOINT ' + checkpoint);
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/store\/orders\/[a-f0-9-]+$/, { timeout: 20000 });
  const id = new URL(page.url()).pathname.split('/').at(-1);
  await captureLovableComparisons({
    phase: 'order',
    page,
    finance,
    output,
    productSlug: 'new-synthetic-product-31',
    orderId: id,
  });
  await page.goto(origin + '/en/store/orders/' + id);
  await expect(page.locator('.cm-order-detail')).toBeVisible();
  checkpoint = 'order snapshot preservation';
  console.log('CHECKPOINT ' + checkpoint);
  const oldSnapshot = sql(
    "select to_jsonb(i)::text from private.store_order_items i where order_id='" + id + "'",
  );
  const price = await catalogCommand('create_price', {
    listing_id: newListing.id,
    version: 2,
    amount_minor: 1400,
    presentation_policy_id: '96000000-0000-4000-8000-000000000003',
    effective_from: '2026-01-01T00:00:00Z',
  });
  const saved = await catalogCommand(
    'save_price',
    {
      amount_minor: 1600,
      presentation_policy_id: '96000000-0000-4000-8000-000000000003',
      effective_from: '2026-01-01T00:00:00Z',
    },
    price.id,
    price.revision,
  );
  await catalogCommand('approve_price', {}, price.id, saved.revision, 'publication');
  await catalogCommand(
    'publish_listing',
    { ...publicationTerms, price_id: price.id, price_revision: 3 },
    newListing.id,
    3,
    'publication',
  );
  if (
    sql("select to_jsonb(i)::text from private.store_order_items i where order_id='" + id + "'") !==
    oldSnapshot
  )
    throw Error('Historical order snapshot changed');
  checks.push('New approved retail version leaves placed order snapshots byte-identical');
  await page.reload();
  await expect(page.getByText('Pending', { exact: true })).toBeVisible();
  checks.push('registered Customer checkout and refresh');
  checkpoint = 'proof upload';
  console.log('CHECKPOINT ' + checkpoint);
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
  console.log('CHECKPOINT ' + checkpoint);
  const stranger = await browser.newContext(),
    other = await stranger.newPage();
  await login(other, users[3], 'en');
  const denied = await other.request.get(origin + '/api/store?kind=order&target=' + id);
  if (denied.status() !== 403) throw Error('Other Customer order not denied');
  await stranger.close();
  checkpoint = 'Finance password login';
  console.log('CHECKPOINT ' + checkpoint);
  await finance.goto(origin + '/en/login');
  await expect(finance).toHaveURL(/\/en\/portal$/);
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
  console.log('CHECKPOINT ' + checkpoint);
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
  await page.waitForURL(/\/en\/account/);
  await expect(page).toHaveURL(/\/en\/account/);
  checks.push('Customer direct login recognizes session');
  await finance.goto(origin + '/en/login');
  // The login route can stream a server redirect; await that navigation before
  // asserting its exact destination, rather than treating the shell as settled.
  await finance.waitForURL(origin + '/en/portal');
  await expect(finance).toHaveURL(/\/en\/portal$/);
  checks.push('Staff direct login recognizes session');
  await catalogCommand(
    'suspend_product',
    { reason: 'Synthetic final pause' },
    newId,
    4,
    'publication',
  );
  if (
    sql("select to_jsonb(i)::text from private.store_order_items i where order_id='" + id + "'") !==
    oldSnapshot
  )
    throw Error('Pause altered historical order snapshot');
  sql(
    "update private.store_policy_versions set scope_paused=true,revision=revision+1 where kind='STOREFRONT_SCOPE' and organization_id='" +
      ledger.organization +
      "'",
  );
  if ((await page.request.get(origin + '/api/store/media/' + mediaId)).status() !== 404)
    throw Error('Paused product media remained public');
  checks.push('Paused scope revokes Customer product-image access');
  await customerContext.close();
  await financeContext.close();
} catch (error) {
  let freshPageHasCreatedProduct = null;
  if (seeded && diagnosticPage) {
    const fresh = await diagnosticPage.request.get(
      origin + '/en/portal/store/catalog?kind=products',
    );
    freshPageHasCreatedProduct =
      fresh.ok() && (await fresh.text()).includes('New synthetic product 31');
  }
  recordBoundary({
    layer: 'failure',
    freshPageHasCreatedProduct,
    nativeFormQuery: diagnosticPage ? new URL(diagnosticPage.url()).searchParams.has('sku') : false,
    assertion:
      error instanceof Error && error.message.includes('toHaveURL')
        ? 'route'
        : error instanceof Error && error.message.includes('toBeVisible')
          ? 'visibility'
          : 'other',
    createdProductPersisted:
      seeded &&
      sql("select count(*) from private.store_products where sku='NEW-SYNTHETIC-31'") === '1',
    createdHeadingVisible: diagnosticPage
      ? await diagnosticPage
          .getByRole('heading', { name: 'New synthetic product 31', exact: true })
          .isVisible()
          .catch(() => false)
      : false,
    errorFeedbackVisible: diagnosticPage
      ? await diagnosticPage
          .getByText('Change unconfirmed. Review the current state before retrying.', {
            exact: true,
          })
          .isVisible()
          .catch(() => false)
      : false,
  });
  console.error(
    'Store local failure at ' +
      checkpoint +
      ': ' +
      (error instanceof Error ? error.message : 'unknown'),
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (!externalServer) await stopBrowserServer(server, 3017);
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
