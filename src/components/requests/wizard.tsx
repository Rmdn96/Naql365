'use client';
import { useHydrated } from '@/components/ui/use-hydrated';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { customerDictionary } from '@/i18n/customer';
import {
  draftInput,
  commandResult,
  submissionIssues,
  type RequestDraft,
} from '@/domain/requests/intake';
import type { RequestDetails } from '@/infrastructure/requests/service';
import { Input, Select, Button, Alert } from '@/components/ui/primitives';
import { RequestSummary } from './summary';
import type { Market } from '@/domain/markets/model';
import { marketDate, normalizeMarketPhone } from '@/domain/markets/model';
import { marketDictionary } from '@/i18n/markets';

const steps = [
  'service',
  'route',
  'shipment',
  'property',
  'extras',
  'schedule',
  'contact',
  'review',
] as const;
class RequestFailure extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function responseJson(response: Response): Promise<unknown> {
  const result: unknown = await response.json();
  if (!response.ok)
    throw new RequestFailure(
      response.status === 409
        ? 'conflict'
        : response.status === 401
          ? 'sessionExpired'
          : response.status === 400
            ? 'validation'
            : response.status === 403
              ? 'forbidden'
              : 'error',
    );
  return result;
}
export function StartRequest({ locale, markets }: { locale: Locale; markets: Market[] }) {
  const hydrated = useHydrated();
  const t = customerDictionary(locale),
    router = useRouter();
  const key = useRef<string | null>(null),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const [marketId, setMarketId] = useState('');
  const mt = marketDictionary(locale);
  async function start() {
    if (busy.current || !marketId) return;
    busy.current = true;
    setPending(true);
    setError(false);
    key.current ??= crypto.randomUUID();
    try {
      const result = commandResult.parse(
        await responseJson(
          await fetch('/api/customer/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key.current, marketId }),
          }),
        ),
      );
      router.push(`/${locale}/request/${result.id}`);
    } catch {
      setError(true);
      setPending(false);
      busy.current = false;
    }
  }
  return (
    <>
      <Select
        id="request-market"
        label={mt.market}
        value={marketId}
        disabled={!hydrated || pending}
        onChange={(e) => {
          setMarketId(e.target.value);
          key.current = null;
        }}
      >
        <option value="">{mt.choose}</option>
        {markets.map((m) => (
          <option key={m.id} value={m.id}>
            {locale === 'ar' ? m.name_ar : m.name_en} — {m.currency}
          </option>
        ))}
      </Select>
      <Button onClick={start} disabled={!hydrated || pending || !marketId}>
        {pending ? t.loading : t.start}
      </Button>
      {error && <Alert tone="error">{t.error}</Alert>}
    </>
  );
}
export function RequestWizard({
  locale,
  initial,
  guest = false,
}: {
  locale: Locale;
  initial: RequestDetails;
  guest?: boolean;
}) {
  const mt = marketDictionary(locale);
  const hydrated = useHydrated();
  const t = customerDictionary(locale),
    router = useRouter();
  const [details, setDetails] = useState(initial),
    [draft, setDraft] = useState(initial.payload),
    [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<
    'saved' | 'unsaved' | 'saving' | 'saveFailed' | 'conflict'
  >('saved');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [missing, setMissing] = useState<string[]>([]);
  const draftRef = useRef(initial.payload),
    saved = useRef(JSON.stringify(initial.payload)),
    revision = useRef(initial.request.revision),
    saving = useRef(false),
    blocked = useRef(false),
    pendingMutation = useRef<{
      id: string;
      payload: RequestDraft;
      revision: number;
      json: string;
    } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const endpoint = `/api/${guest ? 'guest' : 'customer'}/requests/${initial.request.id}`;
  const change = (update: RequestDraft) => {
    draftRef.current = update;
    setDraft(update);
    setSaveState('unsaved');
    setError('');
  };
  const save = useCallback(async (): Promise<boolean> => {
    if (saving.current || blocked.current) return false;
    saving.current = true;
    try {
      while (saved.current !== JSON.stringify(draftRef.current)) {
        const parsed = draftInput.safeParse(draftRef.current);
        if (!parsed.success) {
          setSaveState('saveFailed');
          return false;
        }
        setSaveState('saving');
        pendingMutation.current ??= {
          id: crypto.randomUUID(),
          payload: parsed.data,
          revision: revision.current,
          json: JSON.stringify(draftRef.current),
        };
        const attempt = pendingMutation.current;
        const result = commandResult.parse(
          await responseJson(
            await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'save',
                revision: attempt.revision,
                mutationId: attempt.id,
                payload: attempt.payload,
              }),
            }),
          ),
        );
        revision.current = result.revision;
        saved.current = attempt.json;
        pendingMutation.current = null;
      }
      setSaveState('saved');
      return true;
    } catch (e) {
      if (e instanceof RequestFailure && e.code === 'conflict') {
        blocked.current = true;
        setSaveState('conflict');
      } else {
        if (e instanceof RequestFailure && e.code === 'validation') pendingMutation.current = null;
        setSaveState('saveFailed');
      }
      return false;
    } finally {
      saving.current = false;
    }
  }, [endpoint]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void save();
    }, 750);
    return () => clearTimeout(timer);
  }, [draft, save]);
  useEffect(() => {
    function protectNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        new URL(anchor.href).origin !== window.location.origin ||
        saved.current === JSON.stringify(draftRef.current)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void save().then((ok) => {
        if (ok) router.push(anchor.href);
        else setError(t.saveFailed);
      });
    }
    document.addEventListener('click', protectNavigation, true);
    return () => document.removeEventListener('click', protectNavigation, true);
  }, [save, router, t.saveFailed]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (saved.current !== JSON.stringify(draftRef.current)) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  async function refresh() {
    const value = (await responseJson(
      await fetch(endpoint, { cache: 'no-store' }),
    )) as RequestDetails;
    setDetails(value);
    revision.current = value.request.revision;
    return value;
  }
  async function reload() {
    setBusy(true);
    try {
      const value = await refresh();
      draftRef.current = value.payload;
      setDraft(value.payload);
      saved.current = JSON.stringify(value.payload);
      pendingMutation.current = null;
      blocked.current = false;
      setSaveState('saved');
      setError('');
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  async function navigate(index: number) {
    if (await save()) {
      setStep(index);
      setMissing([]);
      setTimeout(() => title.current?.focus(), 0);
    } else setError(t.invalid);
  }
  async function transition(operation: 'submit' | 'cancel') {
    if (operation === 'cancel' && !window.confirm(t.confirmCancel)) return;
    if (operation === 'submit') {
      const issues = submissionIssues(draftRef.current, details.market.timezone);
      if (issues.length) {
        setMissing(issues);
        setError(t.invalid);
        title.current?.focus();
        return;
      }
    }
    if (operation === 'submit' && !(await save())) {
      setError(t.saveFailed);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = commandResult.parse(
        await responseJson(
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation,
              revision: revision.current,
              mutationId: crypto.randomUUID(),
            }),
          }),
        ),
      );
      if (operation === 'cancel') {
        for (const file of details.attachments)
          await responseJson(
            await fetch(`${endpoint}/files`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: file.id }),
            }),
          );
      }
      router.push(`/${locale}/${guest ? 'guest' : 'account'}/requests/${result.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof RequestFailure && e.code === 'conflict' ? t.conflict : t.error);
      const latest = await refresh().catch(() => null);
      if (latest && latest.request.status !== 'DRAFT')
        router.push(`/${locale}/${guest ? 'guest' : 'account'}/requests/${latest.request.id}`);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!(await save())) {
      setError(t.saveFailed);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('fileId', crypto.randomUUID());
      await responseJson(await fetch(`${endpoint}/files`, { method: 'POST', body: form }));
      await refresh();
    } catch {
      setError(t.error);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function remove(fileId: string) {
    if (!(await save())) {
      setError(t.saveFailed);
      return;
    }
    setBusy(true);
    try {
      await responseJson(
        await fetch(`${endpoint}/files`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId }),
        }),
      );
      await refresh();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key:
      | 'description'
      | 'notes'
      | 'contact_name'
      | 'contact_phone'
      | 'contact_email'
      | 'contact_notes',
    label: string,
    max: number,
    type = 'text',
  ) => (
    <Input
      key={key}
      id={key}
      label={label}
      value={draft[key]}
      maxLength={max}
      type={type}
      onChange={(e) => change({ ...draft, [key]: e.target.value })}
      onBlur={() => {
        if (key === 'contact_phone')
          change({
            ...draft,
            contact_phone: normalizeMarketPhone(
              draft.contact_phone,
              details.market.phone_country_code,
            ),
          });
      }}
    />
  );
  const locationField = (
    kind: 'pickup' | 'delivery',
    key:
      | 'city'
      | 'district'
      | 'address'
      | 'notes'
      | 'access_notes'
      | 'postal_code'
      | 'building'
      | 'unit',
    label: string,
    max: number,
  ) => (
    <Input
      key={key}
      id={`${kind}-${key}`}
      label={label}
      value={draft[kind][key]}
      maxLength={max}
      onChange={(e) => change({ ...draft, [kind]: { ...draft[kind], [key]: e.target.value } })}
    />
  );
  const service = details.services.find((s) => s.id === draft.service_id);
  return (
    <div className="wizard">
      <p>
        {mt.market}: {locale === 'ar' ? details.market.name_ar : details.market.name_en} ·{' '}
        <bdi>{details.market.currency}</bdi>
      </p>
      <p>{mt.fixed}</p>
      <div className="wizard-top">
        <p className="eyebrow">Naql365 · {t.request}</p>
        {!guest && <Link href={`/${locale}/account/requests`}>{t.myRequests}</Link>}
      </div>
      <nav aria-label={t.progress}>
        <ol className="wizard-progress">
          {steps.map((key, i) => (
            <li key={key}>
              <button
                type="button"
                aria-current={i === step ? 'step' : undefined}
                disabled={!hydrated || busy || saveState === 'saving'}
                onClick={() => void navigate(i)}
              >
                <span>{i + 1}</span>
                {t[key]}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="save-status" role="status">
        {busy ? t.loading : t[saveState]}
      </div>
      {saveState === 'conflict' ? (
        <Alert tone="error">
          {t.conflict}{' '}
          <Button variant="secondary" onClick={() => void reload()} disabled={!hydrated || busy}>
            {t.reload}
          </Button>
        </Alert>
      ) : (
        saveState === 'saveFailed' && (
          <Alert tone="error">
            {t.saveFailed}{' '}
            <Button variant="secondary" onClick={() => void save()}>
              {t.retry}
            </Button>
          </Alert>
        )
      )}
      <h1 ref={title} tabIndex={-1}>
        {t[steps[step]!]}
      </h1>
      {error && (
        <Alert tone="error">
          {error}
          {missing.length > 0 && (
            <ul>
              {missing.map((key) => (
                <li key={key}>{t[key as keyof typeof t]}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <fieldset className="wizard-fields" disabled={!hydrated || busy || saveState === 'conflict'}>
        {step === 0 && (
          <>
            <Select
              id="service"
              label={t.service}
              value={draft.service_id}
              onChange={(e) => {
                const s = details.services.find((s) => s.id === e.target.value);
                const next = { ...draft, service_id: e.target.value };
                if (!s?.property_required) {
                  for (const kind of ['pickup', 'delivery'] as const)
                    next[kind] = { ...next[kind], floor: null, elevator: null, access_notes: '' };
                }
                change(next);
              }}
            >
              <option value="">{t.choose}</option>
              {details.services
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {locale === 'ar' ? s.name_ar : s.name_en}
                  </option>
                ))}
            </Select>
            {!details.services.some((s) => s.active) && <Alert>{t.noServices}</Alert>}
          </>
        )}
        {step === 1 && (
          <div className="form-columns">
            {(['pickup', 'delivery'] as const).map((kind) => (
              <section key={kind}>
                <h2>{t[kind]}</h2>
                <Select
                  id={`${kind}-city`}
                  label={mt.city}
                  value={draft[kind].city_id}
                  onChange={(e) => {
                    const city = details.cities.find((c) => c.id === e.target.value);
                    change({
                      ...draft,
                      [kind]: {
                        ...draft[kind],
                        city_id: city?.id ?? '',
                        city: city?.name_en ?? '',
                      },
                    });
                  }}
                >
                  <option value="">{t.city}</option>
                  {details.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {locale === 'ar' ? city.name_ar : city.name_en} —{' '}
                      {locale === 'ar'
                        ? city.market_regions?.name_ar
                        : city.market_regions?.name_en}
                    </option>
                  ))}
                </Select>
                {draft[kind].city_id &&
                  !details.coverage.some(
                    (c) => c.city_id === draft[kind].city_id && c.service_id === draft.service_id,
                  ) && <Alert>{mt.unavailable}</Alert>}
                {locationField(kind, 'district', t.district, 120)}
                {locationField(kind, 'address', t.address, 500)}
                {locationField(kind, 'postal_code', mt.postal, 20)}
                {locationField(kind, 'building', mt.building, 100)}
                {locationField(kind, 'unit', mt.unit, 60)}
                {locationField(kind, 'notes', t.notes, 1000)}
              </section>
            ))}
          </div>
        )}
        {step === 2 && (
          <>
            {field('description', t.description, 2000)}
            {field('notes', t.notes, 2000)}
            <h2>{t.items}</h2>
            {draft.items.map((item, i) => (
              <section className="item-row" key={i}>
                <h3>
                  {t.items} {i + 1}
                </h3>
                <Input
                  id={`item-${i}`}
                  label={t.itemDescription}
                  value={item.description}
                  maxLength={200}
                  onChange={(e) =>
                    change({
                      ...draft,
                      items: draft.items.map((it, j) =>
                        j === i ? { ...it, description: e.target.value } : it,
                      ),
                    })
                  }
                />
                <Input
                  id={`quantity-${i}`}
                  label={t.quantity}
                  type="number"
                  min={1}
                  max={10000}
                  value={item.quantity}
                  onChange={(e) =>
                    change({
                      ...draft,
                      items: draft.items.map((it, j) =>
                        j === i ? { ...it, quantity: Number(e.target.value) } : it,
                      ),
                    })
                  }
                />
                <Input
                  id={`item-notes-${i}`}
                  label={t.notes}
                  value={item.notes}
                  maxLength={1000}
                  onChange={(e) =>
                    change({
                      ...draft,
                      items: draft.items.map((it, j) =>
                        j === i ? { ...it, notes: e.target.value } : it,
                      ),
                    })
                  }
                />
                <Button
                  variant="secondary"
                  onClick={() => change({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                >
                  {t.remove} {i + 1}
                </Button>
              </section>
            ))}
            <Button
              variant="secondary"
              disabled={draft.items.length >= 50}
              onClick={() =>
                change({
                  ...draft,
                  items: [...draft.items, { description: '', quantity: 1, notes: '' }],
                })
              }
            >
              {t.addItem}
            </Button>
            <h2>{t.attachments}</h2>
            <Input
              id="attachment"
              label={t.upload}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={details.attachments.length >= 8 || saveState === 'saving'}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <p>{t.uploadHint}</p>
            <ul>
              {details.attachments.map((f, i) => (
                <li key={f.id}>
                  {t.attachment} {i + 1} · {f.upload_state === 'ready' ? t.saved : t.pendingFile}{' '}
                  <Button variant="secondary" onClick={() => void remove(f.id)}>
                    {t.remove}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        {step === 3 &&
          (service?.property_required ? (
            <div className="form-columns">
              {(['pickup', 'delivery'] as const).map((kind) => (
                <section key={kind}>
                  <h2>{t[kind]}</h2>
                  <Input
                    id={`${kind}-floor`}
                    label={t.floor}
                    type="number"
                    min={-5}
                    max={200}
                    value={draft[kind].floor ?? ''}
                    onChange={(e) =>
                      change({
                        ...draft,
                        [kind]: {
                          ...draft[kind],
                          floor: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                  <Select
                    id={`${kind}-elevator`}
                    label={t.elevator}
                    value={draft[kind].elevator === null ? '' : String(draft[kind].elevator)}
                    onChange={(e) =>
                      change({
                        ...draft,
                        [kind]: {
                          ...draft[kind],
                          elevator: e.target.value === '' ? null : e.target.value === 'true',
                        },
                      })
                    }
                  >
                    <option value="">{t.unspecified}</option>
                    <option value="true">{t.yes}</option>
                    <option value="false">{t.no}</option>
                  </Select>
                  {locationField(kind, 'access_notes', t.accessNotes, 1000)}
                </section>
              ))}
            </div>
          ) : (
            <p>{t.notApplicable}</p>
          ))}
        {step === 4 && (
          <>
            {details.options
              .filter((o) => o.active)
              .map((o) => (
                <label className="choice" key={o.id}>
                  <input
                    type="checkbox"
                    checked={draft.additional_service_ids.includes(o.id)}
                    onChange={(e) =>
                      change({
                        ...draft,
                        additional_service_ids: e.target.checked
                          ? [...draft.additional_service_ids, o.id]
                          : draft.additional_service_ids.filter((id) => id !== o.id),
                      })
                    }
                  />
                  {locale === 'ar' ? o.name_ar : o.name_en}
                </label>
              ))}
            {!details.options.some((o) => o.active) && <p>{t.noExtras}</p>}
          </>
        )}
        {step === 5 && (
          <>
            <Input
              id="date"
              label={t.date}
              type="date"
              min={marketDate(new Date(), details.market.timezone)}
              value={draft.preferred_date}
              onChange={(e) => change({ ...draft, preferred_date: e.target.value })}
            />
            <Select
              id="time-window"
              label={t.window}
              value={draft.time_window}
              onChange={(e) =>
                change({ ...draft, time_window: e.target.value as RequestDraft['time_window'] })
              }
            >
              <option value="">{t.choose}</option>
              {(['morning', 'afternoon', 'evening', 'flexible'] as const).map((w) => (
                <option key={w} value={w}>
                  {t[w]}
                </option>
              ))}
            </Select>
            <p>
              {t.scheduleHint} {mt.timezone}: <bdi>{details.market.timezone}</bdi>
            </p>
          </>
        )}
        {step === 6 && (
          <>
            {field('contact_name', t.name, 200)}
            {field('contact_phone', t.phone, 24, 'tel')}
            <small>{t.phoneHint}</small>
            {field('contact_email', t.email, 254, 'email')}
            {field('contact_notes', t.contactNotes, 1000)}
          </>
        )}
        {step === 7 && (
          <>
            <Alert>{t.reviewNotice}</Alert>
            <RequestSummary
              locale={locale}
              payload={draft}
              services={details.services}
              options={details.options}
              attachments={details.attachments}
              guest={guest}
            />
            <div className="customer-links">
              {steps.slice(0, 7).map((key, i) => (
                <Button key={key} variant="secondary" onClick={() => void navigate(i)}>
                  {t.edit} {t[key]}
                </Button>
              ))}
            </div>
          </>
        )}
      </fieldset>
      <div className="wizard-actions">
        <Button
          variant="secondary"
          disabled={!hydrated || step === 0 || busy || saveState === 'saving'}
          onClick={() => void navigate(step - 1)}
        >
          {t.back}
        </Button>
        {step < 7 ? (
          <Button
            disabled={!hydrated || busy || saveState === 'saving'}
            onClick={() => void navigate(step + 1)}
          >
            {t.next}
          </Button>
        ) : (
          <Button
            disabled={!hydrated || busy || saveState === 'saving' || saveState === 'conflict'}
            onClick={() => void transition('submit')}
          >
            {busy ? t.submitting : t.submit}
          </Button>
        )}
      </div>
      <p className="muted">{t.savingHint}</p>
      <Button
        variant="secondary"
        disabled={!hydrated || busy || saveState === 'saving'}
        onClick={() => void transition('cancel')}
      >
        {t.cancel}
      </Button>
    </div>
  );
}
