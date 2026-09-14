'use client';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { quotesDictionary } from '@/i18n/quotes';
import { parseAmountToMinor } from '@/domain/pricing/model';
import { formatMoney } from '@/domain/markets/model';
import { Alert, Button, Input, Select, Table } from '@/components/ui/primitives';

type ComponentLine = {
  component_code: string;
  label_ar: string;
  label_en: string;
  quantity: number;
  unit_amount_minor: number;
  total_amount_minor: number;
  position: number;
};
type Evaluation = {
  id: string;
  status: string;
  calculated_subtotal_minor: number;
  currency: string;
  distance_snapshots: {
    distance_km: number;
    source_type: string;
    verified_at: string;
    source_note: string | null;
  } | null;
  pricing_evaluation_components: ComponentLine[];
};
type Version = {
  currency: string;
  id: string;
  status: string;
  version: number;
  final_subtotal_minor: number;
  vat_amount_minor: number;
  total_minor: number;
  expires_at: string | null;
};

export function SalesPricing({
  locale,
  requestId,
  vehicles,
  evaluation,
  draft,
}: {
  locale: Locale;
  requestId: string;
  vehicles: { id: string; name_ar: string; name_en: string }[];
  evaluation: Evaluation | undefined;
  draft: Version | undefined;
}) {
  const t = quotesDictionary(locale),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [distance, setDistance] = useState(''),
    [note, setNote] = useState(''),
    [vehicle, setVehicle] = useState(vehicles[0]?.id ?? ''),
    [workers, setWorkers] = useState('2');
  const [adjustment, setAdjustment] = useState('0.00'),
    [reason, setReason] = useState(''),
    [hours, setHours] = useState('48');
  async function post(url: string, body: unknown) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  const calculate = () =>
    post('/api/sales/pricing', {
      requestId,
      distanceKm: Number(distance),
      sourceNote: note,
      vehicleClassId: vehicle,
      workerCount: Number(workers),
      mutationId: crypto.randomUUID(),
    });
  const createDraft = () => {
    const minor = parseAmountToMinor(adjustment);
    if (minor === null) {
      setError(true);
      return;
    }
    void post('/api/sales/quotes', {
      evaluationId: evaluation?.id,
      adjustmentMinor: minor,
      adjustmentReason: reason,
      validitySeconds: Number(hours) * 3600,
      mutationId: crypto.randomUUID(),
    });
  };
  return (
    <div className="stack commercial-stack">
      {error && <Alert tone="error">{t.actionFailed}</Alert>}
      <section className="card stack" aria-labelledby="distance-title">
        <h2 id="distance-title">{t.verifiedDistance}</h2>
        <p>{t.distanceHelp}</p>
        <div className="form-columns">
          <Input
            id="distance"
            label={t.distanceKm}
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            required
          />
          <Input
            id="source-note"
            label={t.sourceNote}
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
          />
          <Select
            id="vehicle"
            label={t.vehicle}
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {locale === 'ar' ? v.name_ar : v.name_en}
              </option>
            ))}
          </Select>
          <Input
            id="workers"
            label={t.workers}
            type="number"
            min={1}
            max={50}
            value={workers}
            onChange={(e) => setWorkers(e.target.value)}
          />
        </div>
        <Button disabled={busy || !vehicle} onClick={calculate}>
          {t.calculate}
        </Button>
      </section>
      {evaluation && (
        <section className="card stack">
          <h2>{t.calculated}</h2>
          <p className="eyebrow">
            {t.distanceSource}: {t.manualVerified} ·{' '}
            <bdi>{evaluation.distance_snapshots?.distance_km} km</bdi>
          </p>
          <Table
            caption={t.breakdown}
            columns={[t.breakdown, t.quantity, t.unitPrice, t.amount]}
            rows={[...evaluation.pricing_evaluation_components]
              .sort((a, b) => a.position - b.position)
              .map((line) => [
                locale === 'ar' ? line.label_ar : line.label_en,
                <bdi key="q">{line.quantity}</bdi>,
                <bdi key="u">
                  {formatMoney(line.unit_amount_minor, evaluation.currency, locale)}
                </bdi>,
                <bdi key="a">
                  {formatMoney(line.total_amount_minor, evaluation.currency, locale)}
                </bdi>,
              ])}
          />
          <strong>
            {t.calculated}:{' '}
            <bdi>
              {formatMoney(evaluation.calculated_subtotal_minor, evaluation.currency, locale)}
            </bdi>
          </strong>
          {evaluation.status === 'CURRENT' && (
            <>
              <h3>{t.internal}</h3>
              <div className="form-columns">
                <Input
                  id="adjustment"
                  label={t.adjustment}
                  inputMode="decimal"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                />
                <Input
                  id="adjustment-reason"
                  label={t.adjustmentReason}
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Input
                  id="validity"
                  label={t.validity}
                  type="number"
                  min={1}
                  max={720}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
              </div>
              <Button disabled={busy} onClick={createDraft}>
                {t.createDraft}
              </Button>
            </>
          )}
        </section>
      )}
      {draft && (
        <section className="card stack">
          <h2>
            {t.quote} · {t.version} {draft.version}
          </h2>
          <p>
            <strong>{t.finalSubtotal}: </strong>
            <bdi>{formatMoney(draft.final_subtotal_minor, draft.currency, locale)}</bdi>
          </p>
          <p>
            <strong>{t.vat}: </strong>
            <bdi>{formatMoney(draft.vat_amount_minor, draft.currency, locale)}</bdi>
          </p>
          <p className="commercial-total">
            <strong>{t.total}: </strong>
            <bdi>{formatMoney(draft.total_minor, draft.currency, locale)}</bdi>
          </p>
          <Button disabled={busy} onClick={() => post(`/api/sales/quotes/${draft.id}/send`, {})}>
            {t.sendQuote}
          </Button>
        </section>
      )}
    </div>
  );
}
