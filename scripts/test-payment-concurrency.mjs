// Local Supabase only. Every sql() call is an independent PostgreSQL connection.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const org = '23000000-0000-4000-8000-000000000001',
  customer = '13000000-0000-4000-8000-000000000002',
  staff = '13000000-0000-4000-8000-000000000001',
  finance = '13000000-0000-4000-8000-000000000006',
  order = '83000000-0000-4000-8000-000000000001';
const assert = (ok, label) => {
  if (!ok) throw Error(`Payment concurrency: ${label}`);
};
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
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
            Object.assign(Error('Local payment SQL rejected'), {
              sqlstate: err.match(/ERROR:\s+(\w{5})/)?.[1],
            }),
          ),
    );
    child.stdin.end(
      `\\set VERBOSITY sqlstate\nbegin;set local statement_timeout='20s';${actor ? `set local role authenticated;set local request.jwt.claim.sub='${actor}';` : ''}${statement};commit;`,
    );
  });
}
const command = (action, revision, payload, actor = customer, mutation = randomUUID()) =>
  sql(
    `select public.payment_command('${order}','${action}','${mutation}',${revision},${json(payload)})`,
    actor,
  ).then(JSON.parse);
const op = (action, id, payload = {}) =>
  sql(`select public.phase3_command('${action}','${id}',${json(payload)})`, staff).then(JSON.parse);
async function race(calls, label, min, max = min) {
  const results = await Promise.allSettled(calls),
    fulfilled = results.filter((r) => r.status === 'fulfilled');
  assert(fulfilled.length >= min && fulfilled.length <= max, label);
  for (const r of results)
    if (r.status === 'rejected')
      assert(
        ['40001', '55000', '23505'].includes(r.reason?.sqlstate),
        `${label} unexpected rejection`,
      );
  console.log(`PASS: ${label}`);
  return results;
}
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
  'local fixtures only',
);
const storage = createClient(endpoint.origin, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).storage;
let setup = false;
async function prepare() {
  const fixture = readFileSync(
    new URL('../supabase/tests/phase3.test.sql', import.meta.url),
    'utf8',
  )
    .split('set local role authenticated;')[0]
    .replace('begin;', '');
  await sql(fixture);
  setup = true;
  await sql(
    `insert into auth.users(id,email) values('${finance}','finance-race@example.invalid');insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${finance}','staff');insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${finance}',id from public.roles where code='FINANCE';insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by) select '${org}',id,currency,'TEST ONLY','TEST ONLY','TEST ONLY','TEST ONLY','TEST-ONLY-0000','${finance}' from public.markets where organization_id='${org}'`,
  );
}
async function readyTrip() {
  const marketId = await sql(`select id from public.markets where organization_id='${org}'`),
    cityId = await sql(`select id from public.market_cities where market_id='${marketId}' limit 1`);
  const job = (await op('create_job', order)).id,
    trip = (await op('create_trip', job)).id;
  const driver = (await op('create_driver', org, { marketId, type: 'EXTERNAL', name: 'TEST ONLY' }))
    .id;
  const vehicle = (
    await op('create_vehicle', org, { marketId, type: 'Truck', identifier: 'PAYMENT-RACE-ONLY' })
  ).id;
  await op('plan', trip, {
    plannedStart: new Date(Date.now() + 3600000).toISOString(),
    plannedEnd: new Date(Date.now() + 7200000).toISOString(),
    stops: [
      { cityId, kind: 'PICKUP', address: 'Test pickup', pickups: [] },
      { cityId, kind: 'DELIVERY', address: 'Test delivery', pickups: [0] },
    ],
  });
  await op('assign', trip, { driverId: driver, vehicleId: vehicle });
  await op('ready', trip);
  return trip;
}
async function transfer() {
  await command('choose', 1, { method: 'BANK_TRANSFER' });
  const r = await command('reserve', 2, {
    fileId: randomUUID(),
    mime: 'application/pdf',
    size: 24,
  });
  // The race exercises DB submission/verification, not file decoding; hosted
  // acceptance separately uploads actual validated bytes through the application.
  await sql(
    `insert into storage.objects(bucket_id,name,metadata) values('documents','${r.path}','{"size":24,"mimetype":"application/pdf"}')`,
  );
  const mutation = randomUUID();
  await race(
    [
      command('submit', 3, { attemptId: r.attemptId }, customer, mutation),
      command('submit', 3, { attemptId: r.attemptId }, customer, mutation),
    ],
    'duplicate proof submission replays one attempt',
    2,
  );
  assert(
    (await sql(
      `select count(*) from public.payment_transactions where event_code='PROOF_SUBMITTED' and organization_id='${org}'`,
    )) === '1',
    'one proof event',
  );
  return r.attemptId;
}
async function cleanup() {
  if (!setup) return;
  const paths = JSON.parse(
    await sql(
      `select coalesce(json_agg(object_name),'[]') from public.file_objects where organization_id='${org}' and purpose='TRANSFER_PROOF'`,
    ),
  );
  if (paths.length) {
    const removed = await storage.from('documents').remove(paths);
    assert(!removed.error, 'proof cleanup');
  }
  await sql(
    `set local app.fixture_cleanup='on';delete from public.notifications where organization_id='${org}';delete from public.invoices where organization_id='${org}';delete from public.payment_transactions where organization_id='${org}';delete from public.bank_transfer_attempts where organization_id='${org}';delete from public.file_objects where organization_id='${org}';delete from public.payments where organization_id='${org}';delete from private.payment_mutations where organization_id='${org}';delete from public.bank_accounts where organization_id='${org}';delete from public.trip_events where organization_id='${org}';delete from public.trip_stop_dependencies where organization_id='${org}';delete from public.trip_stops where organization_id='${org}';delete from public.assignments where organization_id='${org}';delete from public.trips where organization_id='${org}';delete from public.jobs where organization_id='${org}';delete from private.operational_mutations where organization_id='${org}';delete from public.orders where organization_id='${org}';delete from public.quote_versions where organization_id='${org}';delete from public.quotes where organization_id='${org}';delete from public.requests where organization_id='${org}';delete from public.customers where organization_id='${org}';delete from public.drivers where organization_id='${org}';delete from public.vehicles where organization_id='${org}';delete from public.user_roles where profile_id::text like '13000000%';delete from public.organization_memberships where profile_id::text like '13000000%';delete from auth.users where id::text like '13000000%';delete from public.market_cities where organization_id::text like '23000000%';delete from public.market_regions where organization_id::text like '23000000%';delete from public.markets where organization_id::text like '23000000%';delete from public.audit_logs where organization_id::text like '23000000%';delete from public.organizations where id::text like '23000000%';drop function public.phase3_command(text,uuid,jsonb);drop function public.phase3_assert(boolean,text)`,
  );
  setup = false;
}
try {
  await prepare();
  const mutation = randomUUID();
  await race(
    [
      command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' }, finance, mutation),
      command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' }, finance, mutation),
    ],
    'cash confirmation duplicate replay',
    2,
  );
  assert(
    (await sql(`select count(*) from public.invoices where organization_id='${org}'`)) === '1',
    'one cash receipt',
  );
  await cleanup();
  await prepare();
  const attempt = await transfer();
  await race(
    [
      command(
        'confirm_transfer',
        4,
        { attemptId: attempt, amountMinor: 0, currency: 'SAR' },
        finance,
      ),
      command('reject_transfer', 4, { attemptId: attempt, reason: 'TEST ONLY rejection' }, finance),
    ],
    'Finance confirmation versus rejection has one winner',
    1,
  );
  const paid = await sql(`select status='PAID' from public.payments where order_id='${order}'`);
  assert(
    (await sql(`select count(*) from public.invoices where organization_id='${org}'`)) ===
      (paid === 't' ? '1' : '0'),
    'receipt matches Finance result',
  );
  await cleanup();
  await prepare();
  const trip = await readyTrip(),
    proof = await transfer();
  await race(
    [
      command(
        'confirm_transfer',
        4,
        { attemptId: proof, amountMinor: 0, currency: 'SAR' },
        finance,
      ),
      op('dispatch', trip),
    ],
    'Finance confirmation versus physical start is serialized',
    1,
    2,
  );
  assert(
    (await sql(`select status from public.payments where order_id='${order}'`)) === 'PAID',
    'confirmed funds persisted',
  );
  if ((await sql(`select started_at is null from public.trips where id='${trip}'`)) === 't')
    await op('dispatch', trip);
  assert(
    (await sql(
      `select count(*) from public.trip_events where trip_id='${trip}' and event_type='DISPATCH'`,
    )) === '1',
    'one authorized start',
  );
  await cleanup();
  await prepare();
  const cashTrip = await readyTrip();
  await race(
    [command('choose', 1, { method: 'BANK_TRANSFER' }), op('dispatch', cashTrip)],
    'method switch versus physical start has one safe winner',
    1,
  );
  assert(
    (await sql(
      `select not(t.started_at is not null and p.method='BANK_TRANSFER' and p.status<>'PAID') from public.trips t cross join public.payments p where t.id='${cashTrip}' and p.order_id='${order}'`,
    )) === 't',
    'no executing unverified transfer',
  );
} finally {
  await cleanup();
}
console.log('PASS: payment independent-connection races and scoped cleanup');
