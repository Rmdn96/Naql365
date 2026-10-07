// Ephemeral LOCAL Supabase only. Each call spawns an independent psql connection.
// Do not emit SQL, headers, capabilities, database output or credentials on failure.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const assert = (condition, label) => {
  if (!condition) throw Error(`Guest concurrency: ${label}`);
};
const q = (value) => "'" + String(value).replaceAll("'", "''") + "'";
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
const org = '21900000-0000-4000-8000-000000000001',
  sales = '11900000-0000-4000-8000-000000000001';
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
        ['42501', '40001', '55000', '23505', '22023'].includes(r.reason?.sqlstate),
        `${label}: unexpected rejection`,
      );
  console.log(`PASS: ${label}`);
  return ok.map((r) => r.value);
}

let fixture = readFileSync(new URL('../supabase/tests/phase2.test.sql', import.meta.url), 'utf8')
  .split('set local role authenticated;')[0]
  .replace('begin;', '')
  .replaceAll('phase2_assert', 'manual_phase2_assert')
  .replaceAll('N365-202609-900', 'N365-202609-990')
  .replaceAll('@example.invalid', '@manual-race.invalid');
for (const [a, b] of [
  ['21000000', '21900000'],
  ['11000000', '11900000'],
  ['31000000', '31900000'],
  ['41000000', '41900000'],
  ['42000000', '42900000'],
  ['51000000', '51900000'],
  ['61000000', '61900000'],
])
  fixture = fixture.replaceAll(a, b);
await sql(fixture);
await sql(
  `update public.pricing_settings set pricing_mode='MANUAL' where organization_id='${org}'`,
);
const request = '51900000-0000-4000-8000-000000000001';
const draft = (mutation, amount = 12345, revision = 2) =>
  rpc(
    `public.create_manual_quote_draft('${request}',${revision},${amount},12.5,'TEST verified',172800,'${mutation}')`,
    { actor: sales },
  );
const key = randomUUID();
const results = await race(
  [draft(key), draft(key)],
  'duplicate manual draft across independent connections',
  2,
);
assert(
  results.every((r) => r.id === key),
  'same draft replay',
);
assert(
  (await sql(`select count(*) from public.pricing_evaluations where organization_id='${org}'`)) ===
    '0',
  'no fabricated evaluation',
);
const conflict = randomUUID();
await race(
  [draft(conflict, 10000), draft(conflict, 20000)],
  'conflicting mutation payload admits one result',
  1,
);
await race(
  [
    rpc(`public.send_quote('${conflict}')`, { actor: sales }),
    rpc(`public.send_quote('${conflict}')`, { actor: sales }),
  ],
  'duplicate send',
  2,
);
const customer = { actor: '11900000-0000-4000-8000-000000000002' };
const orders = await race(
  [
    rpc(`public.respond_to_quote('${conflict}','accept','manual-race-a',null)`, customer),
    rpc(`public.respond_to_quote('${conflict}','accept','manual-race-b',null)`, customer),
  ],
  'duplicate acceptance preserves exactly one order',
  2,
);
assert(orders[0].order_id === orders[1].order_id, 'same accepted Order');
assert(
  (await sql(`select count(*) from public.orders where request_id='${request}'`)) === '1',
  'one Order',
);
const denied = await Promise.allSettled([
  draft(randomUUID(), 10, 999),
  rpc(`public.create_manual_quote_draft('${request}',2,1,1,null,100,'${randomUUID()}')`, customer),
]);
assert(
  denied.every((r) => r.status === 'rejected'),
  'stale and unauthorized commands denied',
);

const revisionRequest = '51900000-0000-4000-8000-000000000002';
const revisionQuote = randomUUID();
await race(
  [
    rpc(
      `public.create_manual_quote_draft('${revisionRequest}',1,10000,1,null,1000,'${revisionQuote}')`,
      { actor: sales },
    ),
    sql(`update public.requests set revision=revision+1 where id='${revisionRequest}'`),
  ],
  'request revision versus manual draft',
  1,
  2,
);
if ((await sql(`select count(*) from public.quote_versions where id='${revisionQuote}'`)) === '1') {
  const stale = await Promise.allSettled([
    rpc(`public.send_quote('${revisionQuote}')`, { actor: sales }),
  ]);
  assert(stale[0].status === 'rejected', 'stale draft cannot be sent');
}
const modeRequest = '51900000-0000-4000-8000-000000000003',
  modeQuote = randomUUID();
await race(
  [
    rpc(`public.create_manual_quote_draft('${modeRequest}',1,10000,1,null,1000,'${modeQuote}')`, {
      actor: sales,
    }),
    sql(
      `update public.pricing_settings set pricing_mode='AUTOMATED' where organization_id='${org}'`,
    ),
  ],
  'pricing configuration versus manual draft',
  1,
  2,
);
if ((await sql(`select count(*) from public.quote_versions where id='${modeQuote}'`)) === '1') {
  const changed = await Promise.allSettled([
    rpc(`public.send_quote('${modeQuote}')`, { actor: sales }),
  ]);
  assert(changed[0].status === 'rejected', 'changed mode draft cannot be sent');
}
console.log(
  'PASS: manual pricing independent-connection checks; local disposable database only, removed by final CI teardown',
);
