'use client';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { quotesDictionary } from '@/i18n/quotes';
import { Alert, Button, Input } from '@/components/ui/primitives';

export function QuoteActions({
  locale,
  quoteVersionId,
}: {
  locale: Locale;
  quoteVersionId: string;
}) {
  const t = quotesDictionary(locale),
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
    window.location.reload();
  }
  return (
    <section className="card stack" aria-label={t.quoteDetails}>
      {message && <Alert tone={message === t.actionFailed ? 'error' : 'success'}>{message}</Alert>}
      <Input
        id="rejection-reason"
        label={t.rejectionReason}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="actions">
        <Button disabled={busy} onClick={() => respond('accept')}>
          {t.accept}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => respond('reject')}>
          {t.reject}
        </Button>
      </div>
    </section>
  );
}
