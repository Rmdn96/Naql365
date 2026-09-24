'use client';
import { useHydrated } from '@/components/ui/use-hydrated';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { quotesDictionary } from '@/i18n/quotes';
import { Alert, Button, Input } from '@/components/ui/primitives';
import { z } from 'zod';

export function QuoteActions({
  locale,
  quoteVersionId,
}: {
  locale: Locale;
  quoteVersionId: string;
}) {
  const hydrated = useHydrated();
  const t = quotesDictionary(locale),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [message, setMessage] = useState<string>();
  async function respond(action: 'accept' | 'reject') {
    if (!window.confirm(action === 'accept' ? t.confirmAccept : t.confirmReject)) return;
    setBusy(true);
    setMessage(undefined);
    const response = await fetch(`/api/customer/quotes/${quoteVersionId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, idempotencyKey: crypto.randomUUID(), reason }),
    });
    if (!response.ok) {
      setMessage(t.actionFailed);
      setBusy(false);
      return;
    }
    setMessage(action === 'accept' ? t.accepted : t.rejected);
    if (action === 'accept') {
      const result = z.object({ order_id: z.uuid() }).safeParse(await response.json());
      if (result.success) {
        router.push(`/${locale}/account/orders/${result.data.order_id}/payment`);
        return;
      }
    }
    window.location.reload();
  }
  return (
    <section className="card stack" aria-label={t.quoteDetails}>
      {message && <Alert tone={message === t.actionFailed ? 'error' : 'success'}>{message}</Alert>}
      <Input
        disabled={!hydrated}
        id="rejection-reason"
        label={t.rejectionReason}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="actions">
        <Button disabled={!hydrated || busy} onClick={() => respond('accept')}>
          {t.accept}
        </Button>
        <Button variant="secondary" disabled={!hydrated || busy} onClick={() => respond('reject')}>
          {t.reject}
        </Button>
      </div>
    </section>
  );
}
