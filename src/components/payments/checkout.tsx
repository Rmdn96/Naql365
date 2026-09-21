'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { z } from 'zod';
import type { PaymentDetails, paymentCommand } from '@/domain/payments/model';
import type { Locale } from '@/i18n/config';
import { paymentDictionary } from '@/i18n/payments';
import { Alert, Badge, Button, Card, Input } from '@/components/ui/primitives';
import { ProofUpload } from './proof-upload';
import { formatMoney } from '@/domain/markets/model';

type Command = z.infer<typeof paymentCommand>;
export function Checkout({
  data,
  locale,
  finance = false,
}: {
  data: PaymentDetails;
  locale: Locale;
  finance?: boolean;
}) {
  const t = paymentDictionary(locale),
    router = useRouter();
  const locked = useRef(false),
    pending = useRef<{ intent: string; mutationId: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<'error' | 'success' | null>(null);
  const [reference, setReference] = useState(''),
    [note, setNote] = useState(''),
    [reason, setReason] = useState('');
  const money = (minor: number) => formatMoney(minor, data.currency, locale);
  async function act(command: Pick<Command, 'action' | 'payload'>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFeedback(null);
    const intent = JSON.stringify({ ...command, revision: data.revision });
    if (pending.current?.intent !== intent)
      pending.current = { intent, mutationId: crypto.randomUUID() };
    try {
      const result = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...command,
          orderId: data.orderId,
          revision: data.revision,
          mutationId: pending.current.mutationId,
        }),
      });
      if (!result.ok) throw new Error();
      pending.current = null;
      setFeedback('success');
      router.refresh();
    } catch {
      setFeedback('error');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function proof(id: string) {
    try {
      const response = await fetch(`/api/payments/proof/${id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || !('url' in body) || typeof body.url !== 'string')
        throw new Error();
      // The server constructs this short-lived Storage URL after database authorization.
      window.location.assign(body.url);
    } catch {
      setFeedback('error');
    }
  }
  const submitted = data.attempts.find((a) => a.state === 'SUBMITTED');
  const confirmation = { amountMinor: data.totalMinor, currency: data.currency, reference, note };
  return (
    <div className="stack">
      <Badge>{t.states[data.status]}</Badge>
      <Card>
        <h2>
          <bdi>{data.reference}</bdi>
        </h2>
        <dl>
          <dt>{t.subtotal}</dt>
          <dd>{money(data.subtotalMinor)}</dd>
          <dt>{(locale === 'ar' ? data.taxLabelAr : data.taxLabelEn) || t.tax}</dt>
          <dd>{money(data.taxMinor)}</dd>
          <dt>{t.total}</dt>
          <dd>
            <strong>{money(data.totalMinor)}</strong>
          </dd>
        </dl>
      </Card>
      {feedback && <Alert tone={feedback === 'error' ? 'error' : 'success'}>{t[feedback]}</Alert>}
      {!finance && data.canSwitch && (
        <Card>
          <h2>{t.choose}</h2>
          <div className="actions">
            <Button
              disabled={busy || data.method === 'CASH'}
              onClick={() => void act({ action: 'choose', payload: { method: 'CASH' } })}
            >
              {t.cash}
            </Button>
            <Button
              disabled={busy || !data.bank || data.method === 'BANK_TRANSFER'}
              onClick={() => void act({ action: 'choose', payload: { method: 'BANK_TRANSFER' } })}
            >
              {t.transfer}
            </Button>
          </div>
        </Card>
      )}
      {data.method === 'CASH' && <p>{t.cashHelp}</p>}
      {data.method === 'BANK_TRANSFER' && (
        <>
          <p>{t.transferHelp}</p>
          {data.bank && (
            <Card>
              <h2>{t.transfer}</h2>
              <dl>
                <dt>{t.bank}</dt>
                <dd>{locale === 'ar' ? data.bank.bankNameAr : data.bank.bankNameEn}</dd>
                <dt>{t.beneficiary}</dt>
                <dd>{locale === 'ar' ? data.bank.beneficiaryAr : data.bank.beneficiaryEn}</dd>
                {data.bank.iban && (
                  <>
                    <dt>{t.iban}</dt>
                    <dd>
                      <bdi>{data.bank.iban}</bdi>
                    </dd>
                  </>
                )}
                {data.bank.accountNumber && (
                  <>
                    <dt>{t.account}</dt>
                    <dd>
                      <bdi>{data.bank.accountNumber}</bdi>
                    </dd>
                  </>
                )}
                {data.bank.bic && (
                  <>
                    <dt>{t.bic}</dt>
                    <dd>
                      <bdi>{data.bank.bic}</bdi>
                    </dd>
                  </>
                )}
              </dl>
              <p>{locale === 'ar' ? data.bank.instructionsAr : data.bank.instructionsEn}</p>
            </Card>
          )}
        </>
      )}
      {!finance &&
        data.method === 'BANK_TRANSFER' &&
        ['AWAITING_TRANSFER_PROOF', 'TRANSFER_REJECTED'].includes(data.status) && (
          <ProofUpload key={data.revision} data={data} locale={locale} />
        )}
      {data.attempts.length > 0 && (
        <Card>
          <h2>{t.history}</h2>
          <ol>
            {data.attempts.map((a) => (
              <li key={a.id}>
                <p>
                  {a.number} · {t.attempts[a.state]}
                </p>
                {a.rejectionReason && <p>{a.rejectionReason}</p>}
                {['SUBMITTED', 'REJECTED', 'CONFIRMED'].includes(a.state) && (
                  <Button variant="secondary" onClick={() => void proof(a.id)}>
                    {t.proof}
                  </Button>
                )}
                {finance && a.financeNote && <p>{a.financeNote}</p>}
              </li>
            ))}
          </ol>
        </Card>
      )}
      {finance && (data.status === 'CASH_DUE' || submitted) && (
        <Card>
          <h2>{t.finance}</h2>
          <p>{t.confirmHelp}</p>
          <Input
            id="payment-reference"
            label={t.reference}
            value={reference}
            maxLength={120}
            onChange={(e) => setReference(e.target.value)}
          />
          <Input
            id="payment-note"
            label={t.note}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            disabled={busy}
            onClick={() =>
              void act(
                submitted
                  ? {
                      action: 'confirm_transfer',
                      payload: { ...confirmation, attemptId: submitted.id },
                    }
                  : { action: 'confirm_cash', payload: confirmation },
              )
            }
          >
            {submitted ? t.confirmTransfer : t.confirmCash}
          </Button>
          {submitted && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act({
                  action: 'reject_transfer',
                  payload: { attemptId: submitted.id, reason, note },
                });
              }}
            >
              <Input
                id="payment-reason"
                label={t.reason}
                required
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button variant="secondary" disabled={busy || !reason.trim()}>
                {t.reject}
              </Button>
            </form>
          )}
        </Card>
      )}
      {data.receipt && (
        <Card>
          <h2>{t.receipt}</h2>
          <p>
            <bdi>{data.receipt.reference}</bdi>
          </p>
          <p>{money(data.totalMinor)}</p>
          <p>{t.receiptHelp}</p>
        </Card>
      )}
      <Button variant="secondary" disabled={busy} onClick={() => router.refresh()}>
        {t.refresh}
      </Button>
    </div>
  );
}
