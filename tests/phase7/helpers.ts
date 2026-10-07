import { stage1Capture } from '../helpers/stage1-evidence';
import { appendFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '../staging/fixtures';
import { admin, org, login, axe, identities, op } from '../phase4/helpers';
import { guestDictionary } from '../../src/i18n/guest';
import { customerDictionary } from '../../src/i18n/customer';
import { publicDictionary } from '../../src/i18n/public';
import { quotesDictionary } from '../../src/i18n/quotes';
import { driverDictionary } from '../../src/i18n/driver';
import { dictionary } from '../../src/i18n/dictionaries';
import { marketDate } from '../../src/domain/markets/model';
import { driverLogin, uiAction } from '../helpers/driver-journey';
import sharp from 'sharp';

export async function guestResponsiveCheck(page: Page) {
  const viewport = page.viewportSize();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await axe(page);
  }
  if (viewport) await page.setViewportSize(viewport);
}

export async function guestQuote(page: Page, staff: Page, country: 'SA' | 'EG') {
  const locale = country === 'SA' ? 'ar' : 'en';
  const ct = customerDictionary(locale),
    gt = guestDictionary(locale),
    pt = publicDictionary(locale),
    qt = quotesDictionary(locale);
  const market = (
    await admin
      .from('markets')
      .select('id,currency,timezone')
      .eq('organization_id', org)
      .eq('country_code', country)
      .single()
  ).data!;
  const cityId = (
    await admin
      .from('market_cities')
      .select('id')
      .eq('market_id', market.id)
      .eq('code', country === 'SA' ? 'riyadh' : 'cairo')
      .single()
  ).data!.id;
  const service = (
    await admin
      .from('services')
      .select('id')
      .eq('organization_id', org)
      .eq('code', 'furniture')
      .single()
  ).data!.id;
  await page.goto(`/${locale}`);
  await page.getByLabel(pt.country).selectOption(country);
  await page.locator('#quick-service').selectOption(service);
  await page.locator('#quick-pickupCity').selectOption(cityId);
  await page.locator('#quick-deliveryCity').selectOption(cityId);
  await page.getByRole('button', { name: pt.quickAction, exact: true }).click();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  // Record only a one-way verifier before sending, so cleanup also finds a
  // committed creation whose HTTP response was lost. Never persist the capability.
  await page.route('**/api/guest/start', async (route) => {
    const input = route.request().postDataJSON() as { creationToken: string };
    const ledger = process.env.STAGING_PHASE7_FIXTURE_LEDGER;
    if (!ledger || !/^g1_[a-f0-9]{64}$/.test(input.creationToken))
      throw Error('Invalid guest fixture setup');
    appendFileSync(
      ledger,
      JSON.stringify({ verifier: createHash('sha256').update(input.creationToken).digest('hex') }) +
        '\n',
    );
    await route.fallback();
  });
  const responsePromise = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/guest/start' && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: gt.start, exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const result = (await response.json()) as { token: string; request: { id: string } };
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === '__Host-naql365_guest',
  );
  expect(
    Boolean(
      cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict' && cookie.path === '/',
    ),
  ).toBe(true);
  if (!/^[a-f0-9-]{36}$/.test(result.request.id) || !process.env.STAGING_PHASE7_FIXTURE_LEDGER)
    throw Error('Missing guest fixture ledger');
  appendFileSync(
    process.env.STAGING_PHASE7_FIXTURE_LEDGER,
    JSON.stringify({ requestId: result.request.id }) + '\n',
  );
  const requestId = result.request.id;
  await page.getByRole('button', { name: gt.proceed, exact: true }).click();
  await expect(page.locator('#service')).toHaveValue(service);
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await guestResponsiveCheck(page);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await expect(page.locator(`#${kind}-city`)).toHaveValue(cityId);
    await page.locator(`#${kind}-address`).fill('TEST disposable ' + kind);
  }
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#description').fill('PHASE7 TEST ONLY');
  await page.getByRole('button', { name: ct.addItem, exact: true }).click();
  await page.locator('#item-0').fill('TEST box');
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-floor`).fill('0');
    await page.locator(`#${kind}-elevator`).selectOption('true');
  }
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#date').fill(marketDate(new Date(Date.now() + 86400000), market.timezone));
  await page.locator('#time-window').selectOption('flexible');
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#contact_name').fill('PHASE7 TEST guest');
  await page.locator('#contact_phone').fill(country === 'SA' ? '+966500000001' : '+201000000001');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.submit, exact: true }).click();
  await expect(page.getByRole('heading', { name: gt.received, exact: true })).toBeVisible();
  const request = (
    await admin.from('requests').select('reference,customer_id').eq('id', requestId).single()
  ).data!;
  expect(
    (
      await admin
        .from('customers')
        .select('profile_id,identity_kind')
        .eq('id', request.customer_id)
        .single()
    ).data,
  ).toEqual({ profile_id: null, identity_kind: 'GUEST' });
  await login(staff, 'sales', locale);
  await staff.goto(`/${locale}/portal/quotes/${requestId}`);
  await staff.locator('#distance').fill('18.750');
  await staff.locator('#source-note').fill('TEST verified distance');
  const mode = await admin
    .from('pricing_settings')
    .select('pricing_mode')
    .eq('organization_id', org)
    .eq('market_id', market.id)
    .single();
  expect(mode.error).toBeNull();
  expect(mode.data?.pricing_mode).toBe('MANUAL');
  await expect(staff.getByRole('button', { name: qt.calculate, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(gt.review, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: gt.preliminary, exact: true })).toHaveCount(0);
  await staff.locator('#manual-subtotal').fill('123.45');
  await staff.getByRole('button', { name: qt.createDraft, exact: true }).click();
  await staff.getByRole('button', { name: qt.sendQuote, exact: true }).click();
  await expect(staff.getByRole('button', { name: qt.sendQuote, exact: true })).toBeHidden();
  const quote = (
    await admin
      .from('quotes')
      .select('quote_versions(id,status)')
      .eq('request_id', requestId)
      .single()
  ).data!;
  const versionId = quote.quote_versions.find((v) => v.status === 'SENT')!.id;
  await page.goto(`/${locale}/guest/quotes/${versionId}`);
  await guestResponsiveCheck(page);
  return {
    locale: locale as 'ar' | 'en',
    country,
    market,
    cityId,
    requestId,
    versionId,
    token: result.token,
    reference: request.reference,
  };
}

export async function acceptGuest(page: Page, versionId: string, locale: 'ar' | 'en') {
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: quotesDictionary(locale).accept, exact: true }).click();
  await expect(page).toHaveURL(/\/guest\/orders\/[a-f0-9-]+\/payment$/);
  const orders = await admin.from('orders').select('id').eq('accepted_quote_version_id', versionId);
  expect(orders.error).toBeNull();
  expect(orders.data).toHaveLength(1);
  return orders.data![0]!.id;
}

export async function executeDelivery(
  staff: Page,
  orderId: string,
  country: 'SA' | 'EG',
  marketId: string,
  cityId: string,
) {
  const locale = country === 'SA' ? 'ar' : 'en';
  await login(staff, 'operations', locale);
  const job = await op(staff, 'create_job', orderId),
    trip = await op(staff, 'create_trip', job);
  const driver = await op(staff, 'create_driver', org, {
    marketId,
    type: 'INTERNAL',
    name: 'PHASE7 TEST DRIVER',
  });
  const role = country === 'SA' ? 'saDriverA' : 'egDriverA';
  expect(
    (await admin.from('drivers').update({ profile_id: identities[role]!.id }).eq('id', driver))
      .error,
  ).toBeNull();
  const vehicle = await op(staff, 'create_vehicle', org, {
    marketId,
    type: 'Truck',
    identifier: 'P7-' + randomUUID().slice(0, 8),
  });
  await op(staff, 'plan', trip, {
    plannedStart: new Date(Date.now() + 3600000).toISOString(),
    plannedEnd: new Date(Date.now() + 7200000).toISOString(),
    stops: [
      { cityId, kind: 'PICKUP', address: 'TEST pickup', pickups: [] },
      { cityId, kind: 'DELIVERY', address: 'TEST delivery', pickups: [0] },
    ],
  });
  await op(staff, 'assign', trip, { driverId: driver, vehicleId: vehicle });
  await op(staff, 'ready', trip);
  await driverLogin(staff, role, locale);
  await staff.goto(`/${locale}/driver/trips/${trip}`);
  await staff.setViewportSize({ width: 390, height: 844 });
  await stage1Capture(staff, `driver-${country.toLowerCase()}-${locale}-mobile`);
  await uiAction(staff, trip, 'dispatch', locale);
  for (let n = 0; n < 2; n++) {
    if (n) await uiAction(staff, trip, 'depart', locale);
    await uiAction(staff, trip, 'arrive', locale);
    await uiAction(staff, trip, 'start_service', locale);
    await uiAction(staff, trip, 'complete_stop', locale);
  }
  await staff.locator('#pod-recipient').fill('PHASE7 TEST recipient');
  const buffer = await sharp({
    create: { width: 64, height: 32, channels: 3, background: '#123456' },
  })
    .png()
    .toBuffer();
  await staff
    .locator('#pod-file')
    .setInputFiles({ name: 'test-signature.png', mimeType: 'image/png', buffer });
  await staff
    .getByRole('button', { name: driverDictionary(locale).submitPod, exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await admin.from('trip_pods').select('state').eq('trip_id', trip).single()).data?.state,
    )
    .toBe('FINAL');
  await uiAction(staff, trip, 'complete_trip', locale);
  expect(
    (await admin.from('orders').select('operational_status').eq('id', orderId).single()).data
      ?.operational_status,
  ).toBe('COMPLETED');
  await staff.goto(`/${locale}`);
  await staff.goto(`/${locale}/login`);
  await expect(staff).toHaveURL(new RegExp(`/${locale}/driver$`));
  await staff.reload();
  await staff.getByRole('button', { name: dictionary(locale).logout, exact: true }).click();
  await expect(staff).toHaveURL(new RegExp(`/${locale}/login$`));
  await staff.goto(`/${locale}/driver`);
  await expect(staff).toHaveURL(new RegExp(`/${locale}/login$`));
  return trip;
}
