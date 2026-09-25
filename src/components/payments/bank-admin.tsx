'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { bankConfiguration } from '@/domain/payments/model';
import type { z } from 'zod';
import type { Locale } from '@/i18n/config';
import { paymentDictionary } from '@/i18n/payments';
import { Alert, Button, Input, Select } from '@/components/ui/primitives';
type Details = z.infer<typeof bankConfiguration>['details'];
export function BankForm({
  locale,
  organizationId,
  markets,
  existing,
}: {
  locale: Locale;
  organizationId: string;
  markets: { id: string; name_ar: string; name_en: string; currency: string }[];
  existing?: { id: string; revision: number; marketId: string; details: Details };
}) {
  const t = paymentDictionary(locale),
    router = useRouter();
  const locked = useRef(false),
    request = useRef<{ intent: string; mutationId: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const fields = [
    'bankNameAr',
    'bankNameEn',
    'beneficiaryAr',
    'beneficiaryEn',
    'iban',
    'accountNumber',
    'bic',
    'instructionsAr',
    'instructionsEn',
  ] as const;
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError(false);
        const values = new FormData(e.currentTarget),
          details = Object.fromEntries(fields.map((f) => [f, values.get(f)]));
        const body = {
          organizationId,
          marketId: existing?.marketId ?? values.get('marketId'),
          revision: existing?.revision ?? 0,
          details: {
            ...details,
            active: values.get('active') === 'on',
            primary: values.get('primary') === 'on',
          },
        };
        const intent = JSON.stringify(body);
        if (request.current?.intent !== intent)
          request.current = {
            intent,
            mutationId: crypto.randomUUID(),
            id: existing?.id ?? crypto.randomUUID(),
          };
        try {
          const parsed = bankConfiguration.parse({
            ...body,
            mutationId: request.current.mutationId,
            id: request.current.id,
          });
          const result = await fetch('/api/payments/banks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed),
          });
          if (!result.ok) throw new Error();
          request.current = null;
          router.refresh();
        } catch {
          setError(true);
        } finally {
          locked.current = false;
          setBusy(false);
        }
      }}
    >
      <h2>
        {existing
          ? locale === 'ar'
            ? existing.details.bankNameAr
            : existing.details.bankNameEn
          : t.addBank}
      </h2>
      {error && <Alert tone="error">{t.error}</Alert>}
      <Select
        id={`bank-market-${existing?.id ?? 'new'}`}
        name="marketId"
        label={t.market}
        defaultValue={existing?.marketId ?? ''}
        disabled={Boolean(existing) || busy}
        required
      >
        <option value="">{t.market}</option>
        {markets.map((m) => (
          <option key={m.id} value={m.id}>
            {locale === 'ar' ? m.name_ar : m.name_en} · {m.currency}
          </option>
        ))}
      </Select>
      {fields.map((f) => (
        <Input
          key={f}
          id={`${existing?.id ?? 'new'}-${f}`}
          name={f}
          label={f === 'accountNumber' ? t.account : t[f]}
          defaultValue={existing?.details[f] ?? ''}
          required={['bankNameAr', 'bankNameEn', 'beneficiaryAr', 'beneficiaryEn'].includes(f)}
          maxLength={f.startsWith('instructions') ? 1500 : f.startsWith('beneficiary') ? 160 : 120}
          disabled={busy}
        />
      ))}
      <Input
        id={`${existing?.id ?? 'new'}-active`}
        name="active"
        type="checkbox"
        label={t.active}
        defaultChecked={existing?.details.active ?? true}
        disabled={busy}
      />
      <Input
        id={`${existing?.id ?? 'new'}-primary`}
        name="primary"
        type="checkbox"
        label={t.primary}
        defaultChecked={existing?.details.primary ?? true}
        disabled={busy}
      />
      <Button disabled={busy}>{t.saveBank}</Button>
    </form>
  );
}
