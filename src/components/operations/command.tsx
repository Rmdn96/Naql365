'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { operationsDictionary, operationLabel } from '@/i18n/operations';
import { operationResult, type OperationAction } from '@/domain/operations/model';
import { Alert, Button } from '@/components/ui/primitives';
export function useOperationalCommand(
  locale: Locale,
  organizationId: string,
  entityId: string,
  revision: number,
) {
  const router = useRouter();
  const text = operationsDictionary(locale);
  const locked = useRef(false);
  const retry = useRef<{ signature: string; mutationId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function run(action: OperationAction, payload: unknown = {}, destination?: 'job' | 'trip') {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setMessage('');
    setFailed(false);
    const signature = JSON.stringify({ action, payload, entityId, revision });
    if (retry.current?.signature !== signature)
      retry.current = { signature, mutationId: crypto.randomUUID() };
    try {
      const response = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          entityId,
          revision,
          action,
          payload,
          mutationId: retry.current.mutationId,
        }),
      });
      if (!response.ok) {
        setFailed(true);
        setMessage(response.status === 409 ? text.conflict : text.error);
        return false;
      }
      const result = operationResult.parse(await response.json());
      retry.current = null;
      setMessage(text.success);
      if (destination)
        router.push(
          `/${locale}/portal/operations/${destination === 'job' ? 'jobs' : 'trips'}/${result.id}`,
        );
      router.refresh();
      return true;
    } catch {
      setFailed(true);
      setMessage(text.error);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    feedback: message ? (
      <Alert tone={failed ? 'error' : 'success'}>
        {message}
        {failed && (
          <Button variant="secondary" onClick={() => router.refresh()}>
            {text.refresh}
          </Button>
        )}
      </Alert>
    ) : null,
  };
}
export function OperationButton({
  locale,
  organizationId,
  entityId,
  revision = 0,
  action,
  destination,
}: {
  locale: Locale;
  organizationId: string;
  entityId: string;
  revision?: number;
  action: OperationAction;
  destination?: 'job' | 'trip';
}) {
  const command = useOperationalCommand(locale, organizationId, entityId, revision);
  return (
    <div>
      <Button disabled={command.busy} onClick={() => void command.run(action, {}, destination)}>
        {operationLabel(action, locale)}
      </Button>
      {command.feedback}
    </div>
  );
}
