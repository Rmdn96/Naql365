// Ephemeral LOCAL Supabase only. Each call spawns an independent psql connection.
// Do not emit SQL, headers, capabilities, database output or credentials on failure.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
const assert = (condition, label) => {
  if (!condition) throw Error(`Guest concurrency: ${label}`);
};
const q = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => q(JSON.stringify(value)) + '::jsonb';
const local = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ),
);
const endpoint = new URL(local.API_URL);
assert(
  ['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.port === '54321',
  'local environment required',
);
const org = '21000000-0000-4000-8000-000000000001',
  sales = '11000000-0000-4000-8000-000000000001';
const sql = (statement, { actor, token, hold = false } = {}) =>
  new Promise((resolve, reject) => {
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
    child.on('error', () => reject(Error('Local database unavailable')));
    child.on('exit', (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(
            Object.assign(Error('Guest command rejected'), {
              sqlstate: err.match(/ERROR:\s+(\w{5})/)?.[1],
            }),
          ),
    );
    const identity = actor
      ? `set local role authenticated;set local request.jwt.claim.sub=${q(actor)};`
      : token !== undefined
        ? `set local role anon;set local request.headers=${q(JSON.stringify({ 'x-naql365-guest': token }))};`
        : '';
    child.stdin.end(
      `\\set VERBOSITY sqlstate\nbegin;set local statement_timeout='20s';${identity}${hold ? 'do $$ begin perform private.lock_guest_context(); perform pg_sleep(0.2); end $$;' : ''}${statement};commit;`,
    );
  });
const rpc = (statement, identity) => sql(`select ${statement}`, identity).then(JSON.parse);
async function race(calls, label, min, max = min) {
  const results = await Promise.allSettled(calls),
    ok = results.filter((r) => r.status === 'fulfilled');
  assert(ok.length >= min && ok.length <= max, label);
  for (const r of results)
    if (r.status === 'rejected')
      assert(
        ['42501', '40001', '55000', '23505'].includes(r.reason?.sqlstate),
        `${label}: unexpected rejection`,
      );
  console.log(`PASS: ${label}`);
  return ok.map((r) => r.value);
}
const fixture = readFileSync(new URL('../supabase/tests/phase2.test.sql', import.meta.url), 'utf8')
  .split('set local role authenticated;')[0]
  .replace('begin;', '');
await sql(fixture);
await sql(
  `insert into private.customer_enrollment(organization_id) values('${org}');insert into private.guest_policy(organization_id,enabled,creations_per_hour) values('${org}',true,100)`,
);
const pids = await Promise.all([sql('select pg_backend_pid()'), sql('select pg_backend_pid()')]);
assert(new Set(pids).size === 2, 'independent backends');
// Supplemental LOCAL concurrency test, not evidence of public signup/mail delivery.
// Auth trigger creates the profile; no Customer, membership or role is pre-created.
const freshCustomer = randomUUID();
await sql(
  `insert into auth.users(id,email,email_confirmed_at) values('${freshCustomer}','${freshCustomer}@example.invalid',now())`,
);
const onboard = () =>
  sql("select public.onboard_customer('Concurrency customer','+966500000001','en')", {
    actor: freshCustomer,
  });
const enrolled = await Promise.all([onboard(), onboard()]);
assert(enrolled[0] === enrolled[1], 'concurrent onboarding returns one customer');
assert((await onboard()) === enrolled[0], 'subsequent onboarding is idempotent');
for (const table of ['customers', 'organization_memberships', 'user_roles']) {
  assert(
    (await sql(`select count(*) from public.${table} where profile_id='${freshCustomer}'`)) === '1',
    `one canonical onboarding ${table}`,
  );
}
console.log('PASS: independent-connection customer onboarding and retry');
async function journey() {
  const token = `g1_${randomBytes(32).toString('hex')}`;
  const result = await rpc(`public.start_guest_request('SA',${q(token)})`, { token: '' });
  return { ...result, token };
}
async function quote(j) {
  const city = await sql(
    `select id from public.market_cities where organization_id='${org}' order by code limit 1`,
  );
  const location = {
    city_id: city,
    city: 'TEST city',
    district: '',
    address: 'TEST address',
    postal_code: '',
    building: '',
    unit: '',
    notes: '',
    floor: 0,
    elevator: true,
    access_notes: '',
  };
  const payload = {
    service_id: '41000000-0000-4000-8000-000000000001',
    description: 'TEST transport',
    notes: '',
    pickup: location,
    delivery: location,
    items: [{ description: 'TEST box', quantity: 1, notes: '' }],
    additional_service_ids: [],
    preferred_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time_window: 'flexible',
    contact_name: 'TEST guest',
    contact_phone: '+966500000001',
    contact_email: '',
    contact_notes: '',
  };
  await rpc(
    `public.request_command('save','${j.request.id}',0,'${randomUUID()}',${json(payload)})`,
    j,
  );
  await rpc(`public.request_command('submit','${j.request.id}',1,'${randomUUID()}','{}')`, j);
  const mutation = randomUUID(),
    version = randomUUID();
  await sql(
    `select public.calculate_preliminary_price('${j.request.id}',12.5,null,'61000000-0000-4000-8000-000000000001',1,'${mutation}')`,
    { actor: sales },
  );
  const evaluation = await sql(
    `select id from public.pricing_evaluations where mutation_id='${mutation}'`,
  );
  await sql(
    `select public.create_quote_draft('${evaluation}',0,null,172800,'${version}');select public.send_quote('${version}')`,
    { actor: sales },
  );
  return version;
}
const accept = (version, j) =>
  rpc(`public.respond_to_quote('${version}','accept','${randomUUID()}',null)`, j);
const manage = (j, action) =>
  rpc(`public.manage_guest_link('${j.request.id}','${action}')`, { actor: sales });
const replay = await journey();
await race(
  [
    rpc(`public.start_guest_request('SA',${q(replay.token)})`, { token: '' }),
    rpc(`public.start_guest_request('SA',${q(replay.token)})`, { token: '' }),
  ],
  'initial creation replay',
  2,
);
assert(
  (await sql(
    `select count(*) from private.guest_access_grants where request_id='${replay.request.id}'`,
  )) === '1',
  'one creation grant',
);
const version = await quote(replay);
const accepted = await race(
  [accept(version, replay), accept(version, replay)],
  'Quote acceptance replay',
  2,
);
assert(accepted[0].order_id === accepted[1].order_id, 'exactly one Order');
const order = accepted[0].order_id;
const contested = await journey(),
  contestedVersion = await quote(contested);
await race(
  [accept(contestedVersion, contested), manage(contested, 'revoke')],
  'accept versus revoke',
  1,
  2,
);
assert(
  Number(
    await sql(`select count(*) from public.orders where request_id='${contested.request.id}'`),
  ) <= 1,
  'revocation race Order invariant',
);
await assertDenied(() => accept(contestedVersion, contested), 'post-revocation acceptance');
const rotations = await race(
  [manage(replay, 'replace'), manage(replay, 'replace')],
  'concurrent link replacements',
  2,
);
const active = [];
for (const candidate of rotations) {
  try {
    await rpc('public.guest_access_state()', { token: candidate.token });
    active.push(candidate.token);
  } catch (error) {
    assert(error.sqlstate === '42501', 'rotation rejection');
  }
}
assert(active.length === 1, 'only final replacement remains active');
await assertDenied(() => rpc('public.guest_access_state()', replay), 'old capability revoked');
replay.token = active[0];
const draft = await journey();
await race(
  [
    rpc(`public.request_command('cancel','${draft.request.id}',0,'${randomUUID()}','{}')`, draft),
    manage(draft, 'revoke'),
  ],
  'revocation during mutation',
  1,
  2,
);
await assertDenied(
  () =>
    rpc(`public.request_command('cancel','${draft.request.id}',0,'${randomUUID()}','{}')`, draft),
  'revoked mutation denied',
);
await sql(
  `insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by) select organization_id,market_id,currency,'TEST','STAGING TEST ONLY','TEST','TEST ONLY','TEST-ONLY-0000','${sales}' from public.orders where id='${order}'`,
);
const payment = (action, revision, payload, mutation = randomUUID()) =>
  rpc(
    `public.payment_command('${order}',${q(action)},'${mutation}',${revision},${json(payload)})`,
    replay,
  );
await payment('choose', 0, { method: 'BANK_TRANSFER' });
const reserveMutation = randomUUID(),
  file = randomUUID(),
  payload = { fileId: file, mime: 'image/png', size: 100 };
const reservations = await race(
  [
    payment('reserve', 1, payload, reserveMutation),
    payment('reserve', 1, payload, reserveMutation),
  ],
  'proof reservation replay',
  2,
);
assert(reservations[0].attemptId === reservations[1].attemptId, 'one proof reservation');
const reservation = reservations[0];
const upload = () =>
  sql(
    `set local storage.operation='object.upload';insert into storage.objects(bucket_id,name,metadata) values('documents',${q(reservation.path)},'{"size":100,"mimetype":"image/png"}')`,
    replay,
  );
await race([upload(), upload()], 'immutable proof upload retry', 1);
const submitMutation = randomUUID(),
  submission = { attemptId: reservation.attemptId };
await race(
  [
    payment('submit', 2, submission, submitMutation),
    payment('submit', 2, submission, submitMutation),
  ],
  'proof finalization and submission replay',
  2,
);
assert(
  (await sql(
    `select count(*) from public.bank_transfer_attempts where payment_id=(select id from public.payments where order_id='${order}')`,
  )) === '1',
  'one evidence attempt',
);
const stranger = await journey();
await assertDenied(
  () => rpc(`public.payment_details('${order}')`, stranger),
  'cross-customer payment denied',
);
await assertDenied(
  () => rpc(`public.transfer_proof_path('${reservation.attemptId}')`, stranger),
  'cross-customer proof denied',
);
await assertDenied(
  () =>
    rpc(`public.manage_guest_link('${replay.request.id}','replace')`, {
      actor: '11000000-0000-4000-8000-000000000005',
    }),
  'cross-tenant staff denied',
);
console.log(
  'PASS: guest independent-connection matrix; fixtures remain only in disposable local CI database, removed by final Supabase teardown',
);
async function assertDenied(call, label) {
  try {
    await call();
  } catch (error) {
    assert(error.sqlstate === '42501', label);
    console.log(`PASS: ${label}`);
    return;
  }
  throw Error(`Guest concurrency: ${label}`);
}
