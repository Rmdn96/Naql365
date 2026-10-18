// Independent read-only ownership observer; no business/identity/file mutation.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { stagingProject, query } from './supabase.mjs';
delete process.env.SUPABASE_ACCESS_TOKEN;
const directory = process.env.STAGING_WAVE5_RUN_DIR;
if (
  !/^supabase\/\.temp\/wave5-hosted-[a-z0-9-]+$/.test(directory ?? '') &&
  directory !== 'supabase/.temp/wave4-hosted-wave5-business'
)
  throw Error('OWNED_RUN_PATH_REQUIRED');
const ref = stagingProject();
const records = new Map();
const filename = directory + '/independent-entities.json';
if (existsSync(filename)) {
  for (const row of JSON.parse(readFileSync(filename, 'utf8')).entities) {
    if (!/^[a-f0-9-]{36}$/.test(row.id)) throw Error('OWNED_ENTITY_ID_INVALID');
    records.set(row.kind + ':' + row.id, row);
  }
}
let pid;
while (existsSync('supabase/.temp/hosted-verification.lock')) {
  const ledger = readFileSync(directory + '/run-owned.jsonl', 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  pid ??= ledger.find((row) => row.event === 'started')?.pid;
  const lock = JSON.parse(readFileSync('supabase/.temp/hosted-verification.lock', 'utf8'));
  if (lock.pid !== pid) break;
  const users = ledger.filter((row) => row.kind === 'auth').map((row) => row.id);
  if (users.length && users.every((id) => /^[a-f0-9-]{36}$/.test(id))) {
    const ids = users.map((id) => "'" + id + "'").join(',');
    const guestRequests = [];
    if (directory === 'supabase/.temp/wave4-hosted-wave5-business') {
      for (const file of readdirSync('supabase/.temp').filter((name) =>
        /^phase7-[a-f0-9-]+\.jsonl$/.test(name),
      )) {
        const path = 'supabase/.temp/' + file;
        if (statSync(path).mtimeMs < Date.parse(lock.startedAt)) continue;
        for (const line of readFileSync(path, 'utf8').trim().split('\n').filter(Boolean)) {
          const id = JSON.parse(line).requestId;
          if (typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id)) guestRequests.push(id);
        }
      }
    }
    const guests = guestRequests.length
      ? guestRequests.map((id) => "'" + id + "'").join(',')
      : 'NULL';
    const rows = query(
      ref,
      `with c as(select id from public.customers where profile_id in (${ids}) or id in(select customer_id from public.requests where id in (${guests}))),
      r as(select id from public.requests where customer_id in(select id from c)),
      q as(select id from public.quotes where request_id in(select id from r)),
      o as(select id from public.orders where request_id in(select id from r)),
      j as(select id from public.jobs where order_id in(select id from o)),
      t as(select id from public.trips where job_id in(select id from j)),
      resources as(select (result->>'id')::uuid id,intent->>'action' action from private.operational_mutations where actor_id in (${ids}) and intent->>'action' in('create_driver','create_vehicle'))
      select 'customers' kind,id from c union all select 'requests',id from r
      union all select 'quotes',id from q union all select 'quote_versions',id from public.quote_versions where quote_id in(select id from q)
      union all select 'orders',id from o union all select 'jobs',id from j union all select 'trips',id from t
      union all select 'drivers',id from resources where action='create_driver'
      union all select 'vehicles',id from resources where action='create_vehicle'
      union all select 'issues',id from public.issues where trip_id in(select id from t)
      union all select 'trip_pods',id from public.trip_pods where trip_id in(select id from t)
      union all select 'payments',id from public.payments where order_id in(select id from o)
      union all select 'bank_accounts',id from public.bank_accounts where created_by in (${ids})
      union all select 'file_objects',id from public.file_objects where owner_profile_id in (${ids}) or guest_customer_id in(select id from c)`,
    );
    for (const row of rows) {
      if (!/^[a-f0-9-]{36}$/.test(row.id)) throw Error('OWNED_ENTITY_ID_INVALID');
      records.set(row.kind + ':' + row.id, row);
    }
    writeFileSync(
      filename,
      JSON.stringify(
        {
          source: 'independent read-only observer, rooted in run-owned Auth identities',
          entities: [...records.values()],
        },
        null,
        2,
      ) + '\n',
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 15000));
}
const allowed = new Set([
  'customers',
  'requests',
  'quotes',
  'quote_versions',
  'orders',
  'jobs',
  'trips',
  'drivers',
  'vehicles',
  'issues',
  'trip_pods',
  'payments',
  'file_objects',
  'bank_accounts',
]);
const remaining = {};
for (const kind of new Set([...records.values()].map((row) => row.kind))) {
  if (!allowed.has(kind)) throw Error('ENTITY_TABLE_DENIED');
  const ids = [...records.values()]
    .filter((row) => row.kind === kind)
    .map((row) => "'" + row.id + "'")
    .join(',');
  remaining[kind] = query(
    ref,
    `select count(*)::int n from public.${kind} where id in (${ids})`,
  )[0]?.n;
}
const pass = records.size > 0 && Object.values(remaining).every((n) => n === 0);
writeFileSync(
  directory + '/independent-entity-cleanup.json',
  JSON.stringify(
    {
      result: pass ? 'PASS' : 'FAIL',
      observedEntities: records.size,
      remaining,
      verifiedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    independentEntityCleanup: pass ? 'PASS' : 'FAIL',
    observedEntities: records.size,
    remaining,
  }),
);
if (!pass) process.exitCode = 1;
