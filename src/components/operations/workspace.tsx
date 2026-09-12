'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { operationsDictionary, operationalStatus } from '@/i18n/operations';
import type { OperationsWorkspace } from '@/infrastructure/operations/service';
import { Badge, Button, Input, Select, EmptyState } from '@/components/ui/primitives';
import { OperationButton, useOperationalCommand } from './command';
export function Workspace({ locale, data }: { locale: Locale; data: OperationsWorkspace }) {
  const t = operationsDictionary(locale);
  const [filter, setFilter] = useState('all');
  const command = useOperationalCommand(locale, data.organizationId, data.organizationId, 0);
  const trips = data.trips.filter(
    (trip) =>
      filter === 'all' ||
      (filter === 'unassigned' && !data.assignments.some((a) => a.trip_id === trip.id)) ||
      (filter === 'executing' &&
        trip.started_at &&
        !['COMPLETED', 'FAILED', 'CANCELLED'].includes(trip.status)) ||
      (filter === 'completed' && trip.status === 'COMPLETED') ||
      (filter === 'exceptions' && ['FAILED', 'CANCELLED'].includes(trip.status)),
  );
  return (
    <>
      <section>
        <h2>{t.orders}</h2>
        <ul className="request-list">
          {data.orders
            .filter((o) => !o.jobs)
            .map((o) => (
              <li key={o.id}>
                <bdi>{o.reference}</bdi>
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
          {data.jobs.map((j) => (
            <li key={j.id}>
              <bdi>{j.reference}</bdi>
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
                  <bdi>{trip.reference}</bdi>
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
              void command.run('create_driver', { name: f.get('name'), type: f.get('type') });
            }}
          >
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
                identifier: f.get('identifier'),
                type: f.get('type'),
              });
            }}
          >
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
              {d.display_name} — {d.driver_type === 'EXTERNAL' ? t.external : t.internal}
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
              {v.identifier} — {v.vehicle_type}
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
