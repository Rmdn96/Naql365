import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';
import { quotesDictionary } from '../../src/i18n/quotes';
import { operationsDictionary, operationLabel } from '../../src/i18n/operations';
import { riyadhDate } from '../../src/domain/requests/intake';
import type { Page } from '@playwright/test';
import type { OperationAction } from '../../src/domain/operations/model';
function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error('Missing guarded ' + key);
  return value;
}
const org = required('STAGING_PHASE3_ORG');
const identities = JSON.parse(required('STAGING_PHASE3_IDENTITIES')) as Record<
  string,
  { email: string; password: string; id: string }
>;
const admin = createClient(required('STAGING_TEST_API_URL'), required('STAGING_TEST_ADMIN_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function login(page: Page, role: string, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(identities[role]!.email);
  await page.locator('#password').fill(identities[role]!.password);
  await page.getByRole('button', { name: customerDictionary(locale).login, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/(account|portal)$`));
}
async function logout(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/account`);
  await page.getByRole('button', { name: customerDictionary(locale).logout, exact: true }).click();
}
async function axe(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function op(
  page: Page,
  action: OperationAction,
  entityId: string,
  payload: unknown = {},
  expected = 200,
) {
  let revision = 0;
  if (action === 'create_trip') {
    const r = await admin.from('jobs').select('revision').eq('id', entityId).single();
    expect(r.error).toBeNull();
    revision = r.data!.revision;
  } else if (!['create_job', 'create_driver', 'create_vehicle'].includes(action)) {
    const r = await admin.from('trips').select('revision').eq('id', entityId).maybeSingle();
    revision = r.data?.revision ?? 0;
  }
  const result = await page.evaluate(
    async (body) => {
      const r = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: (await r.json()) as { id?: string; revision?: number } };
    },
    { organizationId: org, entityId, revision, action, payload, mutationId: randomUUID() },
  );
  expect(result.status).toBe(expected);
  return result.data.id!;
}
test('hosted intake to multi-trip dispatch, private POD and whole-Order completion', async ({
  page,
}) => {
  const ct = customerDictionary('ar'),
    qt = quotesDictionary('ar'),
    ot = operationsDictionary('ar');
  await login(page, 'customer');
  if (await page.locator('#name').count()) {
    await page.locator('#name').fill('Phase 3 controlled customer');
    await page.locator('#phone').fill('+966500000001');
    await page.getByRole('button', { name: ct.saveProfile, exact: true }).click();
  }
  await page.getByRole('button', { name: ct.start, exact: true }).click();
  await expect(page).toHaveURL(/\/request\/[a-f0-9-]+$/);
  const requestId = page.url().split('/').at(-1)!;
  await page.locator('#service').selectOption({ label: 'نقل الأثاث' });
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-city`).fill('Riyadh');
    await page.locator(`#${kind}-district`).fill('Controlled district');
    await page.locator(`#${kind}-address`).fill('Harmless ' + kind);
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#description').fill('Phase 3 disposable acceptance');
  await page.getByRole('button', { name: ct.addItem, exact: true }).click();
  await page.locator('#item-0').fill('Box');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  for (const kind of ['pickup', 'delivery']) {
    await page.locator(`#${kind}-floor`).fill('0');
    await page.locator(`#${kind}-elevator`).selectOption('true');
  }
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#date').fill(riyadhDate(new Date(Date.now() + 86400000)));
  await page.locator('#time-window').selectOption('flexible');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.locator('#contact_name').fill('Controlled recipient');
  await page.locator('#contact_phone').fill('+966500000001');
  await page.locator('#contact_email').fill('fixture@example.invalid');
  await expect(page.locator('.save-status')).toHaveText(ct.saved);
  await page.getByRole('button', { name: ct.next, exact: true }).click();
  await page.getByRole('button', { name: ct.submit, exact: true }).click();
  await expect(page).toHaveURL(/account\/requests/);
  await logout(page);
  await login(page, 'sales');
  await page.goto(`/ar/portal/quotes/${requestId}`);
  await page.locator('#distance').fill('18.750');
  await page.locator('#source-note').fill('Controlled verified road distance');
  await page.locator('#vehicle').selectOption({ label: 'شاحنة صغيرة' });
  await page.locator('#workers').fill('2');
  await page.getByRole('button', { name: qt.calculate, exact: true }).click();
  await expect(page.getByRole('heading', { name: qt.calculated, exact: true })).toBeVisible();
  await page.getByRole('button', { name: qt.createDraft, exact: true }).click();
  await page.getByRole('button', { name: qt.sendQuote, exact: true }).click();
  const version = await admin
    .from('quotes')
    .select('quote_versions(id,status)')
    .eq('request_id', requestId)
    .single();
  expect(version.error).toBeNull();
  const versionId = version.data!.quote_versions.find((v) => v.status === 'SENT')!.id;
  await logout(page);
  await login(page, 'customer');
  await page.goto(`/ar/account/quotes/${versionId}`);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: qt.accept, exact: true }).click();
  await expect(page.getByRole('button', { name: qt.accept, exact: true })).toBeHidden();
  const order = await admin
    .from('orders')
    .select('*')
    .eq('accepted_quote_version_id', versionId)
    .single();
  expect(order.error).toBeNull();
  const orderId = order.data!.id;
  await op(page, 'create_job', orderId, {}, 403);
  await logout(page);
  await login(page, 'sales');
  await op(page, 'create_job', orderId, {}, 403);
  await logout(page);
  await login(page, 'operations');
  await page.goto('/ar/portal/operations');
  await axe(page);
  await page
    .locator('li')
    .filter({ hasText: order.data!.reference! })
    .getByRole('button', { name: ot.createJob, exact: true })
    .click();
  await expect(page).toHaveURL(/operations\/jobs\//);
  const jobId = page.url().split('/').at(-1)!;
  const trip1 = await op(page, 'create_trip', jobId);
  const trip2 = await op(page, 'create_trip', jobId);
  const d1 = await op(page, 'create_driver', jobId, {
      type: 'INTERNAL',
      name: 'Phase 3 internal fixture',
    }),
    d2 = await op(page, 'create_driver', jobId, {
      type: 'EXTERNAL',
      name: 'Phase 3 external fixture',
    });
  const v1 = await op(page, 'create_vehicle', jobId, {
      type: 'Truck',
      identifier: 'P3-' + randomUUID(),
    }),
    v2 = await op(page, 'create_vehicle', jobId, {
      type: 'Truck',
      identifier: 'P3-' + randomUUID(),
    });
  const plan = {
    plannedStart: new Date(Date.now() + 3600000).toISOString(),
    plannedEnd: new Date(Date.now() + 18000000).toISOString(),
    stops: [
      { kind: 'PICKUP', address: 'Fixture pickup 1', pickups: [] },
      { kind: 'PICKUP', address: 'Fixture pickup 2', pickups: [] },
      { kind: 'DELIVERY', address: 'Fixture delivery 1', pickups: [0, 1] },
      { kind: 'DELIVERY', address: 'Fixture delivery 2', pickups: [1] },
    ],
  };
  for (const trip of [trip1, trip2]) {
    await op(page, 'plan', trip, plan);
    await op(page, 'assign', trip, { driverId: d1, vehicleId: v1 });
    await op(page, 'ready', trip);
  }
  await op(page, 'dispatch', trip1);
  await op(page, 'dispatch', trip2, {}, 409);
  await page.goto(`/ar/portal/operations/trips/${trip1}`);
  await page.getByRole('button', { name: ot.emergency, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await axe(page);
  await page.locator('#assign-driver').selectOption(d2);
  await page.locator('#assign-vehicle').selectOption(v2);
  await page.locator('#emergency-reason').fill('Controlled emergency replacement');
  await page.getByRole('button', { name: ot.confirm, exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await op(page, 'dispatch', trip2);
  for (const trip of [trip1, trip2]) {
    const stops = await admin
      .from('trip_stops')
      .select('id,position')
      .eq('trip_id', trip)
      .order('position');
    expect(stops.error).toBeNull();
    await op(page, 'complete_stop', trip, { stopId: stops.data![2]!.id }, 400);
    for (const stop of stops.data!) {
      if (stop.position) await op(page, 'depart', trip, { stopId: stop.id });
      await op(page, 'arrive', trip, { stopId: stop.id });
      await op(page, 'start_service', trip, { stopId: stop.id });
      await op(page, 'complete_stop', trip, { stopId: stop.id });
    }
    await op(page, 'complete_trip', trip, {}, 400);
    await page.goto(`/ar/portal/operations/trips/${trip}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await axe(page);
    await page.locator('#pod-recipient').fill('Controlled recipient');
    const signature = await sharp({
      create: { width: 120, height: 40, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    await page
      .locator('#pod-signature')
      .setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: signature });
    await page.getByRole('button', { name: ot.capture, exact: true }).click();
    await expect(page.getByRole('button', { name: ot.viewSignature, exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: operationLabel('complete_trip', 'ar'), exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: operationLabel('complete_trip', 'ar'), exact: true }),
    ).toBeHidden();
    const state = await admin.from('jobs').select('status').eq('id', jobId).single();
    expect(state.data?.status).toBe(trip === trip1 ? 'IN_PROGRESS' : 'COMPLETED');
  }
  const final = await admin.from('orders').select('*').eq('id', orderId).single();
  for (const key of [
    'total_minor',
    'subtotal_minor',
    'vat_amount_minor',
    'distance_km',
    'accepted_quote_version_id',
  ] as const)
    expect(final.data?.[key]).toBe(order.data?.[key]);
  expect(final.data?.operational_status).toBe('COMPLETED');
  await logout(page);
  await login(page, 'customer', 'en');
  await page.goto(`/en/account/orders/${orderId}`);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await axe(page);
  await expect(page.locator('main')).not.toContainText('Controlled emergency replacement');
  await expect(page.locator('main')).not.toContainText('Phase 3 external fixture');
  await logout(page, 'en');
  await login(page, 'peer', 'en');
  expect((await page.goto(`/en/account/orders/${orderId}`))?.status()).toBe(404);
});
