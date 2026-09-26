'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { guestSecret, guestContinuationPath, secretFromFragment } from '@/domain/guest/capability';
import { publicCountry } from '@/domain/markets/public-contact';
import { guestDictionary } from '@/i18n/guest';
import type { Locale } from '@/i18n/config';
import { Button, Select, Alert } from '@/components/ui/primitives';

export function GuestStart({ locale }: { locale: Locale }) {
  const t = guestDictionary(locale),
    router = useRouter();
  const [country, setCountry] = useState('SA'),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const [journey, setJourney] = useState<{ token: string; request: { id: string } } | null>(null),
    [copied, setCopied] = useState(false);
  const busy = useRef(false);
  async function start() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      const response = await fetch('/api/guest/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: publicCountry.parse(country) }),
      });
      if (!response.ok) throw new Error('unavailable');
      setJourney(
        z
          .object({ token: guestSecret, request: z.object({ id: z.uuid() }) })
          .parse(await response.json()),
      );
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function copy() {
    if (!journey) return;
    try {
      await navigator.clipboard.writeText(
        new URL(guestContinuationPath(locale, journey.token), window.location.origin).href,
      );
      setCopied(true);
    } catch {
      setError(true);
    }
  }
  return (
    <section className="container page">
      <h1>{journey ? t.keepLink : t.title}</h1>
      <p>{journey ? t.linkNotice : t.intro}</p>
      {journey ? (
        <>
          <Button onClick={copy}>{copied ? t.copied : t.copy}</Button>{' '}
          <Button onClick={() => router.push(`/${locale}/guest/requests/${journey.request.id}`)}>
            {t.proceed}
          </Button>
        </>
      ) : (
        <>
          <Select
            id="guest-country"
            label={t.country}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            disabled={pending}
          >
            <option value="SA">{t.sa}</option>
            <option value="EG">{t.eg}</option>
          </Select>
          <Button onClick={start} disabled={pending}>
            {pending ? t.opening : t.start}
          </Button>
        </>
      )}
      {error && <Alert tone="error">{t.error}</Alert>}
    </section>
  );
}

export function GuestExchange({ locale }: { locale: Locale }) {
  const router = useRouter(),
    t = guestDictionary(locale);
  const secret = useRef<string | null>(null),
    started = useRef(false);
  const [failed, setFailed] = useState(false);
  const exchange = useCallback(async () => {
    setFailed(false);
    try {
      if (!secret.current) throw new Error('unavailable');
      const response = await fetch('/api/guest/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: secret.current }),
      });
      if (!response.ok) throw new Error('unavailable');
      const { requestId } = z.object({ requestId: z.uuid() }).parse(await response.json());
      secret.current = null;
      router.replace(`/${locale}/guest/requests/${requestId}`);
    } catch {
      setFailed(true);
    }
  }, [locale, router]);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    secret.current = secretFromFragment(window.location.hash);
    // Remove the capability before fetching any journey data. Never place it in a query/path.
    window.history.replaceState(null, '', window.location.pathname);
    void exchange();
  }, [exchange]);
  return (
    <section className="container page" aria-live="polite">
      <h1>{t.request}</h1>
      {failed ? (
        <>
          <Alert tone="error">{t.unavailable}</Alert>
          <Button onClick={exchange}>{t.retry}</Button>
        </>
      ) : (
        <p>{t.opening}</p>
      )}
    </section>
  );
}
