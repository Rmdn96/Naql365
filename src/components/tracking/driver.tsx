'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';
import { trackingDictionary } from '@/i18n/tracking';
import {
  locationSample,
  trackingPolicy,
  publicationDue,
  type LocationSample,
  type TrackingPolicy,
} from '@/domain/tracking/model';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser';
const reply = z.object({
  status: z.enum(['ACCEPTED', 'REPLAY', 'THROTTLED', 'OUT_OF_ORDER']),
  receivedAt: z.string().optional(),
  retryAt: z.string().optional(),
});
type State =
  'ACTIVE' | 'WAITING' | 'DENIED' | 'OFFLINE' | 'STOPPED' | 'OTHER_TAB' | 'ERROR' | 'STALE';
export function DriverTracking({
  tripId,
  eligible,
  locale,
}: {
  tripId: string;
  eligible: boolean;
  locale: Locale;
}) {
  const [state, setState] = useState<State>('STOPPED'),
    t = trackingDictionary(locale);
  useEffect(() => {
    if (!eligible) return;
    let disposed = false,
      watch: number | undefined,
      policy: TrackingPolicy | undefined,
      sample: LocationSample | null = null,
      last: { sample: LocationSample; receivedAt: number } | null = null;
    let pending: { tripId: string; sampleId: string; location: LocationSample } | null = null,
      busy = false,
      notBefore = 0,
      release: (() => void) | undefined,
      starting = false;
    const abort = new AbortController();
    const stop = () => {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      watch = undefined;
      sample = null;
      release?.();
      release = undefined;
    };
    const denied = () => {
      stop();
      if (!disposed) setState('STOPPED');
    };
    const startWatch = () => {
      if (disposed || document.hidden || watch !== undefined) return;
      if (!navigator.geolocation) {
        setState('DENIED');
        return;
      }
      setState('WAITING');
      watch = navigator.geolocation.watchPosition(
        (position) => {
          const parsed = locationSample.safeParse({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            capturedAt: new Date(position.timestamp).toISOString(),
            clientType: 'WEB',
          });
          if (parsed.success) sample = parsed.data;
          else setState('WAITING');
        },
        (error) => {
          if (!disposed) setState(error.code === 1 ? 'DENIED' : 'WAITING');
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
      );
    };
    const acquire = async () => {
      if (starting || disposed || document.hidden || watch !== undefined) return;
      starting = true;
      try {
        if (navigator.locks) {
          await navigator.locks.request(
            'naql365-driver-location',
            { ifAvailable: true },
            async (lock) => {
              if (!lock) {
                if (!disposed) setState('OTHER_TAB');
                return;
              }
              if (disposed) return;
              startWatch();
              await new Promise<void>((resolve) => {
                release = resolve;
                if (disposed) resolve();
              });
            },
          );
        } else startWatch();
      } catch {
        if (!disposed) setState('ERROR');
      } finally {
        starting = false;
      }
    };
    const authority = async () => {
      if (disposed || document.hidden) return;
      try {
        const response = await fetch(
          '/api/tracking?mode=driver&tripId=' + encodeURIComponent(tripId),
          {
            cache: 'no-store',
            signal: abort.signal,
          },
        );
        if (response.status === 401 || response.status === 403) {
          denied();
          return;
        }
        if (!response.ok) throw Error('unavailable');
        const body: unknown = await response.json();
        const parsed = z
          .object({
            policy: trackingPolicy,
            trips: z.array(z.object({ id: z.string(), active: z.boolean() })),
          })
          .parse(body);
        policy = parsed.policy;
        if (!parsed.trips.find((r) => r.id === tripId)?.active) {
          denied();
          return;
        }
        void acquire();
      } catch {
        if (!disposed) {
          stop();
          setState(navigator.onLine ? 'ERROR' : 'OFFLINE');
        }
      }
    };
    const publish = async () => {
      if (
        !disposed &&
        policy &&
        last &&
        Date.now() - last.receivedAt >= policy.staleSeconds * 1000 &&
        navigator.onLine
      )
        setState('STALE');
      if (
        disposed ||
        document.hidden ||
        watch === undefined ||
        busy ||
        !policy ||
        Date.now() < notBefore
      )
        return;
      if (!navigator.onLine) {
        setState('OFFLINE');
        return;
      }
      if (
        pending &&
        Date.now() - Date.parse(pending.location.capturedAt) > policy.maxAgeSeconds * 1000
      )
        pending = null;
      if (!pending) {
        if (!sample || !publicationDue(sample, last, policy, Date.now())) return;
        pending = { tripId, sampleId: crypto.randomUUID(), location: sample };
      }
      const intent = pending;
      busy = true;
      try {
        const response = await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intent),
          signal: abort.signal,
        });
        if (response.status === 401 || response.status === 403) {
          pending = null;
          denied();
          return;
        }
        if (!response.ok) {
          if (response.status === 400) pending = null;
          throw Error('unavailable');
        }
        const result = reply.parse(await response.json());
        if (result.status === 'ACCEPTED' || result.status === 'REPLAY') {
          last = { sample: intent.location, receivedAt: Date.parse(result.receivedAt!) };
          if (!disposed && watch !== undefined) setState('ACTIVE');
        }
        if (result.status === 'THROTTLED') {
          notBefore = Date.parse(result.retryAt!);
          if (!disposed) setState('WAITING');
        }
        pending = null;
      } catch {
        notBefore = Date.now() + 10000;
        if (!disposed) setState(navigator.onLine ? 'ERROR' : 'OFFLINE');
      } finally {
        busy = false;
      }
    };
    const visibility = () => {
      if (document.hidden) {
        stop();
        setState('STOPPED');
      } else void authority();
    };
    const client = createSupabaseBrowserClient();
    const auth = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') denied();
    });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', authority);
    void authority();
    const authTimer = setInterval(() => void authority(), 30000),
      timer = setInterval(() => void publish(), 1000);
    return () => {
      disposed = true;
      abort.abort();
      stop();
      clearInterval(timer);
      clearInterval(authTimer);
      auth.data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', authority);
    };
  }, [tripId, eligible]);
  return (
    <section className="card" aria-label={t.title}>
      <h2>{t.title}</h2>
      <p role="status">{t[eligible ? state : 'STOPPED']}</p>
      <p>{t.foreground}</p>
    </section>
  );
}
