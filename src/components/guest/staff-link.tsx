'use client';
import { useRef, useState } from 'react';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';
import { guestDictionary } from '@/i18n/guest';
import { guestSecret, guestContinuationPath } from '@/domain/guest/capability';
import { Button, Card, Alert } from '@/components/ui/primitives';
export function StaffGuestLink({ locale, requestId }: { locale: Locale; requestId: string }) {
  const t = guestDictionary(locale),
    locked = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [copied, setCopied] = useState(false);
  const [secret, setSecret] = useState<string | null>(null),
    [revoked, setRevoked] = useState(false);
  async function act(action: 'replace' | 'revoke') {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    setCopied(false);
    setSecret(null);
    try {
      const response = await fetch('/api/sales/guest-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      if (!response.ok) throw new Error();
      const result = z
        .object({ guest: z.literal(true), active: z.boolean(), token: guestSecret.nullable() })
        .parse(await response.json());
      setSecret(result.token);
      setRevoked(!result.active);
    } catch {
      setError(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(
        new URL(guestContinuationPath(locale, secret), window.location.origin).href,
      );
      setCopied(true);
    } catch {
      setError(true);
    }
  }
  return (
    <Card>
      <h2>{t.staffTitle}</h2>
      <p>{t.staffHelp}</p>
      {error && <Alert tone="error">{t.error}</Alert>}
      {revoked && <p role="status">{t.revoked}</p>}
      <div className="actions">
        <Button disabled={busy} onClick={() => void act('replace')}>
          {t.replaceLink}
        </Button>
        <Button disabled={busy} variant="secondary" onClick={() => void act('revoke')}>
          {t.revokeLink}
        </Button>
        {secret && <Button onClick={() => void copy()}>{copied ? t.copied : t.copy}</Button>}
      </div>
    </Card>
  );
}
