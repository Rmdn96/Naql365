'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { driverDictionary } from '@/i18n/driver';
import { Button, Input, Alert } from '@/components/ui/primitives';
export function ResolveIssue({ id, locale }: { id: string; locale: Locale }) {
  const t = driverDictionary(locale),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    reason = useRef<string | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        reason.current ??= String(new FormData(e.currentTarget).get('reason'));
        setBusy(true);
        try {
          const result = await fetch('/api/operations/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issueId: id, reason: reason.current }),
          });
          if (!result.ok) throw new Error();
          router.refresh();
        } catch {
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input
        id={`resolve-${id}`}
        name="reason"
        label={t.resolution}
        required
        maxLength={1000}
        disabled={busy || error}
      />
      <Button disabled={busy}>{t.resolve}</Button>
      {error && <Alert tone="error">{t.retry}</Alert>}
    </form>
  );
}
