// Actual independent PostgreSQL connections, restricted to the named LOCAL container.
// Never accepts a remote URL, password or cloud project. Fixtures are removed in finally.
import { spawn, execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const org = '23000000-0000-4000-8000-000000000001';
const actor = '13000000-0000-4000-8000-000000000001';
const order = '83000000-0000-4000-8000-000000000001';
function sql(statement, authenticated = false) {
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
    let output = '',
      errors = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (errors += d));
    child.on('error', () => reject(new Error('Local PostgreSQL unavailable')));
    child.on('exit', (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(
            Object.assign(new Error('Local SQL assertion failed'), {
              sqlstate: errors.match(/ERROR:\s+(\w{5})/)?.[1] ?? 'unknown',
            }),
          ),
    );
    child.stdin.end(
      `\\set VERBOSITY sqlstate\nbegin;${authenticated ? `set local role authenticated; set local request.jwt.claim.sub='${actor}';` : ''}${statement};commit;`,
    );
  });
}
const literal = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
async function command(action, id, payload = {}, revision, mutation = randomUUID()) {
  const expression =
    revision === undefined
      ? `public.phase3_command('${action}','${id}',${literal(payload)})`
      : `public.operations_command('${org}','${action}','${id}',${revision},'${mutation}',${literal(payload)})`;
  return JSON.parse(await sql(`select ${expression}`, true));
}
const revision = (id) => sql(`select revision from public.trips where id='${id}'`).then(Number);
function assert(value, label) {
  if (!value) throw new Error(`Concurrency assertion failed: ${label}`);
}
async function race(calls, successes, label) {
  const results = await Promise.allSettled(calls);
  assert(results.filter((r) => r.status === 'fulfilled').length === successes, label);
  for (const result of results) {
    if (result.status === 'rejected')
      assert(
        ['40001', '23505'].includes(result.reason?.sqlstate),
        `${label}: expected conflict SQLSTATE`,
      );
  }
  return results;
}
let setup = false;
try {
  const source = readFileSync(
    new URL('../supabase/tests/phase3.test.sql', import.meta.url),
    'utf8',
  );
  const fixture = source
    .split('set local role authenticated;')[0]
    .replace(/^([\s\S]*?)begin;/, '$1');
  await sql(fixture);
  setup = true;
  const marketId = await sql(
    `select id from public.markets where organization_id='${org}' and country_code='SA'`,
  );
  const cityId = await sql(
    `select id from public.market_cities where market_id='${marketId}' and code='Riyadh'`,
  );
  const [j1, j2] = await Promise.all([command('create_job', order), command('create_job', order)]);
  assert(j1.id === j2.id, 'one Job per Order');
  const job = j1.id;
  const creations = await race(
    [command('create_trip', job, {}, 0), command('create_trip', job, {}, 0)],
    1,
    'Trip creation revision race',
  );
  const t1 = creations.find((r) => r.status === 'fulfilled').value.id;
  const t2 = (await command('create_trip', job)).id;
  assert(
    (await sql(`select count(distinct reference) from public.trips where job_id='${job}'`)) === '2',
    'unique Trip references',
  );
  const d1 = (
    await command('create_driver', job, { marketId, type: 'INTERNAL', name: 'Concurrent A' })
  ).id;
  const d2 = (
    await command('create_driver', job, { marketId, type: 'EXTERNAL', name: 'Concurrent B' })
  ).id;
  const d3 = (
    await command('create_driver', job, { marketId, type: 'EXTERNAL', name: 'Concurrent C' })
  ).id;
  const v1 = (
    await command('create_vehicle', job, { marketId, type: 'Truck', identifier: 'CONCURRENT-A' })
  ).id;
  const v2 = (
    await command('create_vehicle', job, { marketId, type: 'Truck', identifier: 'CONCURRENT-B' })
  ).id;
  const v3 = (
    await command('create_vehicle', job, { marketId, type: 'Truck', identifier: 'CONCURRENT-C' })
  ).id;
  const plan = {
    plannedStart: '2026-10-01T09:00:00Z',
    plannedEnd: '2026-10-01T13:00:00Z',
    stops: [
      { cityId, kind: 'PICKUP', address: 'Fixture pickup', pickups: [] },
      { cityId, kind: 'DELIVERY', address: 'Fixture delivery', pickups: [0] },
    ],
  };
  for (const id of [t1, t2]) await command('plan', id, plan);
  const rev = await revision(t1);
  await race(
    [
      command('assign', t1, { driverId: d1, vehicleId: v1 }, rev),
      command('assign', t1, { driverId: d2, vehicleId: v2 }, rev),
    ],
    1,
    'initial assignment race',
  );
  // Normalize the winner without bypassing command invariants.
  const active = JSON.parse(
    await sql(
      `select json_build_object('driverId',driver_id,'vehicleId',vehicle_id) from public.assignments where trip_id='${t1}' and ended_at is null`,
    ),
  );
  await command('assign', t2, {
    driverId: active.driverId,
    vehicleId: active.vehicleId === v1 ? v2 : v1,
  });
  for (const id of [t1, t2]) await command('ready', id);
  const dispatch = await race(
    [command('dispatch', t1), command('dispatch', t2)],
    1,
    'exclusive Driver race',
  );
  const executing = dispatch[0].status === 'fulfilled' ? t1 : t2;
  const waiting = executing === t1 ? t2 : t1;
  const executingAssignment = JSON.parse(
    await sql(
      `select json_build_object('driverId',driver_id,'vehicleId',vehicle_id) from public.assignments where trip_id='${executing}' and ended_at is null`,
    ),
  );
  await command('assign', waiting, { driverId: d3, vehicleId: executingAssignment.vehicleId });
  await command('ready', waiting);
  await race([command('dispatch', waiting)], 0, 'exclusive Vehicle conflict');
  const emergencyRevision = await revision(executing);
  await race(
    [
      command(
        'reassign',
        executing,
        { driverId: d3, vehicleId: v3, reason: 'Fixture emergency', confirmed: true },
        emergencyRevision,
      ),
      command(
        'reassign',
        executing,
        { driverId: d3, vehicleId: v3, reason: 'Fixture emergency', confirmed: true },
        emergencyRevision,
      ),
    ],
    1,
    'emergency reassignment race',
  );
  await command('assign', waiting, {
    driverId: executingAssignment.driverId,
    vehicleId: executingAssignment.vehicleId,
  });
  await command('ready', waiting);
  await command('dispatch', waiting);
  for (const trip of [t1, t2]) {
    const stops = JSON.parse(
      await sql(
        `select json_agg(json_build_object('id',id,'position',position) order by position) from public.trip_stops where trip_id='${trip}'`,
      ),
    );
    for (const stop of stops) {
      if (stop.position > 0) await command('depart', trip, { stopId: stop.id });
      await command('arrive', trip, { stopId: stop.id });
      await command('start_service', trip, { stopId: stop.id });
      const rev = await revision(trip);
      await race(
        [
          command('complete_stop', trip, { stopId: stop.id }, rev),
          command('complete_stop', trip, { stopId: stop.id }, rev),
        ],
        1,
        'Stop completion race',
      );
    }
    const file = randomUUID();
    const reserve = `select public.trip_pod_command('${trip}','${file}','reserve','Fixture recipient','image/png',8)`;
    const pods = await Promise.all([sql(reserve, true), sql(reserve, true)]);
    assert(pods[0] === pods[1], 'same POD reservation retry');
    const path = JSON.parse(pods[0]).path;
    await sql(
      `set local storage.operation='object.upload';insert into storage.objects(bucket_id,name,metadata) values('pod-files','${path}','{"mimetype":"image/png","size":8}')`,
      true,
    );
    const finalize = `select public.trip_pod_command('${trip}','${file}','finalize')`;
    await race([sql(finalize, true), sql(finalize, true)], 2, 'POD finalization retry');
  }
  // Distinct final Trips race on one Job; exactly one aggregate completion event.
  const finalRevision1 = await revision(t1),
    finalRevision2 = await revision(t2);
  await race(
    [
      command('complete_trip', t1, {}, finalRevision1),
      command('complete_trip', t1, {}, finalRevision1),
      command('complete_trip', t2, {}, finalRevision2),
    ],
    2,
    'last Trip aggregate completion race',
  );
  assert(
    (await sql(`select status from public.jobs where id='${job}'`)) === 'COMPLETED',
    'aggregate complete',
  );
  assert(
    (await sql(
      `select count(*) from public.audit_logs where entity_id='${job}' and action='JOB_COMPLETED'`,
    )) === '1',
    'single aggregate completion event',
  );
  assert(
    (await sql(
      `select count(*) from public.trip_pods where organization_id='${org}' and state='FINAL'`,
    )) === '2',
    'one final POD per Trip',
  );
  console.log(
    'PASS: independent PostgreSQL Job/reference/assignment/resource/reassignment/Stop/POD/aggregate races',
  );
} finally {
  if (setup) {
    // Supabase Storage disallows direct object DELETE, including maintenance SQL.
    // Use its supported LOCAL API; never print the CLI credential summary.
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
      'local Storage cleanup endpoint',
    );
    const storage = createClient(endpoint.origin, local.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const paths = JSON.parse(
      await sql(
        `select coalesce(json_agg(object_name),'[]'::json) from public.trip_pods where organization_id='${org}'`,
      ),
    );
    if (paths.length) {
      const removed = await storage.storage.from('pod-files').remove(paths);
      assert(!removed.error, 'Storage API fixture cleanup');
    }
    await sql(`set local app.fixture_cleanup='on';
 delete from public.trip_pods where organization_id='${org}';delete from public.trip_events where organization_id='${org}';
 delete from public.trip_stop_dependencies where organization_id='${org}';delete from public.trip_stops where organization_id='${org}';
 delete from public.assignments where organization_id='${org}';delete from public.trips where organization_id='${org}';delete from public.jobs where organization_id='${org}';
 delete from private.operational_mutations where organization_id='${org}';delete from public.orders where organization_id='${org}';
 delete from public.quote_versions where organization_id='${org}';delete from public.quotes where organization_id='${org}';delete from public.requests where organization_id='${org}';
 delete from public.customers where organization_id='${org}';delete from public.drivers where organization_id='${org}';delete from public.vehicles where organization_id='${org}';
 delete from public.user_roles where profile_id::text like '13000000%';delete from public.organization_memberships where profile_id::text like '13000000%';
 delete from auth.users where id::text like '13000000%';delete from public.market_cities where organization_id::text like '23000000%';delete from public.market_regions where organization_id::text like '23000000%';delete from public.markets where organization_id::text like '23000000%';delete from public.audit_logs where organization_id::text like '23000000%';delete from public.organizations where id::text like '23000000%';
 drop function public.phase3_command(text,uuid,jsonb);drop function public.phase3_assert(boolean,text)`);
  }
}
