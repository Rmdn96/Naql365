import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect } from '../staging/fixtures';
import {
  acceptedOrder,
  admin,
  org,
  identities,
  login,
  logout,
  axe,
  principal,
  op,
} from './helpers';
import { driverDictionary } from '../../src/i18n/driver';
import { customerDictionary } from '../../src/i18n/customer';
import { dictionary } from '../../src/i18n/dictionaries';
import { operationLabel } from '../../src/i18n/operations';
import { hasSourceMapDirective } from '../helpers/source-map';
async function driverLogin(page: Page, label: string, locale: 'ar' | 'en') {
  await page.goto(`/${locale}/driver/login`);
  await page.locator('#driver-email').fill(identities[label]!.email);
  await page.locator('#driver-password').fill(identities[label]!.password);
  await page.getByRole('button', { name: customerDictionary(locale).login, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/driver$`));
}
async function command(
  page: Page,
  tripId: string,
  action: string,
  payload: object = {},
  expected = 200,
) {
  const state = await admin.from('trips').select('revision').eq('id', tripId).single();
  expect(state.error).toBeNull();
  const result = await page.evaluate(
    async (body) => {
      const response = await fetch('/api/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return response.status;
    },
    { tripId, revision: state.data!.revision, mutationId: randomUUID(), action, payload },
  );
  expect(result).toBe(expected);
}
async function tripState(id: string) {
  const row = await admin.from('trips').select('status,revision').eq('id', id).single();
  expect(row.error).toBeNull();
  return row.data!;
}
async function uiAction(
  page: Page,
  tripId: string,
  action: 'dispatch' | 'arrive' | 'start_service' | 'complete_stop' | 'depart' | 'complete_trip',
  locale: 'ar' | 'en',
) {
  const before = (await tripState(tripId)).revision;
  await page
    .getByRole('button', {
      name:
        action === 'dispatch' ? driverDictionary(locale).startTrip : operationLabel(action, locale),
      exact: true,
    })
    .click();
  await expect.poll(async () => (await tripState(tripId)).revision).toBeGreaterThan(before);
  await page.reload();
}
for (const country of ['SA', 'EG'] as const)
  test(`hosted ${country} authenticated Driver execution, reassignment, issues, private POD and tracking`, async ({
    page,
    context,
    baseURL,
  }) => {
    const locale = country === 'SA' ? 'ar' : 'en',
      dt = driverDictionary(locale),
      a = country === 'SA' ? 'saDriverA' : 'egDriverA',
      b = country === 'SA' ? 'saDriverB' : 'egDriverB';
    const { market, cityId, orderId } = await acceptedOrder(page, country);
    const orderBefore = await admin.from('orders').select('*').eq('id', orderId).single();
    expect(orderBefore.error).toBeNull();
    await logout(page);
    await login(page, 'operations');
    const job = await op(page, 'create_job', orderId),
      trip1 = await op(page, 'create_trip', job),
      trip2 = await op(page, 'create_trip', job);
    const resources = [];
    for (const label of [a, b]) {
      const id = await op(page, 'create_driver', job, {
        marketId: market.id,
        type: 'INTERNAL',
        name: `Phase 4 ${label}`,
      });
      const linked = await admin
        .from('drivers')
        .update({ profile_id: identities[label]!.id })
        .eq('id', id);
      expect(linked.error).toBeNull();
      resources.push(id);
    }
    const external = await op(page, 'create_driver', job, {
      marketId: market.id,
      type: 'EXTERNAL',
      name: 'Phase 4 external resource',
    });
    expect(
      (await admin.from('drivers').update({ profile_id: identities[a]!.id }).eq('id', external))
        .error,
    ).not.toBeNull();
    const vehicles = [];
    for (let i = 0; i < 2; i++)
      vehicles.push(
        await op(page, 'create_vehicle', job, {
          marketId: market.id,
          type: 'Truck',
          identifier: `P4-${randomUUID()}`,
        }),
      );
    const plan = {
      plannedStart: new Date(Date.now() - 3600000).toISOString(),
      plannedEnd: new Date(Date.now() + 18000000).toISOString(),
      stops: [
        {
          cityId,
          kind: 'PICKUP',
          address: `${country} synthetic pickup 1`,
          notes: 'Staff-only note must stay private',
          pickups: [],
        },
        { cityId, kind: 'PICKUP', address: `${country} synthetic pickup 2`, pickups: [] },
        { cityId, kind: 'DELIVERY', address: `${country} synthetic delivery 1`, pickups: [0, 1] },
        { cityId, kind: 'DELIVERY', address: `${country} synthetic delivery 2`, pickups: [1] },
      ],
    };
    await op(page, 'plan', trip1, plan);
    await op(page, 'plan', trip2, {
      ...plan,
      plannedStart: new Date(Date.now() + 86400000).toISOString(),
      plannedEnd: new Date(Date.now() + 100000000).toISOString(),
    });
    for (const [index, trip] of [trip1, trip2].entries()) {
      await op(page, 'assign', trip, { driverId: resources[0], vehicleId: vehicles[index] });
      await op(page, 'ready', trip);
    }
    const wrongMarket = await admin
      .from('markets')
      .select('id')
      .eq('organization_id', org)
      .neq('id', market.id)
      .single();
    expect(wrongMarket.error).toBeNull();
    const wrongDriver = await op(page, 'create_driver', job, {
      marketId: wrongMarket.data!.id,
      type: 'INTERNAL',
      name: 'Phase 4 other Market',
    });
    expect(
      (
        await admin
          .from('drivers')
          .update({ profile_id: null })
          .eq('profile_id', identities.crossMarketDriver!.id)
      ).error,
    ).toBeNull();
    expect(
      (
        await admin
          .from('drivers')
          .update({ profile_id: identities.crossMarketDriver!.id })
          .eq('id', wrongDriver)
      ).error,
    ).toBeNull();
    const crossMarket = await principal('crossMarketDriver');
    expect((await crossMarket.rpc('driver_identity')).data).not.toEqual([]);
    expect((await crossMarket.rpc('driver_trip', { p_trip: trip1 })).error).not.toBeNull();
    expect(
      (
        await crossMarket.rpc('driver_execute', {
          p_trip: trip1,
          p_action: 'dispatch',
          p_revision: (await tripState(trip1)).revision,
          p_mutation: randomUUID(),
          p_payload: {},
        })
      ).error,
    ).not.toBeNull();
    if (country === 'SA') {
      const otherOrg = process.env.STAGING_PHASE4_OTHER_ORG!;
      const otherMarket = (
        await admin
          .from('markets')
          .select('id')
          .eq('organization_id', otherOrg)
          .eq('country_code', 'SA')
          .single()
      ).data!.id;
      const otherStaff = await principal('other');
      const created = await otherStaff.rpc('operations_command', {
        p_organization_id: otherOrg,
        p_entity_id: otherOrg,
        p_revision: 0,
        p_mutation_id: randomUUID(),
        p_action: 'create_driver',
        p_payload: { marketId: otherMarket, type: 'INTERNAL', name: 'Cross tenant fixture' },
      });
      expect(created.error).toBeNull();
      expect(
        (
          await admin
            .from('drivers')
            .update({ profile_id: identities.otherDriver!.id })
            .eq('id', created.data.id)
        ).error,
      ).toBeNull();
    }
    const otherDriver = await principal('otherDriver');
    expect((await otherDriver.rpc('driver_identity')).data).not.toEqual([]);
    expect((await otherDriver.rpc('driver_trip', { p_trip: trip1 })).error).not.toBeNull();
    await op(page, 'assign', trip2, { driverId: wrongDriver, vehicleId: vehicles[1] }, 403);
    const refs = await admin.from('trips').select('id,reference').in('id', [trip1, trip2]);
    expect(refs.error).toBeNull();
    for (const role of ['customer', 'sales', 'other']) {
      await logout(page);
      await login(page, role);
      await page.goto(`/${locale}/driver`);
      await expect(
        page.getByRole('heading', { name: dictionary(locale).unauthorized, exact: true }),
      ).toBeVisible();
      await command(page, trip1, 'dispatch', {}, 403);
      const client = await principal(role);
      expect((await client.rpc('driver_trip', { p_trip: trip1 })).error).not.toBeNull();
    }
    await logout(page);
    await page.goto(`/${locale}/driver/login`);
    await page.locator('#driver-email').fill(identities.externalDriver!.email);
    await page.locator('#driver-password').fill(identities.externalDriver!.password);
    await page.getByRole('button', { name: customerDictionary(locale).login, exact: true }).click();
    await expect(
      page.getByText(customerDictionary(locale).authError, { exact: true }),
    ).toBeVisible();
    await driverLogin(page, a, locale);
    await page.setViewportSize({ width: 390, height: 844 });
    await axe(page);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('main')).toContainText(
      refs.data!.find((r) => r.id === trip1)!.reference,
    );
    await expect(page.locator('main')).not.toContainText(
      refs.data!.find((r) => r.id === trip2)!.reference,
    );
    await page.getByRole('link', { name: dt.upcoming, exact: true }).click();
    await expect(page.locator('main')).toContainText(
      refs.data!.find((r) => r.id === trip2)!.reference,
    );
    await page.goto(`/${locale}/driver/trips/${trip1}`);
    await page.reload();
    await expect(page.locator('main')).toContainText(plan.stops[0]!.address);
    await expect(page.locator('main')).not.toContainText('Staff-only note must stay private');
    await axe(page);
    const driver = await principal(a),
      replacement = await principal(b),
      customer = await principal('customer');
    const driverRole = (await admin.from('roles').select('id').eq('code', 'DRIVER').single()).data!
      .id;
    expect(
      (
        await admin
          .from('user_roles')
          .delete()
          .eq('organization_id', org)
          .eq('profile_id', identities[a]!.id)
      ).error,
    ).toBeNull();
    await command(page, trip1, 'dispatch', {}, 403);
    expect(
      (
        await admin
          .from('user_roles')
          .insert({ organization_id: org, profile_id: identities[a]!.id, role_id: driverRole })
      ).error,
    ).toBeNull();
    for (const table of [
      'trips',
      'trip_stops',
      'assignments',
      'trip_events',
      'customers',
      'requests',
      'orders',
      'quotes',
      'quote_versions',
      'pricing_evaluations',
      'payments',
    ]) {
      const read = await driver.from(table).select('*');
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);
    }
    expect((await replacement.rpc('driver_trip', { p_trip: trip1 })).error).not.toBeNull();
    await command(page, trip1, 'assign', { driverId: resources[1], vehicleId: vehicles[1] }, 400);
    await command(page, trip1, 'dispatch', { driver_id: resources[1], status: 'COMPLETED' }, 400);
    const stops = await admin
      .from('trip_stops')
      .select('id,position,status')
      .eq('trip_id', trip1)
      .order('position');
    expect(stops.error).toBeNull();
    await command(page, trip1, 'complete_stop', { stopId: stops.data![2]!.id }, 400);
    await uiAction(page, trip1, 'dispatch', locale);
    await expect(page.locator('#arrival-location')).toBeVisible();
    await page.locator('#arrival-location').check();
    await uiAction(page, trip1, 'arrive', locale); // Permission not granted: normal execution still succeeds.
    const noLocation = await admin
      .from('trip_event_locations')
      .select('event_id')
      .eq('trip_id', trip1);
    expect(noLocation.error).toBeNull();
    expect(noLocation.data).toEqual([]);
    await admin
      .from('organization_memberships')
      .update({ status: 'suspended' })
      .eq('profile_id', identities[a]!.id)
      .eq('organization_id', org);
    await command(page, trip1, 'start_service', { stopId: stops.data![0]!.id }, 403);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: dictionary(locale).unauthorized, exact: true }),
    ).toBeVisible();
    await admin
      .from('organization_memberships')
      .update({ status: 'active' })
      .eq('profile_id', identities[a]!.id)
      .eq('organization_id', org);
    await login(page, 'operations');
    await op(page, 'reassign', trip1, {
      driverId: resources[1],
      vehicleId: vehicles[0],
      reason: 'Controlled emergency reassignment',
      confirmed: true,
    });
    await driverLogin(page, a, locale);
    await command(page, trip1, 'start_service', { stopId: stops.data![0]!.id }, 403);
    expect((await driver.rpc('driver_trip', { p_trip: trip1 })).error).not.toBeNull();
    expect((await admin.from('assignments').select('id').eq('trip_id', trip1)).data).toHaveLength(
      2,
    );
    await driverLogin(page, b, locale);
    await page.goto(`/${locale}/driver/trips/${trip1}`);
    await axe(page);
    await page.getByText(dt.issue, { exact: true }).click();
    await page.locator('#issue-reason').fill('Private controlled access problem');
    await page.locator('#issue-category').selectOption('ACCESS_BLOCKED');
    const png = await sharp({
      create: { width: 64, height: 32, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    await page
      .locator('#issue-file')
      .setInputFiles({ name: 'harmless.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: dt.sendIssue, exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await admin
              .from('issue_photos')
              .select('state')
              .eq('actor_id', identities[b]!.id)
              .eq('state', 'FINAL')
          ).data?.length,
      )
      .toBe(1);
    const issue = (await admin.from('issues').select('id').eq('trip_id', trip1).single()).data!.id;
    await expect(page.locator('main')).toContainText(dt.attention);
    await command(page, trip1, 'start_service', { stopId: stops.data![0]!.id }, 400);
    expect(
      (await customer.rpc('driver_evidence_path', { p_kind: 'issue', p_id: issue })).error,
    ).not.toBeNull();
    const tracking = await customer.rpc('customer_order_progress', { p_order_id: orderId });
    expect(tracking.error).toBeNull();
    expect(JSON.stringify(tracking.data)).not.toContain('Private controlled access problem');
    await login(page, 'operations', locale);
    await page.goto(`/${locale}/portal/operations/trips/${trip1}`);
    await expect(page.locator('main')).toContainText('Private controlled access problem');
    await page.locator(`#resolve-${issue}`).fill('Access confirmed, safe to continue');
    await page.getByRole('button', { name: dt.resolve, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await admin.from('issues').select('status').eq('id', issue).single()).data?.status,
      )
      .toBe('RESOLVED');
    await driverLogin(page, b, locale);
    await page.goto(`/${locale}/driver/trips/${trip1}`);
    for (const stop of stops.data!) {
      let status = (await admin.from('trip_stops').select('status').eq('id', stop.id).single())
        .data!.status;
      if (status === 'PENDING') await uiAction(page, trip1, 'depart', locale);
      status = (await admin.from('trip_stops').select('status').eq('id', stop.id).single()).data!
        .status;
      if (status === 'EN_ROUTE') {
        await context.grantPermissions(['geolocation'], { origin: baseURL! });
        await context.setGeolocation(
          country === 'SA'
            ? { latitude: 24.7, longitude: 46.6 }
            : { latitude: 30.04, longitude: 31.23 },
        );
        await page.locator('#arrival-location').check();
        await uiAction(page, trip1, 'arrive', locale);
      }
      await uiAction(page, trip1, 'start_service', locale);
      await uiAction(page, trip1, 'complete_stop', locale);
    }
    await command(page, trip1, 'complete_trip', {}, 400);
    await axe(page);
    await page.locator('#pod-recipient').fill('Distinct controlled recipient');
    if (country === 'SA') {
      const box = await page.locator('canvas').boundingBox();
      expect(box).not.toBeNull();
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box!.x + 20, y: box!.y + 30 }],
      });
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: box!.x + 100, y: box!.y + 60 }],
      });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else
      await page
        .locator('#pod-file')
        .setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: dt.submitPod, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await admin.from('trip_pods').select('state').eq('trip_id', trip1).single()).data?.state,
      )
      .toBe('FINAL');
    await page.reload();
    const pod = (await admin.from('trip_pods').select('*').eq('trip_id', trip1).single()).data!;
    expect(pod.actor_id).toBe(identities[b]!.id);
    expect(pod.recipient_name).toBe('Distinct controlled recipient');
    expect(
      (await replacement.rpc('driver_finalize_pod', { p_trip: trip1, p_file: pod.id })).error,
    ).toBeNull();
    expect(
      (await replacement.rpc('driver_finalize_pod', { p_trip: trip1, p_file: randomUUID() })).error,
    ).not.toBeNull();
    const signed = await replacement.storage.from('pod-files').createSignedUrl(pod.object_name, 1);
    expect(signed.error).toBeNull();
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);
    expect(
      (
        await fetch(
          `${process.env.STAGING_TEST_API_URL}/storage/v1/object/public/pod-files/${pod.object_name}`,
        )
      ).ok,
    ).toBe(false);
    expect(
      (await customer.storage.from('pod-files').createSignedUrl(pod.object_name, 60)).error,
    ).not.toBeNull();
    expect(
      (await driver.storage.from('pod-files').createSignedUrl(pod.object_name, 60)).error,
    ).not.toBeNull();
    await uiAction(page, trip1, 'complete_trip', locale);
    expect(
      (await admin.from('jobs').select('status').eq('id', job).single()).data!.status,
    ).not.toBe('COMPLETED');
    await page.getByRole('link', { name: dt.completed, exact: true }).click();
    await expect(page.locator('main')).toContainText(
      refs.data!.find((r) => r.id === trip1)!.reference,
    );
    await page.goto(`/${locale}/driver/trips/${trip1}`);
    await expect(page.locator('main')).not.toContainText(plan.stops[0]!.address);
    await axe(page);
    await driverLogin(page, a, locale);
    await page.goto(`/${locale}/driver/trips/${trip2}`);
    await uiAction(page, trip2, 'dispatch', locale);
    const second = (
      await admin.from('trip_stops').select('id,position').eq('trip_id', trip2).order('position')
    ).data!;
    for (const [index] of second.entries()) {
      if (index) await uiAction(page, trip2, 'depart', locale);
      await uiAction(page, trip2, 'arrive', locale);
      await uiAction(page, trip2, 'start_service', locale);
      await uiAction(page, trip2, 'complete_stop', locale);
    }
    await page.locator('#pod-recipient').fill('Second recipient');
    await page
      .locator('#pod-file')
      .setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: dt.submitPod, exact: true }).click();
    await expect
      .poll(
        async () =>
          (await admin.from('trip_pods').select('state').eq('trip_id', trip2).single()).data?.state,
      )
      .toBe('FINAL');
    await page.reload();
    await uiAction(page, trip2, 'complete_trip', locale);
    expect((await admin.from('jobs').select('status').eq('id', job).single()).data!.status).toBe(
      'COMPLETED',
    );
    const finalOrder = (await admin.from('orders').select('*').eq('id', orderId).single()).data!;
    for (const key of Object.keys(orderBefore.data!))
      if (!['updated_at', 'operational_status', 'operational_completed_at'].includes(key))
        expect(finalOrder[key]).toEqual(orderBefore.data![key]);
    const safe = await customer.rpc('customer_order_progress', { p_order_id: orderId });
    expect(safe.error).toBeNull();
    expect(JSON.stringify(safe.data)).toContain('COMPLETED');
    for (const secret of [
      'Private controlled access problem',
      'Staff-only note',
      identities[a]!.email,
      'latitude',
      'longitude',
      'assignment',
    ])
      expect(JSON.stringify(safe.data)).not.toContain(secret);
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(false);
    const response = await page.goto(`/${locale}/driver`);
    expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    const protectedSecrets = [
      process.env.STAGING_TEST_ADMIN_KEY!,
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
      ...Object.values(identities).map((i) => i.password),
    ];
    for (const source of await page
      .locator('script[src]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).src))) {
      const url = new URL(source);
      if (url.origin !== baseURL) continue;
      const asset = await fetch(url, {
        headers: { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET! },
      });
      expect(asset.ok).toBe(true);
      const text = await asset.text();
      expect(protectedSecrets.every((s) => !text.includes(s))).toBe(true);
      expect(text.includes('sb_secret_')).toBe(false);
      expect(hasSourceMapDirective(text)).toBe(false);
    }
    await page.getByRole('button', { name: dictionary(locale).logout, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/driver/login$`));
    await page.goto(`/${locale}/driver/trips/${trip2}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/driver/login$`));
    test.info().annotations.push({
      type: 'safe-security-probe',
      description: `${country}: internal auth, four Stops/two Trips, reassignment, issue/photo, private POD, aggregate, tracking, mobile/axe and asset checks completed`,
    });
  });
