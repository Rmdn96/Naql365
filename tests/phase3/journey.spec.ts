import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { test, expect } from '../staging/fixtures';
import { customerDictionary } from '../../src/i18n/customer';
import { dictionary } from '../../src/i18n/dictionaries';
import { quotesDictionary } from '../../src/i18n/quotes';
import { operationsDictionary, operationLabel } from '../../src/i18n/operations';
import { marketDate } from '../../src/domain/markets/model';
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
const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
const admin = createClient(required('STAGING_TEST_API_URL'), required('STAGING_TEST_ADMIN_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: boundedFetch },
});
async function login(page: Page, role: string, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(identities[role]!.email);
  await page.locator('#password').fill(identities[role]!.password);
  await page.getByRole('button', { name: customerDictionary(locale).login, exact: true }).click();
  try {
    await expect(page).toHaveURL(new RegExp(`/${locale}/(account|portal)$`));
  } catch (error) {
    test.info().annotations.push({
      type: 'safe-security-probe',
      description: `login-error-visible=${await page.getByText(customerDictionary(locale).authError, { exact: true }).isVisible()}; login-route=${new URL(page.url()).pathname === `/${locale}/login`}`,
    });
    throw error;
  }
}
async function logout(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/account`);
  await page.getByRole('button', { name: customerDictionary(locale).logout, exact: true }).click();
}
async function axe(page: Page) {
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function principal(role: string) {
  const client = createClient(
    required('STAGING_TEST_API_URL'),
    required('STAGING_TEST_PUBLIC_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: boundedFetch } },
  );
  const signed = await client.auth.signInWithPassword(identities[role]!);
  expect(signed.error).toBeNull();
  return client;
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
  if (result.status !== expected)
    test.info().annotations.push({
      type: 'safe-security-probe',
      description: JSON.stringify({ action, expected, status: result.status }),
    });
  expect(result.status).toBe(expected);
  return result.data.id!;
}
for (const country of ['SA', 'EG'] as const)
  test(`hosted ${country} intake to multi-trip dispatch, private POD and whole-Order completion`, async ({
    page,
  }) => {
    const ct = customerDictionary('ar'),
      qt = quotesDictionary('ar'),
      ot = operationsDictionary('ar');
    const marketResult = await admin
      .from('markets')
      .select('id,currency,timezone,name_ar,name_en')
      .eq('organization_id', org)
      .eq('country_code', country)
      .single();
    expect(marketResult.error).toBeNull();
    const market = marketResult.data!;
    const cityResult = await admin
      .from('market_cities')
      .select('id')
      .eq('market_id', market.id)
      .eq('code', country === 'SA' ? 'riyadh' : 'cairo')
      .single();
    expect(cityResult.error).toBeNull();
    const cityId = cityResult.data!.id;
    await login(page, 'customer');
    // The runner always creates a fresh customer. Await onboarding hydration before continuing.
    await page.locator('#name').fill('Phase 3 controlled customer');
    await page.locator('#phone').fill(country === 'SA' ? '+966500000001' : '+201000000001');
    await page.getByRole('button', { name: ct.saveProfile, exact: true }).click();
    await page.locator('#request-market').focus();
    await expect(page.locator('#request-market')).toBeFocused();
    await page.locator('#request-market').press('Tab');
    await axe(page);
    await page.locator('#request-market').selectOption(market.id);
    await page.getByRole('button', { name: ct.start, exact: true }).click();
    await expect(page).toHaveURL(/\/request\/[a-f0-9-]+$/);
    const requestId = page.url().split('/').at(-1)!;
    await page.goto('/en/request/' + requestId);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('main')).toContainText(market.name_en);
    await expect(page.locator('main')).toContainText(market.currency);
    await axe(page);
    await page.goto('/ar/request/' + requestId);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('#service').selectOption({ label: 'نقل الأثاث' });
    await expect(page.locator('.save-status')).toHaveText(ct.saved);
    await page.getByRole('button', { name: ct.next, exact: true }).click();
    for (const kind of ['pickup', 'delivery']) {
      await page.locator(`#${kind}-city`).selectOption(cityId);
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
    await page.locator('#date').fill(marketDate(new Date(Date.now() + 86400000), market.timezone));
    await page.locator('#time-window').selectOption('flexible');
    await expect(page.locator('.save-status')).toHaveText(ct.saved);
    await page.getByRole('button', { name: ct.next, exact: true }).click();
    await page.locator('#contact_name').fill('Controlled recipient');
    await page.locator('#contact_phone').fill(country === 'SA' ? '0500000001' : '01000000001');
    await page.locator('#contact_email').fill('fixture@example.invalid');
    await expect(page.locator('#contact_phone')).toHaveValue(
      country === 'SA' ? '+966500000001' : '+201000000001',
    );
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
    await expect(page.getByRole('button', { name: qt.sendQuote, exact: true })).toBeHidden();
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
    expect(order.data!.market_id).toBe(market.id);
    expect(order.data!.currency).toBe(country === 'SA' ? 'SAR' : 'EGP');
    expect(order.data!.tax_rate_bps).toBe(country === 'SA' ? 1500 : 2000);
    await expect(page.locator('main')).toContainText(market.currency);
    await page.goto('/en/account/quotes/' + versionId);
    await expect(page.locator('main')).toContainText(market.currency);
    await axe(page);
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
    expect(await op(page, 'create_job', orderId)).toBe(jobId);
    expect((await admin.from('jobs').select('id').eq('order_id', orderId)).data).toHaveLength(1);
    const trip1 = await op(page, 'create_trip', jobId);
    const trip2 = await op(page, 'create_trip', jobId);
    const d1 = await op(page, 'create_driver', jobId, {
        marketId: market.id,
        type: 'INTERNAL',
        name: 'Phase 3 internal fixture',
      }),
      d2 = await op(page, 'create_driver', jobId, {
        marketId: market.id,
        type: 'EXTERNAL',
        name: 'Phase 3 external fixture',
      });
    const v1 = await op(page, 'create_vehicle', jobId, {
        marketId: market.id,
        type: 'Truck',
        identifier: 'P3-' + randomUUID(),
      }),
      v2 = await op(page, 'create_vehicle', jobId, {
        marketId: market.id,
        type: 'Truck',
        identifier: 'P3-' + randomUUID(),
      });
    const plan = {
      plannedStart: new Date(Date.now() + 3600000).toISOString(),
      plannedEnd: new Date(Date.now() + 18000000).toISOString(),
      stops: [
        { cityId, kind: 'PICKUP', address: 'Fixture pickup 1', pickups: [] },
        { cityId, kind: 'PICKUP', address: 'Fixture pickup 2', pickups: [] },
        { cityId, kind: 'DELIVERY', address: 'Fixture delivery 1', pickups: [0, 1] },
        { cityId, kind: 'DELIVERY', address: 'Fixture delivery 2', pickups: [1] },
      ],
    };
    const wrongMarket = await admin
      .from('markets')
      .select('id')
      .eq('organization_id', org)
      .neq('id', market.id)
      .single();
    expect(wrongMarket.error).toBeNull();
    const wrongCity = await admin
      .from('market_cities')
      .select('id')
      .eq('market_id', wrongMarket.data!.id)
      .limit(1)
      .single();
    expect(wrongCity.error).toBeNull();
    const wrongDriver = await op(page, 'create_driver', jobId, {
      marketId: wrongMarket.data!.id,
      type: 'EXTERNAL',
      name: 'Phase 3 cross-market fixture',
    });
    const wrongVehicle = await op(page, 'create_vehicle', jobId, {
      marketId: wrongMarket.data!.id,
      type: 'Truck',
      identifier: 'P35-' + randomUUID(),
    });
    await op(
      page,
      'plan',
      trip1,
      { ...plan, stops: plan.stops.map((s) => ({ ...s, cityId: wrongCity.data!.id })) },
      400,
    );
    await op(page, 'plan', trip1, plan);
    await op(page, 'assign', trip1, { driverId: wrongDriver, vehicleId: v1 }, 403);
    await op(page, 'assign', trip1, { driverId: d1, vehicleId: wrongVehicle }, 403);
    for (const trip of [trip1, trip2]) {
      await op(page, 'plan', trip, plan);
      if (trip === trip1) {
        await page.goto('/ar/portal/operations/trips/' + trip);
        await page.locator('#planned-start').fill('2027-01-15T10:00');
        await page.locator('#planned-end').fill('2027-01-15T12:00');
        await page.getByRole('button', { name: ot.savePlan, exact: true }).click();
        const expected = country === 'SA' ? '2027-01-15T07:00:00.000Z' : '2027-01-15T08:00:00.000Z';
        await expect
          .poll(async () => {
            const row = await admin.from('trips').select('planned_start').eq('id', trip).single();
            return row.data?.planned_start ? new Date(row.data.planned_start).toISOString() : null;
          })
          .toBe(expected);
        await page.reload();
        await expect(page.locator('#planned-start')).toHaveValue('2027-01-15T10:00');
        await axe(page);
        await op(page, 'plan', trip, plan);
      }
      await op(page, 'assign', trip, { driverId: d1, vehicleId: v1 });
      await op(page, 'ready', trip);
    }
    await op(page, 'dispatch', trip1);
    await op(page, 'dispatch', trip2, {}, 409);
    // Isolate each conflict: a free vehicle cannot overcome a busy driver, or vice versa.
    await op(page, 'assign', trip2, { driverId: d1, vehicleId: v2 });
    await op(page, 'ready', trip2);
    await op(page, 'dispatch', trip2, {}, 409);
    await op(page, 'assign', trip2, { driverId: d2, vehicleId: v1 });
    await op(page, 'ready', trip2);
    await op(page, 'dispatch', trip2, {}, 409);
    await op(page, 'assign', trip2, { driverId: d1, vehicleId: v1 });
    await op(page, 'ready', trip2);
    const other = await principal('other'),
      customerClient = await principal('customer'),
      salesClient = await principal('sales');
    for (const client of [other, customerClient, salesClient]) {
      const denied = await client.rpc('operations_command', {
        p_organization_id: org,
        p_action: 'reassign',
        p_entity_id: trip1,
        p_revision: 0,
        p_mutation_id: randomUUID(),
        p_payload: { driverId: d2, vehicleId: v2, reason: 'Not authorized', confirmed: true },
      });
      expect(denied.error?.code).toBe('42501');
      expect(
        (await client.from('trips').update({ status: 'COMPLETED' }).eq('id', trip1)).error?.code,
      ).toBe('42501');
    }
    for (const client of [other, customerClient]) {
      expect((await client.from('trip_events').select('id').eq('trip_id', trip1)).data).toEqual([]);
      expect((await client.from('assignments').select('id').eq('trip_id', trip1)).data).toEqual([]);
    }
    expect((await customerClient.from('orders').select('id')).data).toHaveLength(
      country === 'SA' ? 1 : 2,
    );
    const otherOrg = required('STAGING_PHASE3_OTHER_ORG');
    const otherMarket = await admin
      .from('markets')
      .select('id')
      .eq('organization_id', otherOrg)
      .eq('country_code', country)
      .single();
    expect(otherMarket.error).toBeNull();
    const otherDriver = await other.rpc('operations_command', {
      p_organization_id: otherOrg,
      p_action: 'create_driver',
      p_entity_id: otherOrg,
      p_revision: 0,
      p_mutation_id: randomUUID(),
      p_payload: { marketId: otherMarket.data!.id, type: 'EXTERNAL', name: 'Isolated fixture' },
    });
    expect(otherDriver.error).toBeNull();
    const otherVehicle = await other.rpc('operations_command', {
      p_organization_id: otherOrg,
      p_action: 'create_vehicle',
      p_entity_id: otherOrg,
      p_revision: 0,
      p_mutation_id: randomUUID(),
      p_payload: {
        marketId: otherMarket.data!.id,
        type: 'Truck',
        identifier: 'Isolated fixture ' + country,
      },
    });
    expect(otherVehicle.error).toBeNull();
    await op(
      page,
      'reassign',
      trip1,
      { driverId: otherDriver.data.id, vehicleId: v2, reason: 'Cross tenant', confirmed: true },
      403,
    );
    await op(
      page,
      'reassign',
      trip1,
      { driverId: d2, vehicleId: otherVehicle.data.id, reason: 'Cross tenant', confirmed: true },
      403,
    );
    await op(
      page,
      'reassign',
      trip1,
      { driverId: d2, vehicleId: v2, reason: '', confirmed: true },
      400,
    );
    await op(page, 'plan', trip1, plan, 400);
    await op(page, 'complete_trip', trip1, {}, 400);
    await page.goto(`/ar/portal/operations/trips/${trip1}`);
    await page.getByRole('button', { name: ot.emergency, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page);
    await page.locator('#assign-driver').selectOption(d2);
    await page.locator('#assign-vehicle').selectOption(v2);
    await page.locator('#emergency-reason').fill('Controlled emergency replacement');
    await page.getByRole('button', { name: ot.confirm, exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const history = await admin
      .from('assignments')
      .select('id,ended_at,assigned_by')
      .eq('trip_id', trip1);
    expect(history.data).toHaveLength(2);
    expect(history.data!.filter((a) => a.ended_at === null)).toHaveLength(1);
    expect(history.data!.every((a) => a.assigned_by === identities.operations!.id)).toBe(true);
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
      const pod = await admin.from('trip_pods').select('*').eq('trip_id', trip).single();
      expect(pod.error).toBeNull();
      expect(pod.data?.actor_id).toBe(identities.operations!.id);
      expect(pod.data?.state).toBe('FINAL');
      const staff = await principal('operations');
      expect(
        (await staff.storage.from('pod-files').download(pod.data!.object_name)).error,
      ).toBeNull();
      for (const client of [customerClient, other, salesClient]) {
        expect(
          (await client.storage.from('pod-files').download(pod.data!.object_name)).error,
        ).not.toBeNull();
        expect(
          (await client.storage.from('pod-files').createSignedUrl(pod.data!.object_name, 60)).error,
        ).not.toBeNull();
      }
      const publicResponse = await boundedFetch(
        `${required('STAGING_TEST_API_URL')}/storage/v1/object/public/pod-files/${pod.data!.object_name}`,
      );
      expect(publicResponse.ok).toBe(false);
      const signed = await staff.storage
        .from('pod-files')
        .createSignedUrl(pod.data!.object_name, 2);
      expect(signed.error).toBeNull();
      expect((await boundedFetch(signed.data!.signedUrl)).ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 4000));
      expect(
        (await boundedFetch(signed.data!.signedUrl, { headers: { 'Cache-Control': 'no-cache' } }))
          .ok,
      ).toBe(false);
      expect(
        (
          await staff.rpc('trip_pod_command', {
            p_trip_id: trip,
            p_file_id: randomUUID(),
            p_action: 'reserve',
            p_recipient: 'Duplicate',
            p_mime: 'image/png',
            p_size: 8,
          })
        ).error,
      ).not.toBeNull();
      // End only this SDK probe session; global sign-out would revoke the live browser session.
      expect((await staff.auth.signOut({ scope: 'local' })).error).toBeNull();
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
      'currency',
      'market_id',
      'tax_version_id',
      'tax_rate_bps',
      'tax_code',
      'total_minor',
      'subtotal_minor',
      'vat_amount_minor',
      'distance_km',
      'accepted_quote_version_id',
    ] as const)
      expect(final.data?.[key]).toBe(order.data?.[key]);
    expect(final.data?.operational_status).toBe('COMPLETED');
    const external = await admin
      .from('drivers')
      .select('profile_id,driver_type')
      .eq('id', d2)
      .single();
    expect(external.data).toEqual({ profile_id: null, driver_type: 'EXTERNAL' });
    const events = await admin.from('trip_events').select('actor_id').in('trip_id', [trip1, trip2]);
    expect(events.data!.every((e) => e.actor_id === identities.operations!.id)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/portal/operations');
    await axe(page);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
    await admin
      .from('organization_memberships')
      .update({ status: 'suspended' })
      .eq('profile_id', identities.operations!.id)
      .eq('organization_id', org);
    await op(page, 'create_job', orderId, {}, 403);
    await page.goto('/en/portal/operations');
    await expect(page).toHaveURL(/\/en\/portal$/);
    await admin
      .from('organization_memberships')
      .update({ status: 'active' })
      .eq('profile_id', identities.operations!.id)
      .eq('organization_id', org);
    await Promise.all([
      other.auth.signOut({ scope: 'local' }),
      customerClient.auth.signOut({ scope: 'local' }),
      salesClient.auth.signOut({ scope: 'local' }),
    ]);
    await logout(page);
    await login(page, 'customer', 'en');
    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await axe(page);
    await expect(page.locator('main')).not.toContainText('Controlled emergency replacement');
    await expect(page.locator('main')).not.toContainText('Phase 3 external fixture');
    await page.goto(`/ar/account/orders/${orderId}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await axe(page);
    await expect(page.locator('main')).not.toContainText('Controlled emergency replacement');
    await expect(page.locator('main')).not.toContainText('Phase 3 external fixture');
    await logout(page, 'en');
    await login(page, 'peer', 'en');
    const deniedPage = await page.goto(`/en/account/orders/${orderId}`);
    // Next.js notFound uses HTTP 200 once streaming has begun; assert denial content and RLS.
    expect([200, 404]).toContain(deniedPage?.status());
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(dictionary('en').notFound);
    await expect(page.locator('main')).not.toContainText(order.data!.reference!);
    const deniedHtml = await deniedPage!.text();
    expect(deniedHtml.includes(order.data!.reference!)).toBe(false);
    const peerClient = await principal('peer');
    const deniedProgress = await peerClient.rpc('customer_order_progress', { p_order_id: orderId });
    expect(deniedProgress.error?.code).toBe('42501');
    expect((await peerClient.from('orders').select('id').eq('id', orderId)).data).toEqual([]);
    expect((await peerClient.auth.signOut({ scope: 'local' })).error).toBeNull();
  });
