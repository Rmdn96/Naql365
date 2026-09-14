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
it('requires real mapped INTERNAL identity and denies raw staff/commercial data', async () => {
  const data = await as<{ v: unknown }>(driver, `select public.driver_trip('${trip}') v`);
  expect(JSON.stringify(data)).toContain('Private pickup');
  expect(JSON.stringify(data)).not.toContain('Staff private');
  for (const table of [
    'trips',
    'trip_stops',
    'assignments',
    'trip_events',
    'quotes',
    'orders',
    'customers',
    'issues',
  ])
    expect(await as(driver, `select id from public.${table}`)).toEqual([]);
  for (const actor of [
    staff,
    replacement,
    '13000000-0000-4000-8000-000000000002',
    '13000000-0000-4000-8000-000000000003',
  ])
    await expect(as(actor, `select public.driver_trip('${trip}')`)).rejects.toThrow();
  await expect(command(driver, 'dispatch', {}, otherTrip)).rejects.toThrow();
  await expect(
    command(driver, 'reassign', { driverId: resource, vehicleId: vehicle }),
  ).rejects.toThrow();
  await expect(
    command(driver, 'dispatch', { driver_id: resource, status: 'COMPLETED' }),
  ).rejects.toThrow();
});
it('replays duplicate starts and preserves explicit Stop state and reassignment authority', async () => {
  const rev = (
    await db.query<{ revision: number }>(`select revision from public.trips where id='${trip}'`)
  ).rows[0]!.revision;
  const mutation = randomUUID();
  const first = await command(driver, 'dispatch', {}, trip, mutation, rev);
  expect(await command(driver, 'dispatch', {}, trip, mutation, rev)).toEqual(first);
  const stops = (
    await db.query<{ id: string }>(
      `select id from public.trip_stops where trip_id='${trip}' order by position`,
    )
  ).rows;
  await expect(command(driver, 'complete_stop', { stopId: stops[1]!.id })).rejects.toThrow();
  await op('reassign', trip, {
    driverId: otherResource,
    vehicleId: vehicle,
    reason: 'Approved replacement',
    confirmed: true,
  });
  await expect(command(driver, 'dispatch', {}, trip, mutation, rev)).rejects.toThrow();
  await expect(as(driver, `select public.driver_trip('${trip}')`)).rejects.toThrow();
  await command(replacement, 'arrive', { stopId: stops[0]!.id });
  expect(
    (
      await db.query<{ source: string; actor_id: string }>(
        `select source,actor_id from public.trip_events where trip_id='${trip}' and event_type='ARRIVE'`,
      )
    ).rows,
  ).toEqual([{ source: 'DRIVER', actor_id: replacement }]);
});
it('reports attention idempotently without terminal failure and requires staff resolution', async () => {
  const stop = (
    await db.query<{ id: string }>(
      `select id from public.trip_stops where trip_id='${trip}' order by position limit 1`,
    )
  ).rows[0]!.id;
  await expect(
    as(
      replacement,
      `select public.report_driver_issue('${trip}','${stop}','OTHER','','${randomUUID()}')`,
    ),
  ).rejects.toThrow();
  const mutation = randomUUID();
  const sql = `select public.report_driver_issue('${trip}','${stop}','ACCESS_BLOCKED','Private issue reason','${mutation}') v`;
  const issue = (await as<{ v: { id: string } }>(replacement, sql))[0]!.v;
  expect((await as<{ v: { id: string } }>(replacement, sql))[0]!.v).toEqual(issue);
  await expect(command(replacement, 'start_service', { stopId: stop })).rejects.toThrow();
  await expect(
    as(replacement, `select public.resolve_driver_issue('${issue.id}','Resolved')`),
  ).rejects.toThrow();
  await as(staff, `select public.resolve_driver_issue('${issue.id}','Access confirmed')`);
  await command(replacement, 'start_service', { stopId: stop });
  await db.exec(
    `update public.organization_memberships set status='suspended' where organization_id='${org}' and profile_id='${replacement}';`,
  );
  await expect(command(replacement, 'complete_stop', { stopId: stop })).rejects.toThrow();
  await db.exec(
    `update public.organization_memberships set status='active' where organization_id='${org}' and profile_id='${replacement}';`,
  );
});
it('rejects role loss, malformed private photo evidence and unauthorized photo access', async () => {
  const stop = (
    await db.query<{ id: string }>(
      `select id from public.trip_stops where trip_id='${trip}' order by position limit 1`,
    )
  ).rows[0]!.id;
  await db.exec(
    `delete from public.user_roles where organization_id='${org}' and profile_id='${replacement}';`,
  );
  await expect(command(replacement, 'complete_stop', { stopId: stop })).rejects.toThrow();
  await db.exec(
    `insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${replacement}',id from public.roles where code='DRIVER';`,
  );
  const issue = (
    await as<{ v: { id: string } }>(
      replacement,
      `select public.report_driver_issue('${trip}','${stop}','OTHER','Harmless fixture','${randomUUID()}') v`,
    )
  )[0]!.v.id;
  const file = randomUUID();
  for (const [mime, size] of [
    ['text/html', 8],
    ['image/png', 2097153],
    ['image/png', 0],
  ])
    await expect(
      as(
        replacement,
        `select public.issue_photo_command('${issue}','${file}','reserve','${mime}',${size})`,
      ),
    ).rejects.toThrow();
  const photo = (
    await as<{ v: { path: string } }>(
      replacement,
      `select public.issue_photo_command('${issue}','${file}','reserve','image/png',8) v`,
    )
  )[0]!.v;
  await expect(
    as(replacement, `select public.issue_photo_command('${issue}','${file}','finalize')`),
  ).rejects.toThrow();
  await as(replacement, `select set_config('storage.operation','object.upload',false)`);
  await as(
    replacement,
    `insert into storage.objects(bucket_id,name,metadata) values('issue-files','${photo.path}','{"mimetype":"image/png","size":8}')`,
  );
  const finalized = await as(
    replacement,
    `select public.issue_photo_command('${issue}','${file}','finalize') v`,
  );
  expect(
    await as(replacement, `select public.issue_photo_command('${issue}','${file}','finalize') v`),
  ).toEqual(finalized);
  expect(
    await as(driver, `select name from storage.objects where bucket_id='issue-files'`),
  ).toEqual([]);
  expect(
    await as(
      '13000000-0000-4000-8000-000000000003',
      `select name from storage.objects where bucket_id='issue-files'`,
    ),
  ).toEqual([]);
  expect(
    (await as(replacement, `select name from storage.objects where bucket_id='issue-files'`))
      .length,
  ).toBe(1);
  await expect(
    as(driver, `select public.driver_evidence_path('issue','${issue}')`),
  ).rejects.toThrow();
  await as(staff, `select public.resolve_driver_issue('${issue}','Photo reviewed, continue')`);
});
it('binds optional arrival location and final POD to the driver actor and preserves aggregate completion', async () => {
  const commercialBefore = (
    await db.query(
      `select to_jsonb(o) v from public.orders o where id='83000000-0000-4000-8000-000000000001'`,
    )
  ).rows[0];
  const stops = (
    await db.query<{ id: string }>(
      `select id from public.trip_stops where trip_id='${trip}' order by position`,
    )
  ).rows;
  await expect(
    as(
      replacement,
      `select public.trip_pod_command('${trip}','${randomUUID()}','reserve','Recipient','image/png',8)`,
    ),
  ).rejects.toThrow();
  await command(replacement, 'complete_stop', { stopId: stops[0]!.id });
  await command(replacement, 'depart', { stopId: stops[1]!.id });
  const revision = (
    await db.query<{ revision: number }>(`select revision from public.trips where id='${trip}'`)
  ).rows[0]!.revision;
  const location = { latitude: 24.7, longitude: 46.6, capturedAt: new Date().toISOString() };
  for (const bad of [
    { ...location, latitude: 91 },
    { ...location, longitude: -181 },
    { ...location, eventId: randomUUID() },
  ])
    await expect(
      as(
        replacement,
        `select public.driver_execute('${trip}','arrive',${revision},'${randomUUID()}',${q({ stopId: stops[1]!.id })},${q(bad)})`,
      ),
    ).rejects.toThrow();
  const arrival = `select public.driver_execute('${trip}','arrive',${revision},'${randomUUID()}',${q({ stopId: stops[1]!.id })},${q(location)}) v`;
  const result = await as(replacement, arrival);
  expect(await as(replacement, arrival)).toEqual(result);
  expect(
    (
      await db.query<{ n: number }>(
        `select count(*)::int n from public.trip_event_locations where trip_id='${trip}'`,
      )
    ).rows[0]!.n,
  ).toBe(1);
  expect(await as(replacement, `select event_id from public.trip_event_locations`)).toEqual([]);
  await command(replacement, 'start_service', { stopId: stops[1]!.id });
  await command(replacement, 'complete_stop', { stopId: stops[1]!.id });
  await expect(command(replacement, 'complete_trip')).rejects.toThrow();
  const file = randomUUID(),
    pod = (
      await as<{ v: { path: string } }>(
        replacement,
        `select public.trip_pod_command('${trip}','${file}','reserve','Separate recipient','image/png',8) v`,
      )
    )[0]!.v;
  await as(replacement, `select set_config('storage.operation','object.upload',false)`);
  await as(
    replacement,
    `insert into storage.objects(bucket_id,name,metadata) values('pod-files','${pod.path}','{"mimetype":"image/png","size":8}')`,
  );
  const finalize = `select public.driver_finalize_pod('${trip}','${file}',${q(location)}) v`;
  expect(await as(replacement, finalize)).toEqual(await as(replacement, finalize));
  await expect(
    as(replacement, `select public.driver_finalize_pod('${trip}','${randomUUID()}')`),
  ).rejects.toThrow();
  expect(
    (await db.query(`select actor_id,recipient_name from public.trip_pods where trip_id='${trip}'`))
      .rows,
  ).toEqual([{ actor_id: replacement, recipient_name: 'Separate recipient' }]);
  const mutation = randomUUID(),
    rev = (
      await db.query<{ revision: number }>(`select revision from public.trips where id='${trip}'`)
    ).rows[0]!.revision;
  const done = await command(replacement, 'complete_trip', {}, trip, mutation, rev);
  expect(await command(replacement, 'complete_trip', {}, trip, mutation, rev)).toEqual(done);
  const historical = (
    await as<{ v: { contact: unknown; stops: { address: unknown }[] } }>(
      replacement,
      `select public.driver_trip('${trip}') v`,
    )
  )[0]!.v;
  expect(historical.contact).toBeNull();
  expect(historical.stops.every((s) => s.address === null)).toBe(true);
  expect(
    await as(
      replacement,
      `select name from storage.objects where bucket_id in ('pod-files','issue-files')`,
    ),
  ).toEqual([]);
  expect(
    (
      await db.query<{ status: string }>(
        `select status from public.jobs where id=(select job_id from public.trips where id='${trip}')`,
      )
    ).rows[0]!.status,
  ).not.toBe('COMPLETED');
  const after = (
    await db.query(
      `select to_jsonb(o) v from public.orders o where id='83000000-0000-4000-8000-000000000001'`,
    )
  ).rows[0];
  expect(after).toEqual(commercialBefore);
});
