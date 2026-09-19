'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser';
import type { Locale } from '@/i18n/config';
import { trackingDictionary } from '@/i18n/tracking';
const schema = z
  .array(
    z.object({
      id: z.uuid(),
      event_code: z.enum(['TRIP_STARTED', 'TRIP_COMPLETED', 'TRIP_REASSIGNED', 'ISSUE_REPORTED']),
      created_at: z.string(),
      read_at: z.string().nullable(),
      timezone: z.string(),
    }),
  )
  .max(50);
export function InAppNotifications({ locale }: { locale: Locale }) {
  const t = trackingDictionary(locale),
    [items, setItems] = useState<z.infer<typeof schema>>([]),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false,
      busy = false;
    const abort = new AbortController(),
      client = createSupabaseBrowserClient();
    let channel: ReturnType<typeof client.channel> | undefined;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await fetch('/api/notifications', { cache: 'no-store', signal: abort.signal });
        if (!r.ok) throw Error('unavailable');
        const data = schema.parse(await r.json());
        if (!disposed) {
          setItems(data);
          setError(false);
        }
      } catch {
        if (!disposed) {
          setItems([]);
          setError(true);
        }
      } finally {
        busy = false;
      }
    };
    void load();
    void client.auth.getUser().then(({ data }) => {
      if (disposed || !data.user) return;
      channel = client
        .channel('notifications-' + crypto.randomUUID())
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_profile_id=eq.${data.user.id}`,
          },
          () => void load(),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_profile_id=eq.${data.user.id}`,
          },
          () => void load(),
        )
        .subscribe();
    });
    const timer = setInterval(() => void load(), 30000);
    return () => {
      disposed = true;
      abort.abort();
      clearInterval(timer);
      if (channel) void client.removeChannel(channel);
    };
  }, [refresh]);
  async function read(id: string) {
    try {
      const r = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw Error('unavailable');
      setRefresh((n) => n + 1);
    } catch {
      setError(true);
    }
  }
  return (
    <section>
      <h2>{t.notifications}</h2>
      {error && <p role="alert">{t.ERROR}</p>}
      <ul>
        {items.map((n) => (
          <li key={n.id}>
            <p>{t[n.event_code]}</p>
            <time dateTime={n.created_at}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: n.timezone,
              }).format(new Date(n.created_at))}
            </time>
            {n.read_at ? (
              <span> · {t.read}</span>
            ) : (
              <button type="button" onClick={() => void read(n.id)}>
                {t.markRead}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setRefresh((v) => v + 1)}>
        {t.retry}
      </button>
    </section>
  );
}
