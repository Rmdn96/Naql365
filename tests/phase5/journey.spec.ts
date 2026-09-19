import { randomUUID } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { test, expect } from '../staging/fixtures';
import { registerDriverJourneys, type DriverJourneyHook } from '../helpers/driver-journey';
import { admin, principal, login, axe } from '../phase4/helpers';
import { trackingDictionary } from '../../src/i18n/tracking';
const contexts: BrowserContext[] = [];
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
  await login(p, role, h.locale);
  return p;
}
async function subscribe(
  client: Awaited<ReturnType<typeof principal>>,
  trip: string,
  events: unknown[],
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
          table: 'trip_live_locations',
          filter: `trip_id=eq.${trip}`,
        },
        (payload) => events.push(payload.new),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trip_live_locations',
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
    await subscribe(h.customer, h.tripId, ownerEvents);
    await subscribe(await principal('operations'), h.tripId, opsEvents);
    await subscribe(await principal('peer'), h.tripId, peerEvents);
    await subscribe(await principal('other'), h.tripId, otherEvents);
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
    await expect(owner.getByText(t.eta, { exact: true })).toBeVisible();
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
    const notes = await h.customer
      .from('notifications')
      .select('id,event_code,read_at')
      .eq('trip_id', h.tripId);
    expect(notes.error).toBeNull();
    expect(notes.data?.some((n) => n.event_code === 'TRIP_STARTED')).toBe(true);
    const note = notes.data![0]!;
    expect(
      (await h.customer.rpc('read_notification', { p_notification: note.id })).error,
    ).toBeNull();
    const peer = await principal('peer');
    clients.push(peer);
    expect((await peer.rpc('read_notification', { p_notification: note.id })).error).not.toBeNull();
    await owner.context().close();
    contexts.splice(contexts.indexOf(owner.context()), 1);
    await h.page.bringToFront();
  },
  async reassigned(h) {
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
    const ops = await viewer(h, 'operations');
    await ops.goto(`/${h.locale}/portal/operations`);
    await expect(
      ops.getByRole('heading', { name: trackingDictionary(h.locale).title, exact: true }),
    ).toBeVisible();
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
