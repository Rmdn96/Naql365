import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { test, expect } from '../staging/fixtures';
import { registerDriverJourneys } from '../helpers/driver-journey';
import { driverVisual } from '../helpers/driver-v2-evidence';
import { admin, principal } from '../phase4/helpers';
import { driverDictionary } from '../../src/i18n/driver';
import { trackingDictionary } from '../../src/i18n/tracking';

// Full existing Driver milestones/POD/isolation plus bounded visual-surface GPS
// regression. The unchanged Phase 5 180-second heartbeat suite is not relabelled.
registerDriverJourneys({
  async started(h) {
    const peer = await principal('peer');
    let delivered = 0,
      denied = 0;
    async function subscribe(client: typeof peer, receive: () => void) {
      await client.realtime.setAuth();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('WAVE5_REALTIME_SUBSCRIBE_TIMEOUT')), 20000);
        client
          .channel('wave5-' + randomUUID())
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'trip_live_locations',
              filter: 'trip_id=eq.' + h.tripId,
            },
            receive,
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timer);
              resolve();
            }
          });
      });
    }
    try {
      await subscribe(h.customer, () => {
        delivered++;
      });
      await subscribe(peer, () => {
        denied++;
      });
      await h.context.grantPermissions(['geolocation'], { origin: h.baseURL });
      const point =
        h.country === 'SA'
          ? { latitude: 24.7136, longitude: 46.6753 }
          : { latitude: 30.0444, longitude: 31.2357 };
      await h.context.setGeolocation({ ...point, accuracy: 5 });
      await h.page.reload();
      await h.page.bringToFront();
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
        .toBe(point.latitude);
      await expect(
        h.page.getByText(trackingDictionary(h.locale).ACTIVE, { exact: true }),
      ).toBeVisible();
      await expect.poll(() => delivered, { timeout: 20000 }).toBeGreaterThan(0);
      await h.page.waitForTimeout(1000);
      expect(denied).toBe(0);
      await driverVisual(h.page, 'foreground-active', h.country);
      await driverVisual(h.page, 'foreground-offline', h.country);
      test.info().annotations.push({
        type: 'safe-security-probe',
        description:
          h.country +
          ': actual foreground browser publication, authorized Realtime delivery, unrelated Customer denial and offline status; no background or ETA claim',
      });
    } finally {
      await h.customer.removeAllChannels();
      await peer.removeAllChannels();
    }
  },
  async reassigned(h) {
    expect(
      (
        await h.driver.rpc('publish_trip_location', {
          p_trip: h.tripId,
          p_sample: randomUUID(),
          p_location: {
            latitude: 24,
            longitude: 30,
            accuracy: 5,
            capturedAt: new Date().toISOString(),
            clientType: 'NATIVE',
          },
        })
      ).error,
    ).not.toBeNull();
  },
  async beforePod(h, png) {
    // All bytes belong to this run. Never write/export signature content or a private path.
    const raw =
      h.country === 'SA'
        ? Buffer.from(
            (
              await h.page
                .locator('canvas')
                .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'))
            ).split(',')[1]!,
            'base64',
          )
        : png;
    const normalized = await sharp(raw).rotate().png().toBuffer();
    const file = randomUUID();
    const reserved = await h.replacement.rpc('trip_pod_command', {
      p_trip_id: h.tripId,
      p_file_id: file,
      p_action: 'reserve',
      p_recipient: 'Distinct controlled recipient',
      p_notes: '',
      p_mime: 'image/png',
      p_size: normalized.length,
    });
    expect(reserved.error).toBeNull();
    expect(
      (await admin.from('trip_pods').select('state').eq('trip_id', h.tripId).single()).data?.state,
    ).toBe('PENDING');
    await h.page.reload();
    await expect(
      h.page.getByText(driverDictionary(h.locale).podPending, { exact: true }),
    ).toBeVisible();
    await driverVisual(h.page, 'pod-reserved-pending', h.country);
    await h.page.locator('#pod-recipient').fill('Distinct controlled recipient');
    await h.page
      .locator('#pod-file')
      .setInputFiles({ name: 'run-owned-signature.png', mimeType: 'image/png', buffer: raw });
    // The normal UI reuses its own reservation and performs the real upload/finalize.
  },
  async completed(h) {
    const row = await h.customer
      .from('trip_live_locations')
      .select('active,latitude,longitude')
      .eq('trip_id', h.tripId)
      .single();
    expect(row.error).toBeNull();
    expect(row.data).toEqual({ active: false, latitude: null, longitude: null });
    test.info().annotations.push({
      type: 'safe-security-probe',
      description:
        h.country +
        ': terminal foreground coordinates removed; actual pending reservation then normal finalization verified',
    });
  },
});
