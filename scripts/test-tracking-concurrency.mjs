// Each call opens an independent real PostgreSQL connection. LOCAL only, no cloud URL.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const org = '23000000-0000-4000-8000-000000000001',
  staff = '13000000-0000-4000-8000-000000000001',
  a = '14000000-0000-4000-8000-000000000001',
  b = '14000000-0000-4000-8000-000000000002';
function sql(statement, actor) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        'supabase_db_naql365',
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let out = '',
      err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', () => reject(Error('Local PostgreSQL unavailable')));
    child.on('exit', (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(
            Object.assign(Error('Local Driver SQL rejected'), {
              sqlstate: err.match(/ERROR:\s+(\w{5})/)?.[1],
            }),
          ),
    );
    child.stdin.end(
      `\\set VERBOSITY sqlstate\nbegin;${actor ? `set local role authenticated;set local request.jwt.claim.sub='${actor}';` : ''}${statement};commit;`,
    );
  });
}
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const assert = (v, label) => {
  if (!v) throw Error(`Driver concurrency assertion: ${label}`);
};
const revision = (id) => sql(`select revision from public.trips where id='${id}'`).then(Number);
async function staffCommand(action, id, payload = {}) {
  return JSON.parse(
    await sql(`select public.phase3_command('${action}','${id}',${json(payload)})`, staff),
  );
}
async function driverCommand(actor, id, action, rev, mutation, payload = {}) {
  return JSON.parse(
    await sql(
      `select public.driver_execute('${id}','${action}',${rev},'${mutation}',${json(payload)})`,
      actor,
    ),
  );
}
let setup = false;
try {
  const fixture = readFileSync(
    new URL('../supabase/tests/phase3.test.sql', import.meta.url),
    'utf8',
  )
    .split('set local role authenticated;')[0]
    .replace('begin;', '');
  await sql(fixture);
  setup = true;
  await sql(
    `insert into auth.users(id,email) values('${a}','driver-a@example.invalid'),('${b}','driver-b@example.invalid');insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${a}','driver'),('${org}','${b}','driver');insert into public.user_roles(organization_id,profile_id,role_id) select '${org}',u.id,r.id from auth.users u cross join public.roles r where u.id in ('${a}','${b}') and r.code='DRIVER'`,
  );
  const marketId = await sql(
      `select id from public.markets where organization_id='${org}' and country_code='SA'`,
    ),
    cityId = await sql(`select id from public.market_cities where market_id='${marketId}' limit 1`);
  const da = (
      await staffCommand('create_driver', org, {
        marketId,
        type: 'INTERNAL',
        name: 'Driver race A',
      })
    ).id,
    db = (
      await staffCommand('create_driver', org, {
        marketId,
        type: 'INTERNAL',
        name: 'Driver race B',
      })
    ).id;
  await sql(
    `update public.drivers set profile_id='${a}' where id='${da}';update public.drivers set profile_id='${b}' where id='${db}'`,
  );
  const vehicle = (
    await staffCommand('create_vehicle', org, {
      marketId,
      type: 'Truck',
      identifier: 'DRIVER-RACE',
    })
  ).id;
  const job = (await staffCommand('create_job', '83000000-0000-4000-8000-000000000001')).id;
  const trip = (await staffCommand('create_trip', job)).id;
  await staffCommand('plan', trip, {
    plannedStart: '2026-10-01T09:00:00Z',
    plannedEnd: '2026-10-01T13:00:00Z',
    stops: [
      { cityId, kind: 'PICKUP', address: 'Synthetic pickup', pickups: [] },
      { cityId, kind: 'DELIVERY', address: 'Synthetic delivery', pickups: [0] },
    ],
  });
  await staffCommand('assign', trip, { driverId: da, vehicleId: vehicle });
  await staffCommand('ready', trip);

  await driverCommand(a, trip, 'dispatch', await revision(trip), randomUUID());
  const publish = (actor, id, captured, longitude = 46.6753) =>
    sql(
      `select public.publish_trip_location('${trip}','${id}',${json({ latitude: 24.7136, longitude, accuracy: 5, speed: 3, capturedAt: captured, clientType: 'WEB' })})`,
      actor,
    ).then(JSON.parse);
  const captured = new Date(Date.now() - 5000).toISOString(),
    id = randomUUID();
  const dup = await Promise.all([publish(a, id, captured), publish(a, id, captured)]);
  assert(
    dup.filter((r) => r.status === 'ACCEPTED').length === 1 &&
      dup.filter((r) => r.status === 'REPLAY').length === 1,
    'duplicate sample stores once',
  );
  assert(
    (await sql(`select count(*) from private.trip_location_samples where trip_id='${trip}'`)) ===
      '1',
    'one sample',
  );
  console.log('PASS: independent duplicate location replay');
  await sql(
    `update public.trip_live_locations set received_at=clock_timestamp()-interval '31 seconds' where trip_id='${trip}'`,
  );
  const newest = new Date().toISOString();
  await publish(a, randomUUID(), newest, 46.68);
  assert(
    (await publish(a, randomUUID(), captured, 46.67)).status === 'OUT_OF_ORDER',
    'older cannot overwrite',
  );
  console.log('PASS: newer then delayed older location');
  await sql(
    `update public.trip_live_locations set received_at=clock_timestamp()-interval '31 seconds' where trip_id='${trip}'`,
  );
  const concurrent = await Promise.all([
    publish(a, randomUUID(), new Date(Date.now() + 100).toISOString(), 46.69),
    publish(a, randomUUID(), new Date(Date.now() + 200).toISOString(), 46.7),
  ]);
  assert(
    concurrent.filter((r) => r.status === 'ACCEPTED').length === 1,
    'simultaneous samples respect rate',
  );
  assert(
    concurrent.every((r) => ['ACCEPTED', 'THROTTLED', 'OUT_OF_ORDER'].includes(r.status)),
    'known concurrent outcomes',
  );
  console.log('PASS: simultaneous independent samples remain rate bounded');
  const revisionBefore = await revision(trip);
  const outcomes = await Promise.allSettled([
    publish(a, randomUUID(), new Date(Date.now() + 300).toISOString(), 46.71),
    staffCommand('reassign', trip, {
      driverId: db,
      vehicleId: vehicle,
      reason: 'Location authority race',
      confirmed: true,
    }),
  ]);
  assert(outcomes[1].status === 'fulfilled', 'dispatcher completes reassignment');
  if (outcomes[0].status === 'rejected')
    assert(outcomes[0].reason.sqlstate === '42501', 'only authority denial allowed');
  await publish(a, randomUUID(), new Date().toISOString()).then(
    () => {
      throw Error('Old driver still authorized');
    },
    (e) => assert(e.sqlstate === '42501', 'old driver denied'),
  );
  assert(
    (await publish(b, randomUUID(), new Date().toISOString(), 31.2357)).status === 'ACCEPTED',
    'replacement publication accepted',
  );
  assert((await revision(trip)) === revisionBefore + 1, 'GPS does not mutate operational revision');
  assert(
    (await sql(`select count(*) from public.assignments where trip_id='${trip}'`)) === '2',
    'history retained',
  );
  console.log(
    'PASS: independent Driver publication versus Dispatcher reassignment; old denied/new accepted',
  );

  const second = (await staffCommand('create_trip', job)).id;
  const secondVehicle = (
    await staffCommand('create_vehicle', org, {
      marketId,
      type: 'Truck',
      identifier: 'TRACKING-RACE-2',
    })
  ).id;
  await staffCommand('plan', second, {
    plannedStart: '2026-10-01T09:00:00Z',
    plannedEnd: '2026-10-01T13:00:00Z',
    stops: [
      { cityId, kind: 'PICKUP', address: 'Synthetic second pickup', pickups: [] },
      { cityId, kind: 'DELIVERY', address: 'Synthetic second delivery', pickups: [0] },
    ],
  });
  await staffCommand('assign', second, { driverId: da, vehicleId: secondVehicle });
  await staffCommand('ready', second);
  await driverCommand(a, second, 'dispatch', await revision(second), randomUUID());
  await sql(
    `update public.trip_live_locations set received_at=clock_timestamp()-interval '31 seconds' where trip_id='${trip}'`,
  );
  const acceptedBefore = Number(
    await sql(
      `select count(*) from private.trip_location_samples where trip_id in ('${trip}','${second}')`,
    ),
  );
  const burst = await Promise.all(
    Array.from({ length: 20 }, (_, i) => {
      const tid = i % 2 ? trip : second,
        actor = i % 2 ? b : a;
      return sql(
        `select public.publish_trip_location('${tid}','${randomUUID()}',${json({ latitude: 24.72, longitude: 46.69, accuracy: 5, speed: 3, capturedAt: new Date().toISOString(), clientType: 'NATIVE' })})`,
        actor,
      ).then(JSON.parse);
    }),
  );
  assert(
    burst.filter((r) => r.status === 'ACCEPTED').length === 2,
    'two active Trips each accept at most one sample in burst',
  );
  assert(
    Number(
      await sql(
        `select count(*) from private.trip_location_samples where trip_id in ('${trip}','${second}')`,
      ),
    ) ===
      acceptedBefore + 2,
    'bounded write load',
  );
  console.log('PASS: twenty independent publications across two active Trips remain bounded');
} finally {
  if (setup) {
    const local = JSON.parse(
      execFileSync(
        process.execPath,
        ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    );
    const endpoint = new URL(local.API_URL);
    assert(
      ['127.0.0.1', 'localhost'].includes(endpoint.hostname) && endpoint.port === '54321',
      'local cleanup only',
    );
    const client = createClient(endpoint.origin, local.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const paths = JSON.parse(
      await sql(
        `select coalesce(json_agg(object_name),'[]'::json) from public.trip_pods where organization_id='${org}'`,
      ),
    );
    if (paths.length) {
      const result = await client.storage.from('pod-files').remove(paths);
      assert(!result.error, 'private fixture cleanup');
    }
    await sql(
      `set local app.fixture_cleanup='on';delete from private.driver_mutations where actor_id in ('${a}','${b}');delete from public.trip_event_locations where organization_id='${org}';delete from public.issue_photos where organization_id='${org}';delete from public.issues where organization_id='${org}';delete from public.trip_pods where organization_id='${org}';delete from public.trip_events where organization_id='${org}';delete from public.trip_stop_dependencies where organization_id='${org}';delete from public.trip_stops where organization_id='${org}';delete from public.assignments where organization_id='${org}';delete from public.trips where organization_id='${org}';delete from public.jobs where organization_id='${org}';delete from private.operational_mutations where organization_id='${org}';delete from public.orders where organization_id='${org}';delete from public.quote_versions where organization_id='${org}';delete from public.quotes where organization_id='${org}';delete from public.requests where organization_id='${org}';delete from public.customers where organization_id='${org}';delete from public.drivers where organization_id='${org}';delete from public.vehicles where organization_id='${org}';delete from public.user_roles where profile_id::text like '13000000%' or profile_id in ('${a}','${b}');delete from public.organization_memberships where profile_id::text like '13000000%' or profile_id in ('${a}','${b}');delete from auth.users where id::text like '13000000%' or id in ('${a}','${b}');delete from public.market_cities where organization_id::text like '23000000%';delete from public.market_regions where organization_id::text like '23000000%';delete from public.markets where organization_id::text like '23000000%';delete from public.audit_logs where organization_id::text like '23000000%';delete from public.organizations where id::text like '23000000%';drop function public.phase3_command(text,uuid,jsonb);drop function public.phase3_assert(boolean,text)`,
    );
  }
}
