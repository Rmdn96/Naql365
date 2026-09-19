'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  trackingPolicy,
  trackingTrip,
  freshness,
  type TrackingTrip,
  type TrackingPolicy,
} from '@/domain/tracking/model';
import { trackingDictionary } from '@/i18n/tracking';
import type { Locale } from '@/i18n/config';
import { operationalStatus } from '@/i18n/operations';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser';
import { OpenStreetMap } from './map';
const responseSchema = z.object({ trips: trackingTrip.array().max(50), policy: trackingPolicy });
export function TrackingView({
  locale,
  orderId,
  tripId,
  operations = false,
}: {
  locale: Locale;
  orderId?: string;
  tripId?: string;
  operations?: boolean;
}) {
  const t = trackingDictionary(locale),
    [data, setData] = useState<{ trips: TrackingTrip[]; policy: TrackingPolicy } | null>(null),
    [error, setError] = useState(false),
    [now, setNow] = useState(0),
    [page, setPage] = useState(0),
    [filter, setFilter] = useState({ market: '', driver: '', trip: '', fresh: '' }),
    [reload, setReload] = useState(0);
  const ids =
    data?.trips
      .map((p) => p.id)
      .sort()
      .join(',') ?? '';
  useEffect(() => {
    let disposed = false,
      busy = false;
    const abort = new AbortController();
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const query = new URLSearchParams({ offset: String(page * 50) });
        if (orderId) query.set('orderId', orderId);
        if (tripId || filter.trip) query.set('tripId', tripId ?? filter.trip);
        if (filter.driver) query.set('driverId', filter.driver);
        const response = await fetch('/api/tracking?' + query, {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (!response.ok) throw Error('unavailable');
        const parsed = responseSchema.parse(await response.json());
        if (!disposed) {
          setData(parsed);
          setError(false);
          setNow(Date.now());
        }
      } catch {
        if (!disposed) {
          setData(null);
          setError(true);
        }
      } finally {
        busy = false;
      }
    };
    void load();
    const refresh = setInterval(() => void load(), 30000),
      clock = setInterval(() => setNow(Date.now()), 1000);
    const client = createSupabaseBrowserClient();
    const channel = ids
      ? client
          .channel('tracking-' + crypto.randomUUID())
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'trip_live_locations',
              filter: `trip_id=in.(${ids})`,
            },
            () => void load(),
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'trip_live_locations',
              filter: `trip_id=in.(${ids})`,
            },
            () => void load(),
          )
          .subscribe()
      : null;
    const visible = () => {
      if (document.hidden) {
        setData(null);
      } else void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      abort.abort();
      clearInterval(refresh);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', visible);
      if (channel) void client.removeChannel(channel);
    };
  }, [ids, orderId, tripId, page, filter.driver, filter.trip, reload]);
  const trips =
    data?.trips.filter(
      (p) =>
        (!filter.market || p.market.countryCode === filter.market) &&
        (!filter.fresh ||
          freshness(p.active, p.location?.receivedAt ?? null, data.policy, now) === filter.fresh),
    ) ?? [];
  return (
    <section>
      <h2>{t.title}</h2>
      {operations && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setFilter({
              market: String(form.get('market') ?? ''),
              driver: String(form.get('driver') ?? ''),
              trip: String(form.get('trip') ?? ''),
              fresh: String(form.get('fresh') ?? ''),
            });
            setPage(0);
          }}
        >
          <label>
            {t.market}
            <select name="market">
              <option value="">{t.all}</option>
              <option value="SA">SA</option>
              <option value="EG">EG</option>
            </select>
          </label>
          <label>
            {t.driver}
            <input name="driver" />
          </label>
          <label>
            {t.trip}
            <input name="trip" />
          </label>
          <label>
            {t.title}
            <select name="fresh">
              <option value="">{t.all}</option>
              {(['LIVE', 'STALE', 'UNAVAILABLE'] as const).map((v) => (
                <option key={v} value={v}>
                  {t[v]}
                </option>
              ))}
            </select>
          </label>
          <button>{t.filter}</button>
        </form>
      )}
      {error && <p role="alert">{t.UNAVAILABLE}</p>}
      <button type="button" onClick={() => setReload((v) => v + 1)}>
        {t.retry}
      </button>
      {!trips.length && <p>{t.empty}</p>}
      <OpenStreetMap
        locale={locale}
        points={trips.flatMap((p) =>
          p.active && p.location
            ? [
                {
                  id: p.id,
                  latitude: p.location.latitude,
                  longitude: p.location.longitude,
                  label: p.reference,
                },
              ]
            : [],
        )}
      />
      <ul className="request-list">
        {trips.map((p) => (
          <li key={p.id}>
            <article>
              <h3>{p.reference}</h3>
              <p>
                {operationalStatus(p.status, locale)} · {p.market.countryCode}
              </p>
              <p>
                {data
                  ? t[freshness(p.active, p.location?.receivedAt ?? null, data.policy, now)]
                  : t.UNAVAILABLE}
              </p>
              {p.location && (
                <p>
                  {t.updated}:{' '}
                  <time dateTime={p.location.receivedAt}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                      timeZone: p.market.timezone,
                    }).format(new Date(p.location.receivedAt))}
                  </time>
                </p>
              )}
              <p>{t.eta}</p>
              {p.nextStop && (
                <p>
                  {t.nextStop}: {p.nextStop.kind === 'PICKUP' ? t.pickup : t.delivery}{' '}
                  {p.nextStop.position}
                </p>
              )}
            </article>
          </li>
        ))}
      </ul>
      <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
        {t.previous}
      </button>
      <button
        type="button"
        disabled={(data?.trips.length ?? 0) < 50 || page >= 200}
        onClick={() => setPage((p) => p + 1)}
      >
        {t.next}
      </button>
    </section>
  );
}
