'use client';
import { useEffect, useRef } from 'react';
import { mvpAnalyticsEvent } from '@/domain/guest/analytics';
import type { z } from 'zod';
type Event = z.infer<typeof mvpAnalyticsEvent>;
export function recordMvpEvent(event: Event['event'], market: string, context: Event['context']) {
  const parsed = mvpAnalyticsEvent.safeParse({ event, market, context });
  if (!parsed.success) return;
  // Best effort; never blocks a commercial command and never includes a URL or identity.
  void fetch('/api/public/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
    keepalive: true,
  }).catch(() => undefined);
}
export function MvpView({ event, market, context }: Omit<Event, 'market'> & { market: string }) {
  const sent = useRef('');
  useEffect(() => {
    const key = `${event}:${market}:${context}`;
    if (sent.current === key) return;
    sent.current = key;
    recordMvpEvent(event, market, context);
  }, [event, market, context]);
  return null;
}
