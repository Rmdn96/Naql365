'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import { Button, Alert } from '@/components/ui/primitives';
export function CleanupAttachments({
  locale,
  requestId,
  fileIds,
}: {
  locale: Locale;
  requestId: string;
  fileIds: string[];
}) {
  const t = customerDictionary(locale),
    router = useRouter();
  const [pending, setPending] = useState(false),
    [failed, setFailed] = useState(false);
  async function cleanup() {
    setPending(true);
    setFailed(false);
    try {
      for (const fileId of fileIds) {
        const r = await fetch(`/api/customer/requests/${requestId}/files`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId }),
        });
        if (!r.ok) throw new Error('Cleanup pending');
      }
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Alert>{t.cancelCleanup}</Alert>
      <Button onClick={() => void cleanup()} disabled={pending}>
        {pending ? t.loading : t.removePending}
      </Button>
      {failed && <Alert tone="error">{t.error}</Alert>}
    </>
  );
}
