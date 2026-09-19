import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
let db: Awaited<ReturnType<typeof foundationDatabase>>;
const org = '23000000-0000-4000-8000-000000000001';
const staff = '13000000-0000-4000-8000-000000000001';
const driver = '14000000-0000-4000-8000-000000000001';
const replacement = '14000000-0000-4000-8000-000000000002';
let trip: string, otherTrip: string, resource: string, otherResource: string, vehicle: string;
const q = (v: unknown) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
async function as<T>(actor: string, sql: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);`,
  );
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec('reset role;');
  }
}
async function op(action: string, id: string, payload: unknown = {}) {
  return (
    await as<{ v: { id: string } }>(
      staff,
      `select public.phase3_command('${action}','${id}',${q(payload)}) v`,
    )
  )[0]!.v;
}
async function command(
  actor: string,
  action: string,
  payload: unknown = {},
  id = trip,
  mutation = randomUUID(),
  revision?: number,
) {
  const rev =
    revision ??
    (await db.query<{ revision: number }>(`select revision from public.trips where id='${id}'`))
      .rows[0]!.revision;
  return as<{ v: unknown }>(
    actor,
    `select public.driver_execute('${id}','${action}',${rev},'${mutation}',${q(payload)}) v`,
  );
}
beforeAll(async () => {
  db = await foundationDatabase();
  const fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
    .split('set local role authenticated;')[0]!
    .replace('begin;', '');
  await db.exec(fixture);
  await db.exec(`insert into auth.users(id,email) values('${driver}','driver@example.invalid'),('${replacement}','replacement@example.invalid');
 insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${driver}','driver'),('${org}','${replacement}','driver');
 insert into public.user_roles(organization_id,profile_id,role_id) select '${org}',u.id,r.id from auth.users u cross join public.roles r where u.id in ('${driver}','${replacement}') and r.code='DRIVER';`);
  const market = (
    await db.query<{ id: string }>(`select id from public.markets where organization_id='${org}'`)
  ).rows[0]!.id;
  const city = (
    await db.query<{ id: string }>(
      `select id from public.market_cities where market_id='${market}' limit 1`,
    )
  ).rows[0]!.id;
  resource = (
    await op('create_driver', org, { marketId: market, type: 'INTERNAL', name: 'Driver A' })
  ).id;
  otherResource = (
    await op('create_driver', org, { marketId: market, type: 'INTERNAL', name: 'Driver B' })
  ).id;
  await db.exec(
    `update public.drivers set profile_id='${driver}' where id='${resource}'; update public.drivers set profile_id='${replacement}' where id='${otherResource}';`,
  );
  vehicle = (
    await op('create_vehicle', org, { marketId: market, type: 'Truck', identifier: 'DRIVER-TEST' })
  ).id;
  const job = (await op('create_job', '83000000-0000-4000-8000-000000000001')).id;
  trip = (await op('create_trip', job)).id;
  otherTrip = (await op('create_trip', job)).id;
  await op('plan', trip, {
    plannedStart: new Date().toISOString(),
    plannedEnd: new Date(Date.now() + 3600000).toISOString(),
    stops: [
      {
        cityId: city,
        kind: 'PICKUP',
        address: 'Private pickup',
        notes: 'Staff private',
        pickups: [],
      },
      { cityId: city, kind: 'DELIVERY', address: 'Private delivery', pickups: [0] },
    ],
  });
  await op('assign', trip, { driverId: resource, vehicleId: vehicle });
  await op('ready', trip);
}, 60_000);
afterAll(async () => {
  await db?.close();
});

const customer = '13000000-0000-4000-8000-000000000002';
const otherCustomer = '13000000-0000-4000-8000-000000000005';
const sample = (overrides: Record<string, unknown> = {}) => ({
  latitude: 24.7136,
  longitude: 46.6753,
  accuracy: 5,
  speed: 3,
  heading: 90,
  capturedAt: new Date().toISOString(),
  clientType: 'WEB',
  ...overrides,
});
const publish = (actor: string, payload = sample(), id = randomUUID(), target = trip) =>
  as<{ v: { status: string } }>(
    actor,
    `select public.publish_trip_location('${target}','${id}',${q(payload)}) v`,
  );
it('rejects pre-start publication and creates safe notifications from actual execution', async () => {
  await expect(publish(driver)).rejects.toThrow();
  await command(driver, 'dispatch');
  const n = await as<{ id: string; event_code: string; read_at: string | null }>(
    customer,
    'select id,event_code,read_at from public.notifications',
  );
  expect(n).toHaveLength(1);
  expect(n[0]!.event_code).toBe('TRIP_STARTED');
  expect(n[0]!.read_at).toBeNull();
  expect(await as(otherCustomer, 'select * from public.notifications')).toHaveLength(0);
  await expect(
    as(otherCustomer, `select public.read_notification('${n[0]!.id}')`),
  ).rejects.toThrow();
  await as(customer, `select public.read_notification('${n[0]!.id}')`);
  expect(
    (await as<{ read_at: string }>(customer, 'select read_at from public.notifications'))[0]!
      .read_at,
  ).toBeTruthy();
});
it('validates identity, ranges, timestamps and strict payloads before any sample write', async () => {
  await db.exec('set role anon');
  try {
    await expect(
      db.query(`select public.publish_trip_location('${trip}','${randomUUID()}',${q(sample())})`),
    ).rejects.toThrow();
  } finally {
    await db.exec('reset role');
  }
  for (const actor of [
    customer,
    otherCustomer,
    staff,
    replacement,
    '13000000-0000-4000-8000-000000000003',
    '13000000-0000-4000-8000-000000000004',
  ])
    await expect(publish(actor)).rejects.toThrow();
  await expect(publish(driver, sample(), randomUUID(), otherTrip)).rejects.toThrow();
  for (const invalid of [
    { latitude: 91 },
    { longitude: -181 },
    { accuracy: -1 },
    { accuracy: 1001 },
    { speed: -1 },
    { heading: 360 },
    { driver_id: driver },
    { organization_id: org },
    { market_id: randomUUID() },
    { capturedAt: new Date(Date.now() + 60000).toISOString() },
    { capturedAt: new Date(Date.now() - 300000).toISOString() },
    { capturedAt: 'infinity' },
    { clientType: 'ADMIN' },
  ])
    await expect(publish(driver, sample(invalid))).rejects.toThrow();
  await db.exec(
    `update public.organization_memberships set status='suspended' where profile_id='${driver}';`,
  );
  await expect(publish(driver)).rejects.toThrow();
  await db.exec(
    `update public.organization_memberships set status='active' where profile_id='${driver}';`,
  );
});
it('publishes minimal latest position with RLS, deduplication, ordering and server throttling', async () => {
  const id = randomUUID(),
    payload = sample({ capturedAt: new Date(Date.now() - 5000).toISOString() });
  expect((await publish(driver, payload, id))[0]!.v.status).toBe('ACCEPTED');
  expect((await publish(driver, payload, id))[0]!.v.status).toBe('REPLAY');
  await expect(publish(driver, sample({ longitude: 45 }), id)).rejects.toThrow();
  expect(
    (await publish(driver, sample({ capturedAt: new Date(Date.now() - 10000).toISOString() })))[0]!
      .v.status,
  ).toBe('OUT_OF_ORDER');
  expect((await publish(driver))[0]!.v.status).toBe('THROTTLED');
  expect(await as(customer, 'select * from public.trip_live_locations')).toHaveLength(1);
  for (const actor of [otherCustomer, replacement, '13000000-0000-4000-8000-000000000004'])
    expect(await as(actor, 'select * from public.trip_live_locations')).toHaveLength(0);
  await expect(as(driver, 'select * from private.trip_location_samples')).rejects.toThrow();
  await expect(
    as(driver, `update public.trip_live_locations set latitude=0 where trip_id='${trip}'`),
  ).rejects.toThrow();
  const feed = await as(
    customer,
    `select public.tracking_feed('83000000-0000-4000-8000-000000000001')`,
  );
  expect(JSON.stringify(feed)).toContain('PROVIDER_NOT_CONFIGURED');
  expect(JSON.stringify(feed)).not.toContain(driver);
});
it('bounds sample history on authoritative publication without losing the latest point', async () => {
  await db.exec('begin');
  try {
    await db.exec(`update private.tracking_configuration set history_cap=100;
      insert into private.trip_location_samples select gen_random_uuid(),s.trip_id,s.session_id,s.actor_id,s.assignment_id,s.latitude,s.longitude,s.accuracy_m,s.speed_mps,s.heading,s.captured_at,clock_timestamp()-interval '1 hour',s.client_type,s.intent from private.trip_location_samples s cross join generate_series(1,120);
      update public.trip_live_locations set received_at=clock_timestamp()-interval '1 minute', captured_at=clock_timestamp()-interval '1 minute' where trip_id='${trip}'`);
    expect((await publish(driver))[0]!.v.status).toBe('ACCEPTED');
    expect(
      (
        await db.query<{ n: number }>(
          `select count(*)::int n from private.trip_location_samples where trip_id='${trip}'`,
        )
      ).rows[0]!.n,
    ).toBe(100);
    expect(await as(driver, 'select * from public.trip_live_locations')).toHaveLength(1);
  } finally {
    await db.exec('rollback');
  }
});
it('clears old position on reassignment, rejects old retries and accepts only new assignment', async () => {
  const snapshot = (
    await db.query<{ v: unknown }>(
      `select to_jsonb(o)-array['updated_at','operational_status','operational_completed_at'] v from public.orders o`,
    )
  ).rows;
  await op('reassign', trip, {
    driverId: otherResource,
    vehicleId: vehicle,
    reason: 'Synthetic reassignment',
    confirmed: true,
  });
  expect(
    (
      await as<{ latitude: number | null }>(
        customer,
        'select latitude from public.trip_live_locations',
      )
    )[0]!.latitude,
  ).toBeNull();
  await expect(publish(driver)).rejects.toThrow();
  expect((await publish(replacement))[0]!.v.status).toBe('ACCEPTED');
  expect(
    (
      await db.query<{ v: unknown }>(
        `select to_jsonb(o)-array['updated_at','operational_status','operational_completed_at'] v from public.orders o`,
      )
    ).rows,
  ).toEqual(snapshot);
  expect(
    await as(customer, `select * from public.notifications where event_code='TRIP_REASSIGNED'`),
  ).toHaveLength(0);
  expect(
    await as(staff, `select * from public.notifications where event_code='TRIP_REASSIGNED'`),
  ).toHaveLength(1);
});
it('suspension/role loss revoke both reads and publication; retention removes old evidence', async () => {
  await db.exec(
    `update public.organization_memberships set status='suspended' where profile_id='${customer}';`,
  );
  expect(await as(customer, 'select * from public.trip_live_locations')).toHaveLength(0);
  await db.exec(
    `update public.organization_memberships set status='active' where profile_id='${customer}';`,
  );
  await db.exec('begin');
  await db.exec(`delete from public.user_roles where profile_id='${replacement}'`);
  await expect(publish(replacement)).rejects.toThrow();
  await db.exec('rollback');
  await expect(db.query('select private.prune_tracking_history()')).rejects.toThrow(
    'Retention policy not configured',
  );
  await db.exec(
    `update private.tracking_configuration set staging_retention_hours=24;update private.trip_location_samples set received_at=clock_timestamp()-interval '25 hours';update public.trip_live_locations set received_at=clock_timestamp()-interval '25 hours' where trip_id='${trip}'`,
  );
  await db.query('select private.prune_tracking_history()');
  expect(
    (await db.query<{ n: number }>('select count(*)::int n from private.trip_location_samples'))
      .rows[0]!.n,
  ).toBe(0);
  expect(
    (await db.query<{ latitude: number | null }>('select latitude from public.trip_live_locations'))
      .rows[0]!.latitude,
  ).toBeNull();
});
it('terminal state removes live coordinates and denies further publication', async () => {
  await op('fail', trip, { reason: 'Synthetic terminal test' });
  await expect(publish(replacement)).rejects.toThrow();
  const latest = await as<{ active: boolean; latitude: number | null }>(
    customer,
    'select active,latitude from public.trip_live_locations',
  );
  expect(latest[0]).toEqual({ active: false, latitude: null });
  expect(
    (
      await db.query<{ n: number }>(
        'select count(*)::int n from private.trip_tracking_sessions where ended_at is null',
      )
    ).rows[0]!.n,
  ).toBe(0);
});
