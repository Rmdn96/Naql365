// Explicitly destructive to a DISPOSABLE LOCAL test database, never cloud.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const workdir = process.env.NAQL365_LOCAL_SUPABASE_WORKDIR;
assert(
  workdir && process.env.NAQL365_ALLOW_LOCAL_RECONSTRUCTION === '1',
  'Explicit disposable-local reconstruction required',
);
assert(
  !relative(tmpdir(), resolve(workdir)).startsWith('..'),
  'Only an isolated temporary project may be reset',
);
const config = readFileSync(resolve(workdir, 'supabase/config.toml'), 'utf8');
assert(/^project_id\s*=\s*"naql365"\s*$/m.test(config));
const env = { ...process.env };
delete env.SUPABASE_DB_PASSWORD;
delete env.SUPABASE_ACCESS_TOKEN;
const out = resolve(tmpdir(), 'naql365-store-6d-evidence');
mkdirSync(out, { recursive: true });
const sql = (statement) =>
  execFileSync(
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
    {
      input: statement,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    },
  ).trim();
function cli(args, label) {
  const r = spawnSync(
    process.execPath,
    ['node_modules/supabase/dist/supabase.js', ...args, '--workdir', workdir],
    { encoding: 'utf8', env, timeout: 300000, maxBuffer: 32 * 1024 * 1024 },
  );
  writeFileSync(resolve(out, label + '.txt'), (r.stdout || '') + (r.stderr || ''));
  assert.equal(r.status, 0, 'Local CLI failed: ' + label);
}
const hash = (value) => createHash('sha256').update(value).digest('hex');
let baselineAuditIds = [];
function snapshot() {
  const tables = sql(
    "select tablename from pg_tables where schemaname='public' order by tablename",
  ).split('\n');
  const rows = {};
  for (const t of tables) {
    assert(/^[a-z_]+$/.test(t));
    // New permission definitions are explicitly allowed; old rows/grants are not.
    const filter =
      t === 'permissions'
        ? "where code not like 'store.%'"
        : t === 'audit_logs'
          ? `where id=any(array[${baselineAuditIds.map((id) => "'" + id + "'::uuid").join(',')}]::uuid[])`
          : '';
    rows[t] = hash(
      sql(
        `select coalesce(jsonb_agg(x order by x::text),'[]'::jsonb) from (select to_jsonb(r) x from public.${t} r ${filter}) s`,
      ),
    );
  }
  const functions = hash(
    sql(
      "select coalesce(jsonb_agg(pg_get_functiondef(p.oid) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and p.proname not like 'store_%'",
    ),
  );
  const policies = hash(
    sql(
      "select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]') from pg_policies p where tablename not like 'store_%'",
    ),
  );
  return { rows, functions, policies };
}
let before, after;
try {
  cli(['db', 'reset', '--local', '--version', '20261012000100'], 'upgrade-baseline47');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '47');
  const fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
    .split('set local role authenticated;')[0]
    .replace(/^([\s\S]*?)begin;/, '$1');
  sql('begin;' + fixture + ';commit;');
  assert.equal(sql('select count(*) from public.orders'), '1');
  baselineAuditIds = JSON.parse(sql("select coalesce(json_agg(id),'[]') from public.audit_logs"));
  assert(baselineAuditIds.every((id) => /^[0-9a-f-]{36}$/.test(id)));
  before = snapshot();
  const backup = execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_naql365',
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--format=custom',
      '--no-owner',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  assert.equal(backup.subarray(0, 5).toString(), 'PGDMP');
  writeFileSync(resolve(out, 'LOCAL-ONLY-baseline47.dump'), backup);
  cli(['db', 'push', '--local', '--yes'], 'populated-upgrade48');
  after = snapshot();
  assert.deepEqual(
    after,
    before,
    'Transport rows, old permissions, role grants, functions and RLS must not change',
  );
  const idList = baselineAuditIds.map((id) => "'" + id + "'::uuid").join(',');
  assert.equal(
    sql(`select count(*) from public.audit_logs where not(id=any(array[${idList}]::uuid[]))`),
    '7',
    'Only seven expected permission-definition audit inserts',
  );
  assert.equal(
    sql(
      `select count(*) from public.audit_logs a join public.permissions p on p.id=a.entity_id where not(a.id=any(array[${idList}]::uuid[])) and a.entity_type='permissions' and a.action='insert' and a.before_data is null and p.code like 'store.%'`,
    ),
    '7',
    'New audit rows concern only authorized permission definitions',
  );
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '48');
  assert.equal(sql("select count(*) from public.permissions where code like 'store.%'"), '7');
  assert.equal(
    sql(
      "select count(*) from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where p.code like 'store.%'",
    ),
    '0',
  );
  assert.equal(sql('select count(*) from private.store_policy_versions'), '0');
  console.log(
    'Populated local 47→48 upgrade PASS; Transport rows, original grants/functions/RLS unchanged.',
  );
} finally {
  cli(['db', 'reset', '--local'], 'upgrade-cleanup-reconstruction48');
  const clean = sql(
    'select (select count(*) from public.organizations)+(select count(*) from auth.users)+(select count(*) from private.store_policy_versions)+(select count(*) from private.store_command_receipts)',
  );
  assert.equal(clean, '0', 'Disposable-local fixtures independently removed');
  writeFileSync(
    resolve(out, 'populated-upgrade.json'),
    JSON.stringify(
      {
        baseline: '29baff49a143e2ed24856c80cbc08c9b65c3f941',
        before,
        after,
        equal: JSON.stringify(before) === JSON.stringify(after),
        cleanup: 'PASS',
        backup: 'LOCAL archive created; Staging backup/restore NOT attested',
      },
      null,
      2,
    ) + '\n',
  );
}
