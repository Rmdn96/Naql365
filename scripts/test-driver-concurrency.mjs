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
async function race(calls, label, min, max = min) {
  const result = await Promise.allSettled(calls),
    passed = result.filter((r) => r.status === 'fulfilled').length;
  assert(passed >= min && passed <= max, label);
  for (const r of result)
    if (r.status === 'rejected')
      assert(
        ['40001', '23505', '42501', '55000'].includes(r.reason?.sqlstate),
        `${label}: unexpected SQL failure`,
      );
  console.log(`PASS: ${label}`);
  return result;
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
  let rev = await revision(trip),
    mutation = randomUUID();
  const start = await race(
    [
      driverCommand(a, trip, 'dispatch', rev, mutation),
      driverCommand(a, trip, 'dispatch', rev, mutation),
    ],
    'two identical Driver starts replay',
    2,
  );
  assert(JSON.stringify(start[0].value) === JSON.stringify(start[1].value), 'same start result');
  assert(
    (await sql(
      `select count(*) from public.trip_events where trip_id='${trip}' and event_type='DISPATCH'`,
    )) === '1',
    'one start event',
  );
  const stops = JSON.parse(
    await sql(
      `select json_agg(id order by position) from public.trip_stops where trip_id='${trip}'`,
    ),
  );
  for (const action of ['arrive', 'start_service'])
    await driverCommand(a, trip, action, await revision(trip), randomUUID(), { stopId: stops[0] });
  rev = await revision(trip);
  // Reassignment reads its revision under the same org lock; either ordering is legal.
  await race(
    [
      driverCommand(a, trip, 'complete_stop', rev, randomUUID(), { stopId: stops[0] }),
      sql(
        `select pg_advisory_xact_lock(hashtextextended('${org}',34));select public.phase3_command('reassign','${trip}',${json({ driverId: db, vehicleId: vehicle, reason: 'Concurrency emergency fixture', confirmed: true })})`,
        staff,
      ),
    ],
    'Driver Stop completion versus Dispatcher reassignment',
    1,
    2,
  );
  const old = await Promise.allSettled([
    driverCommand(a, trip, 'complete_stop', await revision(trip), randomUUID(), {
      stopId: stops[0],
    }),
  ]);
  assert(
    old[0].status === 'rejected' && old[0].reason.sqlstate === '42501',
    'old Driver rejected after reassignment',
  );
  console.log('PASS: old Driver loses authority after reassignment');
  if ((await sql(`select status from public.trip_stops where id='${stops[0]}'`)) !== 'COMPLETED')
    await driverCommand(b, trip, 'complete_stop', await revision(trip), randomUUID(), {
      stopId: stops[0],
    });
  assert(
    (await sql(`select count(*) from public.assignments where trip_id='${trip}'`)) === '2',
    'history retained',
  );
  const issueMutation = randomUUID(),
    issueSql = `select public.report_driver_issue('${trip}','${stops[1]}','OTHER','Synthetic retry fixture','${issueMutation}')`;
  const issues = await race(
    [sql(issueSql, b), sql(issueSql, b)],
    'duplicate Driver issue retry',
    2,
  );
  assert(issues[0].value === issues[1].value, 'one issue result');
  const issue = JSON.parse(issues[0].value).id;
  await sql(`select public.resolve_driver_issue('${issue}','Continue after fixture check')`, staff);
  for (const action of ['depart', 'arrive', 'start_service'])
    await driverCommand(b, trip, action, await revision(trip), randomUUID(), { stopId: stops[1] });
  rev = await revision(trip);
  mutation = randomUUID();
  await race(
    [
      driverCommand(b, trip, 'complete_stop', rev, mutation, { stopId: stops[1] }),
      driverCommand(b, trip, 'complete_stop', rev, mutation, { stopId: stops[1] }),
    ],
    'two identical Stop completions replay',
    2,
  );
  assert(
    (await sql(
      `select count(*) from public.trip_events where trip_id='${trip}' and stop_id='${stops[1]}' and event_type='COMPLETE_STOP'`,
    )) === '1',
    'one Stop completion event',
  );
  const file = randomUUID();
  const pod = JSON.parse(
    await sql(
      `select public.trip_pod_command('${trip}','${file}','reserve','Fixture recipient','image/png',8)`,
      b,
    ),
  );
  await sql(
    `select set_config('storage.operation','object.upload',true);insert into storage.objects(bucket_id,name,metadata) values('pod-files','${pod.path}','{"mimetype":"image/png","size":8}')`,
    b,
  );
  const podSql = `select public.driver_finalize_pod('${trip}','${file}')`;
  await race([sql(podSql, b), sql(podSql, b)], 'two Driver POD submissions replay', 2);
  assert(
    (await sql(
      `select count(*) from public.trip_pods where trip_id='${trip}' and state='FINAL'`,
    )) === '1',
    'one final POD',
  );
  rev = await revision(trip);
  await race(
    [
      driverCommand(b, trip, 'complete_trip', rev, randomUUID()),
      sql(
        `select public.operations_command('${org}','complete_trip','${trip}',${rev},'${randomUUID()}','{}')`,
        staff,
      ),
    ],
    'Driver versus staff final completion',
    1,
  );
  assert(
    (await sql(`select status from public.trips where id='${trip}'`)) === 'COMPLETED',
    'final Trip state',
  );
  assert(
    (await sql(`select status from public.jobs where id='${job}'`)) === 'COMPLETED',
    'final aggregate state',
  );
  assert(
    (await sql(
      `select count(*) from public.trip_events where trip_id='${trip}' and event_type='COMPLETE_TRIP'`,
    )) === '1',
    'one completion milestone',
  );
  console.log('PASS: independent-connection Driver concurrency matrix');
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
