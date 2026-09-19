import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../staging/fixtures';
import { registerDriverJourneys, type DriverJourneyHook } from '../helpers/driver-journey';
import {
  admin,
  principal,
  login,
  axe,
  org,
  identities,
  acceptedOrder,
  op,
} from '../phase4/helpers';
import { trackingDictionary } from '../../src/i18n/tracking';
const contexts: BrowserContext[] = [];
const browserRealtime = new WeakMap<Page, { joined: boolean; changes: number }>();
const probes = new Map<
  string,
  { oldDriver: unknown[]; oldCount: number; notes: unknown[]; peerNotes: unknown[] }
>();
const clients: Awaited<ReturnType<typeof principal>>[] = [];
const point = (country: 'SA' | 'EG', delta = 0) =>
  country === 'SA'
    ? { latitude: 24.7136 + delta, longitude: 46.6753 }
    : { latitude: 30.0444 + delta, longitude: 31.2357 };
const publication = (trip: string, country: 'SA' | 'EG') => ({
  p_trip: trip,
  p_sample: randomUUID(),
  p_location: {
    ...point(country),
    accuracy: 5,
    speed: 3,
    capturedAt: new Date().toISOString(),
    clientType: 'NATIVE',
  },
});
async function viewer(h: DriverJourneyHook, role: string) {
  const c = await h.context
    .browser()!
    .newContext({ baseURL: h.baseURL, viewport: { width: 390, height: 844 } });
  contexts.push(c);
  await c.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === h.baseURL)
      await route.continue({
        headers: {
          ...route.request().headers(),
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
        },
      });
    else await route.continue();
  });
  const p = await c.newPage();
  const evidence = { joined: false, changes: 0 };
  browserRealtime.set(p, evidence);
  p.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      try {
        const frame: unknown = JSON.parse(
          typeof payload === 'string' ? payload : payload.toString(),
        );
        const event = Array.isArray(frame)
          ? frame[3]
          : frame && typeof frame === 'object' && 'event' in frame
            ? frame.event
            : null;
        const topic = Array.isArray(frame)
          ? frame[2]
          : frame && typeof frame === 'object' && 'topic' in frame
            ? frame.topic
            : null;
        if (typeof topic !== 'string' || !topic.startsWith('realtime:tracking-')) return;
        if (event === 'phx_reply') evidence.joined = true;
        if (event === 'postgres_changes') evidence.changes++;
      } catch {
        /* Binary/non-JSON transport frames contain no assertion evidence. */
      }
    }),
  );
  await login(p, role, h.locale);
  return p;
}
async function bilateralCustomerIsolation(h: DriverJourneyHook) {
  const page = await viewer(h, 'peer');
  const { market, cityId, orderId } = await acceptedOrder(page, h.country, 'peer');
  await login(page, 'operations');
  const job = await op(page, 'create_job', orderId),
    trip = await op(page, 'create_trip', job);
  const driver = await op(page, 'create_driver', job, {
    marketId: market.id,
    type: 'INTERNAL',
    name: 'Isolated customer execution',
  });
  expect(
    (
      await admin
        .from('drivers')
        .update({ profile_id: identities.isolationDriver!.id })
        .eq('id', driver)
    ).error,
  ).toBeNull();
  const vehicle = await op(page, 'create_vehicle', job, {
    marketId: market.id,
    type: 'Truck',
    identifier: 'ISO-' + randomUUID().slice(0, 8),
  });
  await op(page, 'plan', trip, {
    plannedStart: new Date().toISOString(),
    plannedEnd: new Date(Date.now() + 3600000).toISOString(),
    stops: [
      { cityId, kind: 'PICKUP', address: 'Isolated pickup', pickups: [] },
      { cityId, kind: 'DELIVERY', address: 'Isolated delivery', pickups: [0] },
    ],
  });
  await op(page, 'assign', trip, { driverId: driver, vehicleId: vehicle });
  await op(page, 'ready', trip);
  await op(page, 'dispatch', trip);
  const peer = await principal('peer'),
    publisher = await principal('isolationDriver');
  clients.push(publisher);
  const allowed: unknown[] = [],
    forbidden: unknown[] = [];
  await subscribe(peer, trip, allowed);
  await subscribe(h.customer, trip, forbidden);
  expect(
    (await publisher.rpc('publish_trip_location', publication(trip, h.country))).error,
  ).toBeNull();
  await expect.poll(() => allowed.length, { timeout: 20000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  expect(forbidden).toHaveLength(0);
  expect(
    (await h.customer.from('trip_live_locations').select('*').eq('trip_id', trip)).data,
  ).toEqual([]);
  expect((await h.customer.rpc('tracking_feed', { p_trip: trip })).error).not.toBeNull();
  expect((await peer.rpc('tracking_feed', { p_trip: h.tripId })).error).not.toBeNull();
  await page.context().close();
  contexts.splice(contexts.indexOf(page.context()), 1);
  await h.page.bringToFront();
  test.info().annotations.push({
    type: 'safe-security-probe',
    description:
      'two actual customer Orders/active Trips: bilateral read/query/subscription isolation verified with authorized positive delivery',
  });
}
async function subscribe(
  client: Awaited<ReturnType<typeof principal>>,
  trip: string,
  events: unknown[],
  table: 'trip_live_locations' | 'notifications' = 'trip_live_locations',
) {
  clients.push(client);
  await client.realtime.setAuth();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Realtime subscription timeout')), 20000);
    client
      .channel('phase5-' + randomUUID())
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `trip_id=eq.${trip}`,
        },
        (payload) => events.push(payload.new),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `trip_id=eq.${trip}`,
        },
        (payload) => events.push(payload.new),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          reject(Error('Realtime subscription failed'));
        }
      });
  });
}
test.afterEach(async () => {
  for (const c of clients.splice(0)) await c.removeAllChannels();
  for (const c of contexts.splice(0)) await c.close();
});
registerDriverJourneys({
  async started(h) {
    const ownerEvents: unknown[] = [],
      opsEvents: unknown[] = [],
      peerEvents: unknown[] = [],
      otherEvents: unknown[] = [];
    const oldDriver: unknown[] = [],
      unassigned: unknown[] = [],
      notes: unknown[] = [],
      peerNotes: unknown[] = [];
    await subscribe(h.driver, h.tripId, oldDriver);
    await subscribe(h.replacement, h.tripId, unassigned);
    await subscribe(h.customer, h.tripId, notes, 'notifications');
    await subscribe(await principal('peer'), h.tripId, peerNotes, 'notifications');
    await subscribe(h.customer, h.tripId, ownerEvents);
    await subscribe(await principal('operations'), h.tripId, opsEvents);
    await subscribe(await principal('peer'), h.tripId, peerEvents);
    await subscribe(await principal('other'), h.tripId, otherEvents);
    if (h.country === 'SA') await bilateralCustomerIsolation(h);
    await h.context.addInitScript(() => {
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...args) => {
        document.documentElement.dataset.heartbeatObservations = String(
          Number(document.documentElement.dataset.heartbeatObservations ?? 0) + 1,
        );
        return original(...args);
      };
    });
    await h.context.grantPermissions(['geolocation'], { origin: h.baseURL });
    await h.context.setGeolocation({ ...point(h.country), accuracy: 5 });
    await h.page.reload();
    await h.page.bringToFront();
    const probe = await h.page.evaluate(async (tripId) => {
      const r = await fetch('/api/tracking?mode=driver&tripId=' + tripId);
      return {
        status: r.status,
        visible: !document.hidden,
        geoAllowed: navigator.geolocation !== undefined,
      };
    }, h.tripId);
    test
      .info()
      .annotations.push({ type: 'safe-security-probe', description: JSON.stringify(probe) });
    expect(probe.status).toBe(200);
    await expect
      .poll(
        async () =>
          (
            await admin
              .from('trip_live_locations')
              .select('latitude')
              .eq('trip_id', h.tripId)
              .maybeSingle()
          ).data?.latitude,
        { timeout: 45000 },
      )
      .toBe(point(h.country).latitude);
    await expect.poll(() => ownerEvents.length, { timeout: 20000 }).toBeGreaterThan(0);
    await expect.poll(() => opsEvents.length, { timeout: 20000 }).toBeGreaterThan(0);
    expect(peerEvents).toHaveLength(0);
    expect(otherEvents).toHaveLength(0);
    await expect.poll(() => oldDriver.length).toBeGreaterThan(0);
    expect(unassigned).toHaveLength(0);
    if (h.country === 'SA') {
      let publications = 0;
      const countPublication = (request: import('@playwright/test').Request) => {
        if (new URL(request.url()).pathname === '/api/tracking' && request.method() === 'POST')
          publications++;
      };
      h.page.on('request', countPublication);
      await h.page.reload(); // Restore a stationary watcher while the server still throttles the new page.
      const first = (
        await admin
          .from('trip_live_locations')
          .select('version,received_at')
          .eq('trip_id', h.tripId)
          .single()
      ).data!;
      await expect
        .poll(
          () =>
            h.page.evaluate(() =>
              Number(document.documentElement.dataset.heartbeatObservations ?? 0),
            ),
          { timeout: 195000, intervals: [1000, 2000, 5000] },
        )
        .toBeGreaterThan(0);
      expect(
        (await admin.from('trip_live_locations').select('version').eq('trip_id', h.tripId).single())
          .data?.version,
      ).toBe(first.version);
      expect(publications).toBeLessThanOrEqual(2);
      h.page.off('request', countPublication);
      // Chromium's fixed emulated fix retains its timestamp; emit a genuinely new device observation at the same coordinates.
      await h.context.setGeolocation({ ...point(h.country), accuracy: 5 });
      await expect
        .poll(
          async () =>
            (
              await admin
                .from('trip_live_locations')
                .select('version')
                .eq('trip_id', h.tripId)
                .single()
            ).data?.version,
          { timeout: 20000 },
        )
        .toBeGreaterThan(first.version);
      const next = (
        await admin
          .from('trip_live_locations')
          .select('received_at')
          .eq('trip_id', h.tripId)
          .single()
      ).data!;
      expect(Date.parse(next.received_at) - Date.parse(first.received_at)).toBeGreaterThanOrEqual(
        180000,
      );
      test.info().annotations.push({
        type: 'safe-security-probe',
        description:
          'stationary heartbeat: real 180-second interval, fresh observation requested, unchanged stale fix never republished',
      });
      await expect.poll(() => ownerEvents.length).toBeGreaterThan(1);
      await expect.poll(() => opsEvents.length).toBeGreaterThan(1);
    }
    // Recheck RLS on an already-established socket after membership suspension.
    const beforeOwner = ownerEvents.length,
      beforeOps = opsEvents.length;
    expect(
      (
        await admin
          .from('organization_memberships')
          .update({ status: 'suspended' })
          .eq('organization_id', org)
          .eq('profile_id', identities.customer!.id)
      ).error,
    ).toBeNull();
    try {
      expect(
        (await h.customer.from('trip_live_locations').select('*').eq('trip_id', h.tripId)).data,
      ).toEqual([]);
      expect(
        (
          await admin
            .from('trip_live_locations')
            .update({ received_at: new Date().toISOString() })
            .eq('trip_id', h.tripId)
        ).error,
      ).toBeNull();
      await expect.poll(() => opsEvents.length, { timeout: 20000 }).toBeGreaterThan(beforeOps);
      await h.page.waitForTimeout(1500);
      expect(ownerEvents).toHaveLength(beforeOwner);
    } finally {
      expect(
        (
          await admin
            .from('organization_memberships')
            .update({ status: 'active' })
            .eq('organization_id', org)
            .eq('profile_id', identities.customer!.id)
        ).error,
      ).toBeNull();
    }
    const last = ownerEvents.at(-1) as Record<string, unknown>;
    expect(last).not.toHaveProperty('actor_id');
    expect(last).not.toHaveProperty('assignment_id');
    expect(last).not.toHaveProperty('intent');
    for (const role of [
      'customer',
      'sales',
      'peer',
      'other',
      'otherDriver',
      'crossMarketDriver',
      'externalDriver',
    ]) {
      const c = await principal(role);
      clients.push(c);
      expect(
        (await c.rpc('publish_trip_location', publication(h.tripId, h.country))).error,
      ).not.toBeNull();
      if (role !== 'customer')
        expect(
          (await c.from('trip_live_locations').select('*').eq('trip_id', h.tripId)).data,
        ).toEqual([]);
    }
    const owner = await viewer(h, 'customer'),
      t = trackingDictionary(h.locale);
    await owner.goto(`/${h.locale}/account/orders/${h.orderId}`);
    await expect(owner.getByText(t.LIVE, { exact: true })).toBeVisible();
    await expect(owner.getByText(t.eta, { exact: true })).toHaveCount(2);
    const currentNotification = (
      await h.customer
        .from('notifications')
        .select('created_at')
        .eq('trip_id', h.tripId)
        .eq('event_code', 'TRIP_STARTED')
        .single()
    ).data!;
    const notificationRow = owner
      .locator('li')
      .filter({ has: owner.locator(`time[datetime="${currentNotification.created_at}"]`) });
    await expect(notificationRow.getByText(t.TRIP_STARTED, { exact: true })).toBeVisible();
    await notificationRow.getByRole('button', { name: t.markRead, exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await h.customer
              .from('notifications')
              .select('read_at')
              .eq('trip_id', h.tripId)
              .eq('event_code', 'TRIP_STARTED')
              .single()
          ).data?.read_at,
      )
      .toBeTruthy();
    const transport = browserRealtime.get(owner)!;
    await expect.poll(() => transport.joined, { timeout: 20000 }).toBe(true);
    const beforeChange = transport.changes;
    expect(
      (
        await admin
          .from('trip_live_locations')
          .update({ received_at: new Date().toISOString() })
          .eq('trip_id', h.tripId)
      ).error,
    ).toBeNull();
    await expect.poll(() => transport.changes, { timeout: 20000 }).toBeGreaterThan(beforeChange);
    test.info().annotations.push({
      type: 'safe-security-probe',
      description:
        'customer browser received actual postgres_changes WebSocket frame under deployed CSP',
    });
    await axe(owner);
    await owner.getByRole('button', { name: t.map, exact: true }).click();
    await expect(owner.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
    await expect
      .poll(
        () =>
          owner
            .locator('.tracking-map img')
            .evaluateAll((images) =>
              images.some(
                (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        { timeout: 20000 },
      )
      .toBe(true);
    await h.page.goto(`/${h.locale}/driver`);
    expect(
      (
        await admin
          .from('trip_live_locations')
          .update({ received_at: new Date(Date.now() - 95000).toISOString() })
          .eq('trip_id', h.tripId)
      ).error,
    ).toBeNull();
    await owner.bringToFront();
    await expect(owner.getByText(t.STALE, { exact: true })).toBeVisible({ timeout: 45000 });
    await h.context.setGeolocation({ ...point(h.country, 0.001), accuracy: 5 });
    await h.page.goto(`/${h.locale}/driver/trips/${h.tripId}`);
    await h.page.bringToFront();
    await expect
      .poll(
        async () =>
          (
            await admin
              .from('trip_live_locations')
              .select('latitude')
              .eq('trip_id', h.tripId)
              .single()
          ).data?.latitude,
        { timeout: 45000 },
      )
      .toBeCloseTo(point(h.country, 0.001).latitude, 6);
    const storedNotes = await h.customer
      .from('notifications')
      .select('id,event_code,read_at')
      .eq('trip_id', h.tripId);
    expect(storedNotes.error).toBeNull();
    expect(storedNotes.data?.some((n) => n.event_code === 'TRIP_STARTED')).toBe(true);
    const note = storedNotes.data![0]!;
    expect(
      (await h.customer.rpc('read_notification', { p_notification: note.id })).error,
    ).toBeNull();
    const peer = await principal('peer');
    clients.push(peer);
    expect((await peer.rpc('read_notification', { p_notification: note.id })).error).not.toBeNull();
    probes.set(h.tripId, { oldDriver, oldCount: oldDriver.length, notes, peerNotes });
    await owner.context().close();
    contexts.splice(contexts.indexOf(owner.context()), 1);
    await h.page.bringToFront();
  },
  async reassigned(h) {
    const oldCount = probes.get(h.tripId)!.oldDriver.length;
    expect(
      (await h.driver.rpc('publish_trip_location', publication(h.tripId, h.country))).error,
    ).not.toBeNull();
    await h.context.setGeolocation({ ...point(h.country, 0.002), accuracy: 5 });
    await h.page.reload();
    await expect
      .poll(
        async () =>
          (
            await admin
              .from('trip_live_locations')
              .select('latitude')
              .eq('trip_id', h.tripId)
              .single()
          ).data?.latitude,
        { timeout: 45000 },
      )
      .toBeCloseTo(point(h.country, 0.002).latitude, 6);
    const probe = probes.get(h.tripId)!;
    await h.page.waitForTimeout(1500);
    expect(probe.oldDriver).toHaveLength(oldCount);
    const ops = await viewer(h, 'operations');
    await ops.goto(`/${h.locale}/portal/operations`);
    await expect(
      ops.getByRole('heading', { name: trackingDictionary(h.locale).title, exact: true }),
    ).toBeVisible();
    const live = ops.locator('section').filter({
      has: ops.getByRole('heading', { name: trackingDictionary(h.locale).title, exact: true }),
    });
    await live.locator('select[name="trip"]').selectOption(h.tripId);
    await live
      .getByRole('button', { name: trackingDictionary(h.locale).filter, exact: true })
      .click();
    await expect(live.locator('article')).toHaveCount(1);
    await expect(live.getByText(trackingDictionary(h.locale).LIVE, { exact: true })).toBeVisible();
    await live.getByRole('button', { name: trackingDictionary(h.locale).map, exact: true }).click();
    await expect(live.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
    await axe(ops);
    await ops.context().close();
    contexts.splice(contexts.indexOf(ops.context()), 1);
    await h.page.bringToFront();
  },
  async completed(h) {
    expect(
      (await h.replacement.rpc('publish_trip_location', publication(h.tripId, h.country))).error,
    ).not.toBeNull();
    const row = await h.customer
      .from('trip_live_locations')
      .select('active,latitude,longitude')
      .eq('trip_id', h.tripId)
      .single();
    expect(row.error).toBeNull();
    expect(row.data).toEqual({ active: false, latitude: null, longitude: null });
    const probe = probes.get(h.tripId)!;
    await expect
      .poll(
        () =>
          probe.notes.some((n) => (n as { event_code?: string }).event_code === 'TRIP_COMPLETED'),
        { timeout: 20000 },
      )
      .toBe(true);
    expect(probe.peerNotes).toHaveLength(0);
    const notifications = await h.customer
      .from('notifications')
      .select('*')
      .eq('trip_id', h.tripId);
    expect(notifications.data?.some((n) => n.event_code === 'TRIP_COMPLETED')).toBe(true);
    expect(JSON.stringify(notifications.data)).not.toContain('Private controlled access problem');
    test.info().annotations.push({
      type: 'safe-security-probe',
      description: `${h.country}: foreground browser GPS, real Realtime owner/Operations delivery and customer/tenant denial, stale/recovery, reassignment, notifications, map attribution, unavailable ETA and terminal coordinate removal verified`,
    });
  },
});
