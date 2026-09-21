'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { operationsDictionary, operationLabel, operationalStatus } from '@/i18n/operations';
import { nextStopAction, type OperationAction } from '@/domain/operations/model';
import type { OperationalTrip } from '@/infrastructure/operations/service';
import { Alert, Badge, Button, Input, Select } from '@/components/ui/primitives';
import { useOperationalCommand } from './command';
export function TripControls({
  locale,
  data,
  executionAllowed,
}: {
  locale: Locale;
  data: OperationalTrip;
  executionAllowed: boolean;
}) {
  const t = operationsDictionary(locale);
  const command = useOperationalCommand(
    locale,
    data.trip.organization_id,
    data.trip.id,
    data.trip.revision,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [exception, setException] = useState<'reassign' | 'cancel' | 'fail'>('reassign');
  const active = data.assignments.find((a) => !a.ended_at);
  const [driver, setDriver] = useState(active?.driver_id ?? '');
  const [vehicle, setVehicle] = useState(active?.vehicle_id ?? '');
  const terminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(data.trip.status);
  const stop = data.stops.find((s) => s.status !== 'COMPLETED');
  const next = stop
    ? nextStopAction(
        stop.status as 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED',
      )
    : null;
  const resources = (
    <>
      <Select
        id="assign-driver"
        label={t.driver}
        value={driver}
        required
        onChange={(e) => setDriver(e.target.value)}
      >
        <option value="">{t.choose}</option>
        {data.drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.display_name} — {d.driver_type === 'EXTERNAL' ? t.external : t.internal}
          </option>
        ))}
      </Select>
      <Select
        id="assign-vehicle"
        label={t.vehicle}
        value={vehicle}
        required
        onChange={(e) => setVehicle(e.target.value)}
      >
        <option value="">{t.choose}</option>
        {data.vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.identifier} — {v.vehicle_type}
          </option>
        ))}
      </Select>
    </>
  );
  const action = (a: OperationAction) => (
    <Button
      key={a}
      disabled={command.busy || (a === 'dispatch' && !executionAllowed)}
      onClick={() => void command.run(a)}
    >
      {operationLabel(a, locale)}
    </Button>
  );
  return (
    <>
      {!terminal && (
        <section>
          <h2>{t.assignment}</h2>
          {!data.trip.started_at && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void command.run('assign', { driverId: driver, vehicleId: vehicle });
              }}
            >
              {resources}
              <Button disabled={command.busy}>{operationLabel('assign', locale)}</Button>
            </form>
          )}
          <div className="wizard-actions">
            {data.trip.status === 'ASSIGNED' && action('ready')}
            {data.trip.status === 'READY' && action('dispatch')}
            {data.trip.started_at && (
              <Button
                variant="secondary"
                onClick={() => {
                  setException('reassign');
                  setReason('');
                  dialog.current?.showModal();
                }}
              >
                {t.emergency}
              </Button>
            )}
            {(['cancel', 'fail'] as const).map((a) => (
              <Button
                key={a}
                variant="secondary"
                onClick={() => {
                  setException(a);
                  setReason('');
                  dialog.current?.showModal();
                }}
              >
                {operationLabel(a, locale)}
              </Button>
            ))}
          </div>
          {data.trip.started_at && stop && next && (
            <div>
              <h3>
                {stop.position + 1}. {stop.kind === 'PICKUP' ? t.pickup : t.delivery}
              </h3>
              <p>{stop.address}</p>
              <Badge>{operationalStatus(stop.status, locale)}</Badge>
              <Button
                disabled={command.busy}
                onClick={() => void command.run(next, { stopId: stop.id })}
              >
                {operationLabel(next, locale)}
              </Button>
            </div>
          )}
          {data.trip.started_at && !stop && data.pod?.state === 'FINAL' && action('complete_trip')}
          {command.feedback}
        </section>
      )}
      <dialog ref={dialog} aria-labelledby="emergency-title" aria-describedby="emergency-help">
        <h2 id="emergency-title">
          {exception === 'reassign' ? t.emergency : operationLabel(exception, locale)}
        </h2>
        <p id="emergency-help">{t.emergencyHelp}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await command.run(
              exception,
              exception === 'reassign'
                ? { driverId: driver, vehicleId: vehicle, reason, confirmed: true }
                : { reason },
            );
            if (ok) dialog.current?.close();
          }}
        >
          {exception === 'reassign' && data.trip.started_at && resources}
          <Input
            id="emergency-reason"
            label={t.reason}
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button disabled={command.busy}>{t.confirm}</Button>
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
            {t.close}
          </Button>
          {command.feedback}
        </form>
      </dialog>
      <section>
        <h2>{t.history}</h2>
        <ol>
          {data.assignments.map((a) => (
            <li key={a.id}>
              <Badge>{a.ended_at ? t.ended : t.current}</Badge>
              <p>
                {a.drivers?.display_name} / {a.vehicles?.identifier}
              </p>
              {a.reason && <p>{a.reason}</p>}
            </li>
          ))}
        </ol>
      </section>
      {(data.pod || (!terminal && data.trip.started_at && !stop)) && (
        <PodCapture locale={locale} data={data} />
      )}
    </>
  );
}
function PodCapture({ locale, data }: { locale: Locale; data: OperationalTrip }) {
  const t = operationsDictionary(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const fileId = useRef(data.pod?.id ?? '');
  async function remove() {
    setBusy(true);
    try {
      const r = await fetch('/api/operations/pod', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: data.trip.id, fileId: data.pod?.id ?? fileId.current }),
      });
      if (!r.ok) throw new Error();
      fileId.current = '';
      setMessage(t.success);
      router.refresh();
    } catch {
      setMessage(t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{t.pod}</h2>
      <p>{t.podHelp}</p>
      {data.pod?.state === 'FINAL' ? (
        <>
          <p>
            {t.recipient}: {data.pod.recipient_name}
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const response = await fetch(`/api/operations/pod?tripId=${data.trip.id}`);
                if (!response.ok) throw new Error();
                const result: unknown = await response.json();
                if (
                  typeof result !== 'object' ||
                  result === null ||
                  !('url' in result) ||
                  typeof result.url !== 'string'
                )
                  throw new Error();
                setUrl(result.url);
              } catch {
                setMessage(t.error);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.viewSignature}
          </Button>
          {url && (
            <p>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {t.viewSignature}
              </a>
            </p>
          )}
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setMessage('');
            const form = new FormData(e.currentTarget);
            if (!fileId.current) fileId.current = crypto.randomUUID();
            form.set('fileId', fileId.current);
            form.set('tripId', data.trip.id);
            try {
              const response = await fetch('/api/operations/pod', { method: 'POST', body: form });
              if (!response.ok) throw new Error();
              setMessage(t.success);
              router.refresh();
            } catch {
              setMessage(t.error);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input
            id="pod-recipient"
            label={t.recipient}
            name="recipient"
            required
            maxLength={120}
            defaultValue={data.pod?.recipient_name ?? ''}
          />
          <Input
            id="pod-signature"
            label={t.signature}
            name="file"
            type="file"
            accept="image/png,image/jpeg"
            required
          />
          <Input id="pod-notes" label={t.notes} name="notes" maxLength={500} />
          <Button disabled={busy || data.pod?.state === 'REMOVING'}>{t.capture}</Button>
          {data.pod && (
            <Button disabled={busy} type="button" variant="secondary" onClick={() => void remove()}>
              {t.abortPod}
            </Button>
          )}
        </form>
      )}
      {message && <Alert>{message}</Alert>}
    </section>
  );
}
