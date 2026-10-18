// Synthetic, isolated PostgreSQL recovery drill. Never connects to a cloud database.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import assert from 'node:assert/strict';

assert.equal(process.platform, 'win32', 'Windows DPAPI encryption required');
assert.equal(process.env.NAQL365_SYNTHETIC_RECOVERY, '1', 'Explicit synthetic drill required');
const root = process.cwd();
const vault = resolve(
  process.env.LOCALAPPDATA,
  'Naql365Recovery',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
assert(relative(root, vault).startsWith('..'), 'Backup vault must be outside repository');
mkdirSync(vault, { recursive: true });
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,"FullControl","ContainerInherit,ObjectInherit","None","Allow"); $acl.AddAccessRule($rule); [IO.Directory]::SetAccessControl($env:NAQL365_RECOVERY_VAULT,$acl)',
  ],
  { env: { ...process.env, NAQL365_RECOVERY_VAULT: vault }, stdio: ['ignore', 'pipe', 'pipe'] },
);
const output = resolve(root, 'test-results/store-6d-1c');
mkdirSync(output, { recursive: true });
const run = randomBytes(5).toString('hex');
const names = ['source', 'restore'].map((kind) => `naql365-recovery-${kind}-${run}`);
const password = randomBytes(32).toString('hex');
const env = { ...process.env, POSTGRES_PASSWORD: password, PGPASSWORD: password };
const image = 'postgres:17';
const owned = [];
const evidence = {
  syntheticOnly: true,
  source: '96eb4e9047025b4cb9065e00435e6ac167063b24',
  image,
  network: 'none',
  publishedPorts: 0,
  cloudSql: false,
  migration48Applied: false,
  vault,
  startedAt: new Date().toISOString(),
};
function docker(args, input) {
  const result = spawnSync('docker', args, {
    env,
    input,
    encoding: input instanceof Buffer ? undefined : 'utf8',
    timeout: 120000,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0)
    throw new Error(
      'Local Docker operation failed: ' + args.slice(0, 2).join(' ') + '; details withheld',
    );
  return result.stdout;
}
function sql(name, query) {
  return docker(
    [
      'exec',
      '-i',
      '--env',
      'PGPASSWORD',
      name,
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
    query,
  ).trim();
}
const hash = (v) => createHash('sha256').update(v).digest('hex');
function protect(key, unprotect = false) {
  return execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${unprotect ? 'Unprotect' : 'Protect'}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`,
    ],
    { input: key.toString('base64'), stdio: ['pipe', 'pipe', 'pipe'] },
  ).toString();
}
function encrypt(bytes, label) {
  const key = randomBytes(32),
    iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const wrapped = Buffer.from(protect(key), 'base64');
  writeFileSync(
    resolve(vault, label + '.aesgcm'),
    Buffer.concat([Buffer.from('N365REC1'), iv, cipher.getAuthTag(), encrypted]),
  );
  writeFileSync(resolve(vault, label + '.key.dpapi'), wrapped);
  key.fill(0);
  const stored = readFileSync(resolve(vault, label + '.aesgcm'));
  const recoveredKey = Buffer.from(protect(wrapped, true), 'base64');
  const decrypt = createDecipheriv('aes-256-gcm', recoveredKey, stored.subarray(8, 20));
  decrypt.setAuthTag(stored.subarray(20, 36));
  const restored = Buffer.concat([decrypt.update(stored.subarray(36)), decrypt.final()]);
  recoveredKey.fill(0);
  assert.equal(hash(restored), hash(bytes), 'Encrypted archive roundtrip mismatch');
  const corrupt = Buffer.from(stored);
  corrupt[corrupt.length - 1] ^= 1;
  const testKey = Buffer.from(protect(wrapped, true), 'base64');
  const reject = createDecipheriv('aes-256-gcm', testKey, corrupt.subarray(8, 20));
  reject.setAuthTag(corrupt.subarray(20, 36));
  assert.throws(() => {
    reject.update(corrupt.subarray(36));
    reject.final();
  });
  testKey.fill(0);
  return {
    bytes: restored,
    sha256: hash(bytes),
    encryptedSha256: hash(stored),
    encryptedBytes: stored.length,
    tamperDenied: true,
  };
}
function snapshot(name) {
  const schemas = "('public','private','auth','storage','supabase_migrations')";
  const tables = JSON.parse(
    sql(
      name,
      `select coalesce(json_agg(x order by schemaname,tablename),'[]') from (select schemaname,tablename from pg_tables where schemaname in ${schemas}) x`,
    ),
  );
  const rowQueries = [];
  for (const t of tables) {
    assert(/^[a-z_]+$/.test(t.schemaname) && /^[a-z_]+$/.test(t.tablename));
    rowQueries.push(
      `select '${t.schemaname}.${t.tablename}' as key,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') as value from ${t.schemaname}.${t.tablename} r`,
    );
  }
  const rows = JSON.parse(
    sql(name, 'select jsonb_object_agg(key,value) from (' + rowQueries.join(' union all ') + ') q'),
  );
  const metadata = sql(
    name,
    `select jsonb_build_object(
    'columns',(select jsonb_agg(to_jsonb(x) order by table_schema,table_name,ordinal_position) from (select table_schema,table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_schema,udt_name from information_schema.columns where table_schema in ${schemas}) x),
    'constraints',(select jsonb_agg(x order by x::text) from (select jsonb_build_array(n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid)) x from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas}) q),
    'indexes',(select jsonb_agg(to_jsonb(x) order by schemaname,tablename,indexname) from pg_indexes x where schemaname in ${schemas}),
    'rls',(select jsonb_agg(to_jsonb(x) order by schemaname,tablename,policyname) from pg_policies x where schemaname in ${schemas}),
    'tableSecurity',(select jsonb_agg(x order by x::text) from (select jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,coalesce(c.relacl,acldefault('r',c.relowner))::text) x from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} and c.relkind='r') q),
    'functions',(select jsonb_agg(x order by x::text) from (select jsonb_build_array(n.nspname,p.proname,pg_get_functiondef(p.oid),p.proacl::text,pg_get_userbyid(p.proowner)) x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${schemas} and p.prokind='f') q),
    'roles',(select jsonb_agg(to_jsonb(x) order by rolname) from (select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname not like 'pg_%') x),
    'roleMembership',(select jsonb_agg(x order by x::text) from (select jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),admin_option) x from pg_auth_members) q))`,
  );
  const detail = JSON.parse(metadata);
  writeFileSync(
    resolve(
      output,
      name.includes('-source-')
        ? 'synthetic-before-raw-metadata.json'
        : 'synthetic-after-raw-metadata.json',
    ),
    JSON.stringify(detail, null, 2),
  );
  // Logical dumps preserve column order, not attnum gaps left by dropped columns.
  const positions = new Map();
  for (const column of detail.columns) {
    const table = column.table_schema + '.' + column.table_name;
    const next = (positions.get(table) ?? 0) + 1;
    positions.set(table, next);
    column.ordinal_position = next;
  }
  // One legacy pure conjunction is flattened by PostgreSQL's dump/reparse cycle.
  // Accept only the reviewed latitude/longitude/accuracy bounds, never arbitrary SQL.
  const expectedBounds =
    "CHECKlatitude>='-90'::integer::numericANDlatitude<=90::numericANDlongitude>='-180'::integer::numericANDlongitude<=180::numericANDaccuracy_m>=0::numericANDaccuracy_m<=1000::numeric";
  for (const constraint of detail.constraints)
    if (
      constraint[0] === 'public' &&
      constraint[1] === 'trip_live_locations' &&
      constraint[2] === 'trip_live_locations_check'
    ) {
      const flat = constraint[3].replace(/[()\s]/g, '');
      assert.equal(flat, expectedBounds, 'Unexpected location constraint expression');
      constraint[3] = flat;
    }
  // PostgreSQL ACL arrays are unordered privilege sets; pg_dump may reorder entries.
  for (const entry of detail.tableSecurity ?? [])
    if (entry[4]) entry[4] = entry[4].slice(1, -1).split(',').sort();
  for (const entry of detail.functions ?? [])
    if (entry[3]) entry[3] = entry[3].slice(1, -1).split(',').sort();
  writeFileSync(
    resolve(
      output,
      name.includes('-source-')
        ? 'synthetic-before-metadata.json'
        : 'synthetic-after-metadata.json',
    ),
    JSON.stringify(detail, null, 2),
  );
  return {
    rows,
    metadata: hash(JSON.stringify(detail)),
    metadataParts: Object.fromEntries(
      Object.entries(detail).map(([key, value]) => [key, hash(JSON.stringify(value))]),
    ),
    migrationCount: Number(sql(name, 'select count(*) from supabase_migrations.schema_migrations')),
    orderCount: Number(sql(name, 'select count(*) from public.orders')),
  };
}
try {
  evidence.disk = JSON.parse(
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-Volume -DriveLetter C | Select-Object SizeRemaining,Size | ConvertTo-Json',
      ],
      { encoding: 'utf8' },
    ),
  );
  assert(
    evidence.disk.SizeRemaining > 5 * 1024 ** 3,
    'Require 5 GiB free for bounded synthetic drill',
  );
  for (const name of names) {
    docker([
      'run',
      '--pull=never',
      '-d',
      '--network',
      'none',
      '--label',
      'naql365.recovery.run=' + run,
      '--env',
      'POSTGRES_PASSWORD',
      '--env',
      'POSTGRES_INITDB_ARGS=--auth-local=scram-sha-256 --auth-host=scram-sha-256',
      '--name',
      name,
      image,
    ]);
    owned.push(name);
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const r = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], {
        stdio: 'ignore',
      });
      if (r.status === 0) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    assert(ready, 'Isolated local database not ready');
  }
  const helper = readFileSync('tests/helpers/database.mjs', 'utf8');
  const bootstrap = helper
    .match(/await db\.exec\(`([\s\S]*?)`\);/)[1]
    .replace(
      'create role authenticated nologin;',
      'create role authenticated nologin; create role service_role nologin;',
    );
  sql(
    names[0],
    bootstrap +
      '\ncreate schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);',
  );
  const files = readdirSync('supabase/migrations')
    .filter((n) => n.endsWith('.sql') && n < '20261018000100')
    .sort();
  assert.equal(files.length, 47);
  for (const file of files) {
    const escaped = file.slice(15, -4).replaceAll("'", "''");
    sql(
      names[0],
      'begin;\n' +
        readFileSync('supabase/migrations/' + file, 'utf8') +
        `\ninsert into supabase_migrations.schema_migrations(version,name) values('${file.split('_')[0]}','${escaped}');commit;`,
    );
  }
  const fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
    .split('set local role authenticated;')[0]
    .replace(/^([\s\S]*?)begin;/, '$1');
  sql(names[0], 'begin;' + fixture + ';commit;');
  evidence.before = snapshot(names[0]);
  assert.equal(evidence.before.orderCount, 1);
  evidence.recoveryPoint = new Date().toISOString();
  const dumpStart = performance.now();
  const dump = docker(
    [
      'exec',
      '--env',
      'PGPASSWORD',
      names[0],
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--format=custom',
    ],
    Buffer.alloc(0),
  );
  const roles = docker([
    'exec',
    '--env',
    'PGPASSWORD',
    names[0],
    'pg_dumpall',
    '-U',
    'postgres',
    '--roles-only',
    '--no-role-passwords',
  ]);
  evidence.dumpSeconds = (performance.now() - dumpStart) / 1000;
  assert.equal(dump.subarray(0, 5).toString(), 'PGDMP');
  const archive = encrypt(dump, 'SYNTHETIC-baseline47');
  const roleArchive = encrypt(Buffer.from(roles), 'SYNTHETIC-roles');
  evidence.archive = {
    sha256: archive.sha256,
    encryptedSha256: archive.encryptedSha256,
    encryptedBytes: archive.encryptedBytes,
    tamperDenied: archive.tamperDenied,
  };
  const restoreStart = performance.now();
  sql(names[1], roleArchive.bytes.toString().replace(/^CREATE ROLE postgres;\r?\n/m, ''));
  docker(
    [
      'exec',
      '-i',
      '--env',
      'PGPASSWORD',
      names[1],
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '--exit-on-error',
      '--single-transaction',
    ],
    archive.bytes,
  );
  evidence.restoreSeconds = (performance.now() - restoreStart) / 1000;
  const verifyStart = performance.now();
  evidence.after = snapshot(names[1]);
  assert.deepEqual(
    evidence.after,
    evidence.before,
    'Restored schema/data/ACL/role/ledger mismatch',
  );
  const scope =
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relname like 'store_%'";
  assert.equal(sql(names[1], scope), '0');
  assert.equal(sql(names[1], "select has_table_privilege('anon','public.orders','SELECT')"), 'f');
  assert.equal(
    sql(
      names[1],
      'begin; set local role authenticated; select count(*) from public.orders; rollback;',
    ),
    '0',
  );
  evidence.verifySeconds = (performance.now() - verifyStart) / 1000;
  evidence.status = 'PASS';
  evidence.scope =
    'Synthetic application database recovery with auth/storage compatibility stubs; NOT full Supabase platform or live Staging recovery';
  dump.fill(0);
  archive.bytes.fill(0);
  roleArchive.bytes.fill(0);
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  evidence.cleanup = [];
  for (const name of owned) {
    const label = docker([
      'inspect',
      '--format',
      '{{index .Config.Labels "naql365.recovery.run"}}',
      name,
    ]).trim();
    assert.equal(label, run, 'Refuse cleanup of unowned container');
    docker(['rm', '-f', '-v', name]);
    const remaining = spawnSync('docker', ['inspect', name], { stdio: 'ignore' });
    evidence.cleanup.push({ name, absent: remaining.status !== 0 });
  }
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(
    resolve(output, 'synthetic-recovery.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(JSON.stringify(evidence, null, 2));
}
