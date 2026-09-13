'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { marketDictionary } from '@/i18n/markets';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import type { OperationsWorkspace } from '@/infrastructure/operations/service';
import { Badge, Button, Input, Select, EmptyState } from '@/components/ui/primitives';
import { OperationButton, useOperationalCommand } from './command';
export function Workspace({ locale, data }: { locale: Locale; data: OperationsWorkspace }) {
  const t = operationsDictionary(locale),
    mt = marketDictionary(locale);
  const [marketFilter, setMarketFilter] = useState('');
  const marketName = (id: string) => {
    const m = data.markets.find((x) => x.id === id);
    return m ? (locale === 'ar' ? m.name_ar : m.name_en) : '';
  };
  const [filter, setFilter] = useState('all');
  const command = useOperationalCommand(locale, data.organizationId, data.organizationId, 0);
  const trips = data.trips.filter(
    (trip) =>
      (!marketFilter || trip.market_id === marketFilter) &&
      (filter === 'all' ||
        (filter === 'unassigned' && !data.assignments.some((a) => a.trip_id === trip.id)) ||
        (filter === 'executing' &&
          trip.started_at &&
          !['COMPLETED', 'FAILED', 'CANCELLED'].includes(trip.status)) ||
        (filter === 'completed' && trip.status === 'COMPLETED') ||
        (filter === 'exceptions' && ['FAILED', 'CANCELLED'].includes(trip.status))),
  );
  return (
    <>
      <Select
        id="operations-market"
        label={mt.market}
        value={marketFilter}
        onChange={(e) => setMarketFilter(e.target.value)}
      >
        <option value="">{mt.all}</option>
        {data.markets.map((m) => (
          <option key={m.id} value={m.id}>
            {marketName(m.id)}
          </option>
        ))}
      </Select>
      <section>
        <h2>{t.orders}</h2>
        <ul className="request-list">
          {data.orders
            .filter((o) => !o.jobs && (!marketFilter || o.market_id === marketFilter))
            .map((o) => (
              <li key={o.id}>
                <bdi>{o.reference}</bdi> <Badge>{marketName(o.market_id)}</Badge>
                <OperationButton
                  locale={locale}
                  organizationId={data.organizationId}
                  entityId={o.id}
                  action="create_job"
                  destination="job"
                />
              </li>
            ))}
        </ul>
      </section>
      <section>
        <h2>{t.jobs}</h2>
        <ul className="request-list">
          {data.jobs
            .filter((j) => !marketFilter || j.market_id === marketFilter)
            .map((j) => (
              <li key={j.id}>
                <bdi>{j.reference}</bdi> <Badge>{marketName(j.market_id)}</Badge>
                <Badge>{operationalStatus(j.status, locale)}</Badge>
                <Link href={`/${locale}/portal/operations/jobs/${j.id}`}>{t.open}</Link>
              </li>
            ))}
        </ul>
      </section>
      <section aria-labelledby="dispatch-title">
        <h2 id="dispatch-title">{t.dispatch}</h2>
        <p>{t.planningWarning}</p>
        <Select
          id="dispatch-filter"
          label={t.trips}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {(['all', 'unassigned', 'executing', 'completed', 'exceptions'] as const).map((key) => (
            <option key={key} value={key}>
              {t[key]}
            </option>
          ))}
        </Select>
        {!trips.length ? (
          <EmptyState title={t.trips}>{t.empty}</EmptyState>
        ) : (
          <ul className="request-list">
            {trips.map((trip) => (
              <li key={trip.id}>
                <div>
                  <bdi>{trip.reference}</bdi> <Badge>{marketName(trip.market_id)}</Badge>
                  <p>
                    <Badge>{operationalStatus(trip.status, locale)}</Badge>
                  </p>
                  <p>
                    {data.drivers.find(
                      (d) =>
                        d.id === data.assignments.find((a) => a.trip_id === trip.id)?.driver_id,
                    )?.display_name ?? t.unassigned}{' '}
                    /{' '}
                    {data.vehicles.find(
                      (v) =>
                        v.id === data.assignments.find((a) => a.trip_id === trip.id)?.vehicle_id,
                    )?.identifier ?? t.unassigned}
                  </p>
                </div>
                <Link href={`/${locale}/portal/operations/trips/${trip.id}`}>{t.open}</Link>
              </li>
            ))}
          </ul>
        )}
        <p>{t.windowLimit}</p>
      </section>
      <section>
        <h2>{t.resources}</h2>
        {command.feedback}
        <div className="form-columns">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void command.run('create_driver', {
                marketId: f.get('marketId'),
                name: f.get('name'),
                type: f.get('type'),
              });
            }}
          >
            <Select id="driver-market" label={mt.market} name="marketId" required>
              <option value="">{mt.choose}</option>
              {data.markets
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {marketName(m.id)}
                  </option>
                ))}
            </Select>
            <Input id="driver-name" label={t.name} name="name" required maxLength={120} />
            <Select id="driver-type" label={t.driverType} name="type">
              <option value="INTERNAL">{t.internal}</option>
              <option value="EXTERNAL">{t.external}</option>
            </Select>
            <Button disabled={command.busy}>{t.addDriver}</Button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void command.run('create_vehicle', {
                marketId: f.get('marketId'),
                identifier: f.get('identifier'),
                type: f.get('type'),
              });
            }}
          >
            <Select id="vehicle-market" label={mt.market} name="marketId" required>
              <option value="">{mt.choose}</option>
              {data.markets
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {marketName(m.id)}
                  </option>
                ))}
            </Select>
            <Input
              id="vehicle-identifier"
              label={t.identifier}
              name="identifier"
              required
              maxLength={60}
            />
            <Input id="vehicle-type" label={t.vehicleType} name="type" required maxLength={80} />
            <Button disabled={command.busy}>{t.addVehicle}</Button>
          </form>
        </div>
        <ul className="request-list">
          {data.drivers.map((d) => (
            <li key={d.id}>
              {marketName(d.market_id)} · {d.display_name} —{' '}
              {d.driver_type === 'EXTERNAL' ? t.external : t.internal}
              <ResourceToggle
                locale={locale}
                organizationId={data.organizationId}
                id={d.id}
                active={d.active}
                driver
              />
            </li>
          ))}
          {data.vehicles.map((v) => (
            <li key={v.id}>
              {marketName(v.market_id)} · {v.identifier} — {v.vehicle_type}
              <ResourceToggle
                locale={locale}
                organizationId={data.organizationId}
                id={v.id}
                active={v.active}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
function ResourceToggle({
  locale,
  organizationId,
  id,
  active,
  driver = false,
}: {
  locale: Locale;
  organizationId: string;
  id: string;
  active: boolean;
  driver?: boolean;
}) {
  const command = useOperationalCommand(locale, organizationId, id, 0);
  const t = operationsDictionary(locale);
  return (
    <div>
      <Badge>{active ? t.active : t.inactive}</Badge>
      <Button
        variant="secondary"
        disabled={command.busy}
        onClick={() =>
          void command.run(driver ? 'set_driver_active' : 'set_vehicle_active', { active: !active })
        }
      >
        {active ? t.deactivate : t.activate}
      </Button>
      {command.feedback}
    </div>
  );
}
