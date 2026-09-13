'use client';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { operationsDictionary } from '@/i18n/operations';
import type { OperationalTrip } from '@/infrastructure/operations/service';
import { marketDateTime, localScheduleToInstant } from '@/domain/markets/model';
import { marketDictionary } from '@/i18n/markets';
import { Button, Input, Select, Alert } from '@/components/ui/primitives';
import { useOperationalCommand } from './command';
type PlannedStop = {
  key: string;
  cityId: string;
  kind: 'PICKUP' | 'DELIVERY';
  address: string;
  notes: string;
  pickups: string[];
};
export function TripPlanner({ locale, data }: { locale: Locale; data: OperationalTrip }) {
  const t = operationsDictionary(locale),
    mt = marketDictionary(locale);
  const [scheduleError, setScheduleError] = useState(false);
  const localTime = (iso: string | null) =>
    iso ? marketDateTime(new Date(iso), data.market.timezone) : '';
  const command = useOperationalCommand(
    locale,
    data.trip.organization_id,
    data.trip.id,
    data.trip.revision,
  );
  const [stops, setStops] = useState<PlannedStop[]>(() =>
    data.stops.map((s) => ({
      key: s.id,
      cityId: s.city_id ?? '',
      kind: s.kind === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
      address: s.address ?? '',
      notes: s.notes,
      pickups: data.dependencies
        .filter((d) => d.delivery_stop_id === s.id)
        .map((d) => d.pickup_stop_id),
    })),
  );
  const [start, setStart] = useState(() => localTime(data.trip.planned_start));
  const [end, setEnd] = useState(() => localTime(data.trip.planned_end));
  function patch(key: string, change: Partial<PlannedStop>) {
    setStops((current) => current.map((s) => (s.key === key ? { ...s, ...change } : s)));
  }
  function move(index: number, delta: number) {
    setStops((current) => {
      const copy = [...current];
      const item = copy.splice(index, 1)[0];
      if (item) copy.splice(index + delta, 0, item);
      return copy;
    });
  }
  return (
    <section>
      <h2>{t.plan}</h2>
      <p>
        {mt.market}: {locale === 'ar' ? data.market.name_ar : data.market.name_en} ·{' '}
        {data.market.timezone}
      </p>
      {scheduleError && <Alert tone="error">{mt.localTimeError}</Alert>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setScheduleError(false);
          try {
            void command.run('plan', {
              plannedStart: localScheduleToInstant(start, data.market.timezone),
              plannedEnd: localScheduleToInstant(end, data.market.timezone),
              stops: stops.map((s) => ({
                kind: s.kind,
                cityId: s.cityId,
                address: s.address,
                notes: s.notes,
                pickups: s.pickups.map((key) => stops.findIndex((p) => p.key === key)),
              })),
            });
          } catch {
            setScheduleError(true);
          }
        }}
      >
        <div className="form-columns">
          <Input
            id="planned-start"
            label={t.start}
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            id="planned-end"
            label={t.end}
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <h3>{t.stops}</h3>
        {stops.map((s, index) => (
          <fieldset key={s.key}>
            <legend>
              {index + 1}. {s.kind === 'PICKUP' ? t.pickup : t.delivery}
            </legend>
            <Select
              id={`city-${s.key}`}
              label={mt.city}
              value={s.cityId}
              required
              onChange={(e) => patch(s.key, { cityId: e.target.value })}
            >
              <option value="">{mt.city}</option>
              {data.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ar' ? c.name_ar : c.name_en}
                </option>
              ))}
            </Select>
            <Select
              id={`kind-${s.key}`}
              label={t.stops}
              value={s.kind}
              onChange={(e) =>
                patch(s.key, {
                  kind: e.target.value === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
                  pickups: [],
                })
              }
            >
              <option value="PICKUP">{t.pickup}</option>
              <option value="DELIVERY">{t.delivery}</option>
            </Select>
            <Input
              id={`address-${s.key}`}
              label={t.address}
              value={s.address}
              maxLength={500}
              required
              onChange={(e) => patch(s.key, { address: e.target.value })}
            />
            <Input
              id={`notes-${s.key}`}
              label={t.notes}
              value={s.notes}
              maxLength={1000}
              onChange={(e) => patch(s.key, { notes: e.target.value })}
            />
            {s.kind === 'DELIVERY' && (
              <fieldset>
                <legend>{t.dependencies}</legend>
                {stops
                  .filter((p) => p.kind === 'PICKUP')
                  .map((p) => (
                    <label className="operations-check" key={p.key}>
                      <input
                        type="checkbox"
                        checked={s.pickups.includes(p.key)}
                        onChange={(e) =>
                          patch(s.key, {
                            pickups: e.target.checked
                              ? [...s.pickups, p.key]
                              : s.pickups.filter((key) => key !== p.key),
                          })
                        }
                      />
                      {stops.indexOf(p) + 1}. {p.address || t.pickup}
                    </label>
                  ))}
              </fieldset>
            )}
            <div className="wizard-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                {t.up}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={index === stops.length - 1}
                onClick={() => move(index, 1)}
              >
                {t.down}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setStops((current) =>
                    current
                      .filter((p) => p.key !== s.key)
                      .map((p) => ({ ...p, pickups: p.pickups.filter((key) => key !== s.key) })),
                  )
                }
              >
                {t.remove}
              </Button>
            </div>
          </fieldset>
        ))}
        <div className="wizard-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={stops.length >= 40}
            onClick={() =>
              setStops((current) => [
                ...current,
                {
                  key: crypto.randomUUID(),
                  cityId: '',
                  kind: current.length ? 'DELIVERY' : 'PICKUP',
                  address: '',
                  notes: '',
                  pickups: [],
                },
              ])
            }
          >
            {t.addStop}
          </Button>
          <Button disabled={command.busy}>{t.savePlan}</Button>
        </div>
        {command.feedback}
      </form>
    </section>
  );
}
