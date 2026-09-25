'use client';
import { useRef, useState, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';
import { driverDictionary } from '@/i18n/driver';
import { operationLabel } from '@/i18n/operations';
import { nextStopAction } from '@/domain/operations/model';
import {
  driverActions,
  issueCategories,
  type DriverTrip,
  type EventLocation,
} from '@/domain/driver/model';
import { Alert, Button, Input, Select } from '@/components/ui/primitives';
import { useHydrated } from '@/components/ui/use-hydrated';

async function post(url: string, body: FormData | object) {
  const response = await fetch(url, {
    method: 'POST',
    ...(body instanceof FormData
      ? { body }
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error('Unconfirmed execution');
  return (await response.json()) as unknown;
}
function useFeedback(locale: Locale) {
  const hydrated = useHydrated();
  const t = driverDictionary(locale),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [state, setState] = useState<'idle' | 'error' | 'success'>('idle');
  const lock = useRef(false);
  async function run(work: () => Promise<void>) {
    if (!hydrated || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await work();
      setState('success');
      router.refresh();
    } catch {
      setState('error');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    ready: hydrated,
    run,
    feedback: (
      <>
        {state !== 'idle' && (
          <Alert tone={state === 'error' ? 'error' : 'success'}>
            {state === 'error' ? t.retry : t.saved}
          </Alert>
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={!hydrated || busy}
          onClick={() => window.location.reload()}
        >
          {t.refresh}
        </Button>
      </>
    ),
  };
}
function useLocation(locale: Locale, id: string) {
  const hydrated = useHydrated();
  const t = driverDictionary(locale),
    [enabled, setEnabled] = useState(false),
    [status, setStatus] = useState<'idle' | 'ready' | 'missing'>('idle');
  async function capture(): Promise<EventLocation | null> {
    if (!enabled) return null;
    if (!navigator.geolocation) {
      setStatus('missing');
      return null;
    }
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (position.coords.accuracy < 0 || position.coords.accuracy > 100000) {
            setStatus('missing');
            resolve(null);
            return;
          }
          setStatus('ready');
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: new Date(position.timestamp).toISOString(),
          });
        },
        () => {
          setStatus('missing');
          resolve(null);
        },
        { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 },
      ),
    );
  }
  return {
    capture,
    field: (
      <div className="field">
        <label htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            disabled={!hydrated}
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {t.location}
        </label>
        <small>{t.locationHelp}</small>
        {status !== 'idle' && (
          <p role="status">{status === 'ready' ? t.locationReady : t.locationUnavailable}</p>
        )}
      </div>
    ),
  };
}
export function DriverExecution({
  trip,
  locale,
  executionAllowed,
}: {
  trip: DriverTrip;
  locale: Locale;
  executionAllowed: boolean;
}) {
  const t = driverDictionary(locale),
    feedback = useFeedback(locale),
    location = useLocation(locale, 'arrival-location');
  const request = useRef<object | null>(null);
  const stop = trip.stops.find((s) => s.status !== 'COMPLETED');
  const candidate =
    trip.status === 'READY'
      ? 'dispatch'
      : trip.status === 'DELIVERED' && trip.pod?.state === 'FINAL'
        ? 'complete_trip'
        : stop && !['PLANNED', 'ASSIGNED'].includes(trip.status)
          ? nextStopAction(stop.status)
          : null;
  const action = driverActions.find((a) => a === candidate);
  if (trip.attention) return <Alert>{t.attention}</Alert>;
  if (!action) return null;
  return (
    <section className="stack">
      {action === 'arrive' && location.field}
      <Button
        disabled={!feedback.ready || feedback.busy || (action === 'dispatch' && !executionAllowed)}
        onClick={() =>
          void feedback.run(async () => {
            request.current ??= {
              tripId: trip.id,
              revision: trip.revision,
              action,
              mutationId: crypto.randomUUID(),
              payload:
                action === 'dispatch' || action === 'complete_trip' ? {} : { stopId: stop?.id },
              location: action === 'arrive' ? await location.capture() : null,
            };
            await post('/api/driver', request.current);
          })
        }
      >
        {feedback.busy
          ? t.saving
          : action === 'dispatch'
            ? t.startTrip
            : operationLabel(action, locale)}
      </Button>
      {feedback.feedback}
    </section>
  );
}
export function DriverIssueForm({ trip, locale }: { trip: DriverTrip; locale: Locale }) {
  const t = driverDictionary(locale),
    feedback = useFeedback(locale),
    [locked, setLocked] = useState(false);
  const draft = useRef<{
    body: object;
    photo: File | null;
    fileId: string;
    issueId?: string;
  } | null>(null);
  return (
    <details>
      <summary>{t.issue}</summary>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void feedback.run(async () => {
            if (!draft.current) {
              const file = form.get('file');
              draft.current = {
                body: {
                  tripId: trip.id,
                  stopId: form.get('stopId'),
                  category: form.get('category'),
                  reason: form.get('reason'),
                  mutationId: crypto.randomUUID(),
                },
                photo: file instanceof File && file.size ? file : null,
                fileId: crypto.randomUUID(),
              };
              setLocked(true);
            }
            const d = draft.current;
            if (!d.issueId)
              d.issueId = z
                .object({ id: z.uuid() })
                .parse(await post('/api/driver/issues', d.body)).id;
            if (d.photo) {
              const upload = new FormData();
              upload.set('issueId', d.issueId);
              upload.set('fileId', d.fileId);
              upload.set('file', d.photo);
              await post('/api/driver/evidence?kind=issue', upload);
            }
          });
        }}
      >
        <fieldset disabled={!feedback.ready || locked || feedback.busy} className="stack">
          <Select id="issue-stop" label={t.stops} name="stopId" required>
            {trip.stops
              .filter((s) => s.status !== 'COMPLETED')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.position} — {s.address}
                </option>
              ))}
          </Select>
          <Select id="issue-category" label={t.category} name="category" required>
            {issueCategories.map((c) => (
              <option key={c} value={c}>
                {t.categories[c]}
              </option>
            ))}
          </Select>
          <Input id="issue-reason" name="reason" label={t.reason} required maxLength={1000} />
          <Input
            id="issue-file"
            name="file"
            label={t.photo}
            type="file"
            accept="image/png,image/jpeg"
          />
        </fieldset>
        <Button disabled={!feedback.ready || feedback.busy}>
          {feedback.busy ? t.saving : t.sendIssue}
        </Button>
        {feedback.feedback}
      </form>
    </details>
  );
}
export function DriverPodForm({ trip, locale }: { trip: DriverTrip; locale: Locale }) {
  const t = driverDictionary(locale),
    feedback = useFeedback(locale),
    location = useLocation(locale, 'pod-location');
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    ink = useRef(false),
    draft = useRef<FormData | null>(null),
    [locked, setLocked] = useState(false);
  function point(event: PointerEvent<HTMLCanvasElement>) {
    const target = event.currentTarget,
      box = target.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) * target.width) / box.width,
      y: ((event.clientY - box.top) * target.height) / box.height,
    };
  }
  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || locked) return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = point(event);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0B1F33';
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink.current = true;
  }
  return (
    <section>
      <h2>{t.pod}</h2>
      {trip.pod && <Alert>{t.podPending}</Alert>}
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void feedback.run(async () => {
            if (!draft.current) {
              let file = form.get('file');
              if (!(file instanceof File) || !file.size) {
                if (!ink.current || !canvas.current) throw new Error('Signature required');
                const blob = await new Promise<Blob | null>((resolve) =>
                  canvas.current?.toBlob(resolve, 'image/png'),
                );
                if (!blob) throw new Error('Signature unavailable');
                file = new File([blob], 'signature.png', { type: 'image/png' });
              }
              form.set('file', file);
              form.set('tripId', trip.id);
              form.set('fileId', trip.pod?.own ? trip.pod.id : crypto.randomUUID());
              form.set('location', JSON.stringify(await location.capture()));
              draft.current = form;
              setLocked(true);
            }
            await post('/api/driver/evidence?kind=pod', draft.current);
          });
        }}
      >
        <fieldset disabled={!feedback.ready || locked || feedback.busy} className="stack">
          <Input id="pod-recipient" name="recipient" label={t.recipient} maxLength={120} required />
          <Input id="pod-notes" name="notes" label={t.notes} maxLength={500} />
          <p id="signature-help">{t.signatureHelp}</p>
          <canvas
            ref={canvas}
            width={640}
            height={240}
            className="driver-signature"
            aria-label={t.signature}
            aria-describedby="signature-help"
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={() => {
              drawing.current = false;
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              canvas.current?.getContext('2d')?.clearRect(0, 0, 640, 240);
              ink.current = false;
            }}
          >
            {t.clear}
          </Button>
          <Input
            id="pod-file"
            name="file"
            label={t.signatureFile}
            type="file"
            accept="image/png,image/jpeg"
          />
          {location.field}
        </fieldset>
        <Button disabled={!feedback.ready || feedback.busy}>
          {feedback.busy ? t.saving : t.submitPod}
        </Button>
        {feedback.feedback}
      </form>
    </section>
  );
}
export function PrivateEvidence({
  kind,
  id,
  locale,
}: {
  kind: 'pod' | 'issue';
  id: string;
  locale: Locale;
}) {
  const t = driverDictionary(locale),
    [url, setUrl] = useState<string | null>(null),
    [error, setError] = useState(false);
  return (
    <>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {t.viewPhoto}
        </a>
      ) : (
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              const response = await fetch(`/api/driver/evidence?kind=${kind}&id=${id}`);
              if (!response.ok) throw new Error();
              const value = z.object({ url: z.url() }).parse(await response.json());
              setUrl(value.url);
            } catch {
              setError(true);
            }
          }}
        >
          {t.viewPhoto}
        </Button>
      )}
      {error && <Alert tone="error">{t.retry}</Alert>}
    </>
  );
}
