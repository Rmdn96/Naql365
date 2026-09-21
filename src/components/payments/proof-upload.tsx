'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentDetails } from '@/domain/payments/model';
import type { Locale } from '@/i18n/config';
import { paymentDictionary } from '@/i18n/payments';
import { Alert, Button, Input } from '@/components/ui/primitives';
export function ProofUpload({ data, locale }: { data: PaymentDetails; locale: Locale }) {
  const t = paymentDictionary(locale),
    router = useRouter();
  const locked = useRef(false),
    ids = useRef<{ fileId: string; reserveId: string; submitId: string } | null>(null);
  const removeIds = useRef<{ removeId: string; finishId: string } | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = data.attempts.find((a) => ['RESERVED', 'REMOVING'].includes(a.state));
  async function upload() {
    if (locked.current || !file) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    ids.current ??= {
      fileId: crypto.randomUUID(),
      reserveId: crypto.randomUUID(),
      submitId: crypto.randomUUID(),
    };
    const form = new FormData();
    form.set('file', file);
    form.set('orderId', data.orderId);
    form.set('revision', String(data.revision));
    for (const [key, value] of Object.entries(ids.current)) form.set(key, value);
    try {
      const result = await fetch('/api/payments/proof', { method: 'POST', body: form });
      if (!result.ok) throw new Error();
      ids.current = null;
      setFile(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (locked.current || !pending) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    removeIds.current ??= { removeId: crypto.randomUUID(), finishId: crypto.randomUUID() };
    try {
      const result = await fetch('/api/payments/proof', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: data.orderId,
          attemptId: pending.id,
          revision: data.revision,
          ...removeIds.current,
        }),
      });
      if (!result.ok) throw new Error();
      removeIds.current = null;
      router.refresh();
    } catch {
      setError(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label={t.upload}>
      {error && <Alert tone="error">{t.error}</Alert>}
      {pending ? (
        <Button disabled={busy} variant="secondary" onClick={() => void remove()}>
          {t.remove}
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void upload();
          }}
        >
          <Input
            id="transfer-proof-file"
            type="file"
            label={t.file}
            required
            accept="application/pdf,image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              ids.current = null;
            }}
          />
          <Button disabled={busy || !file}>{error ? t.retry : t.upload}</Button>
        </form>
      )}
    </section>
  );
}
