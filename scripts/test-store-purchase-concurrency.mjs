// Disposable LOCAL PostgreSQL database. No URLs, cloud credentials or exposed ports.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const container = 'supabase_db_naql365';
const database = 'naql_store_race_' + randomUUID().replaceAll('-', '');
assert.match(database, /^naql_store_race_[a-f0-9]{32}$/);
const customer = '92000000-0000-4000-8000-000000000001',
  staff = '92000000-0000-4000-8000-000000000002';
const listing = '98000000-0000-4000-8000-000000000003';
const q = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => q(JSON.stringify(value)) + '::jsonb';
const results = [];
function sql(statement, actor, hold = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        container,
        'psql',
        '-X',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        database,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '',
      errors = '';
    child.stdout.on('data', (b) => (output += b));
    child.stderr.on('data', (b) => (errors += b));
    child.on('error', () => reject(Error('Local PostgreSQL unavailable')));
    child.on('close', (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(
            Object.assign(Error('Local SQL rejected'), {
              code: errors.match(/ERROR:\s+(\w{5})/)?.[1],
            }),
          ),
    );
    child.stdin.end(
      `\\set VERBOSITY sqlstate\nbegin;set local statement_timeout='30s';${actor ? `set local role authenticated;set local request.jwt.claim.sub=${q(actor)};` : ''}${statement};${hold ? 'select pg_sleep(0.2);' : ''}commit;`,
    );
  });
}
const command = (
  action,
  revision,
  target,
  payload = {},
  actor = customer,
  mutation = randomUUID(),
) =>
  sql(
    `select public.store_purchase_command_v1('EG',${q(action)},${q(mutation)},${revision},${target ? q(target) : 'null'},${json(payload)})`,
    actor,
    true,
  ).then(JSON.parse);
const payload = (method) => ({
  contractId: '99000000-0000-4000-8000-000000000001',
  contractRevision: 1,
  address: { name: 'SYNTHETIC', phone: 'SYNTHETIC', region: 'SYNTHETIC-REGION', line: 'SYNTHETIC' },
  method,
  ...(method === 'CASH' ? {} : { destinationId: '99000000-0000-4000-8000-000000000002' }),
});
async function cart() {
  const r = JSON.parse(await sql("select public.store_purchase_read_v1('EG','cart')", customer));
  return command('cart', r.revision, null, {
    items: [{ listingId: listing, revision: 2, quantity: 1 }],
  });
}
async function transfer() {
  const c = await cart(),
    o = await command('checkout', c.revision, null, payload('VODAFONE_CASH'));
  const proof = randomUUID();
  const r = await command('reserve_proof', o.revision, o.id, {
    fileId: proof,
    mime: 'image/png',
    size: 100,
    sha256: 'a'.repeat(64),
  });
  await sql(
    `set local role authenticated;set local request.jwt.claim.sub=${q(customer)};set local storage.operation='object.upload';insert into storage.objects(bucket_id,name,metadata) values('store-proofs',${q(r.path)},'{"size":100,"mimetype":"image/png"}')`,
  );
  return command('submit_proof', r.revision, o.id, {
    proofId: proof,
    customerReference: 'SYNTHETIC-UNVERIFIED',
  });
}
async function race(calls, expected, label) {
  const r = await Promise.allSettled(calls),
    passed = r.filter((x) => x.status === 'fulfilled');
  assert.equal(passed.length, expected, label);
  for (const x of r.filter((x) => x.status === 'rejected'))
    assert(['PT409', '23505', '42501'].includes(x.reason.code), label + ' rejects safely');
  results.push({ label, result: 'PASS' });
  console.log('PASS: ' + label);
  return passed.map((x) => x.value);
}
let created = false;
try {
  execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', database], {
    stdio: 'pipe',
  });
  created = true;
  const helper = readFileSync('tests/helpers/database.mjs', 'utf8');
  const bootstrap = helper
    .split('await db.exec(`')[1]
    .split('`);')[0]
    .replace(/create role (anon|authenticated) nologin;/g, '');
  await sql(bootstrap);
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await sql(readFileSync('supabase/migrations/' + file, 'utf8'));
  const fixture = readFileSync('supabase/tests/store_purchase.test.sql', 'utf8')
    .split('-- FIXTURE END.')[0]
    .replace('begin;', '');
  await sql(fixture);
  let c = await cart(),
    mutation = randomUUID();
  const same = await race(
    [
      command('checkout', c.revision, null, payload('CASH'), customer, mutation),
      command('checkout', c.revision, null, payload('CASH'), customer, mutation),
    ],
    2,
    'identical checkout replays exactly one Store Order',
  );
  assert.equal(same[0].id, same[1].id);
  c = await cart();
  await race(
    [
      command('checkout', c.revision, null, payload('CASH')),
      command('checkout', c.revision, null, payload('CASH')),
    ],
    1,
    'different mutation IDs cannot duplicate one cart revision',
  );
  const a = await transfer(),
    b = await transfer();
  const evidence = {
    reference: 'SYNTHETIC-SHARED-RECEIPT',
    evidenceReference: 'SYNTHETIC-VERIFIED',
  };
  await race(
    [
      command('confirm_transfer', a.revision, a.id, evidence, staff),
      command('confirm_transfer', b.revision, b.id, evidence, staff),
    ],
    1,
    'one external receipt cannot fund two Store payments',
  );
  assert.equal(
    await sql(
      "select count(*) from private.manual_collection_receipts where external_identity='SYNTHETICSHAREDRECEIPT'",
    ),
    '1',
  );
  assert.equal(
    await sql("select count(*) from private.store_payments where status='VERIFIED'"),
    '1',
  );

  // Real Transport payment command, independent tenant/lock, SAME shared registry.
  const transportOrg = '23000000-0000-4000-8000-000000000001',
    transportCustomer = '13000000-0000-4000-8000-000000000002',
    finance = '13000000-0000-4000-8000-000000000006',
    transportOrder = '83000000-0000-4000-8000-000000000001';
  const transportFixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
    .split('set local role authenticated;')[0]
    .replace('begin;', '')
    .replaceAll("'SA'", "'EG'")
    .replaceAll("'SAR'", "'EGP'");
  await sql(transportFixture);
  await sql(
    `insert into auth.users(id,email) values(${q(finance)},'synthetic-finance@example.invalid');insert into public.organization_memberships(organization_id,profile_id,member_type) values(${q(transportOrg)},${q(finance)},'staff');insert into public.user_roles(organization_id,profile_id,role_id) select ${q(transportOrg)},${q(finance)},id from public.roles where code='FINANCE';insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,destination_type,created_by) select ${q(transportOrg)},id,'EGP','اختبار','SYNTHETIC','اختبار','SYNTHETIC','TEST-ONLY-0000','VODAFONE_CASH',${q(finance)} from public.markets where organization_id=${q(transportOrg)}`,
  );
  const transport = (action, revision, data, actor = transportCustomer) =>
    sql(
      `select public.payment_command(${q(transportOrder)},${q(action)},${q(randomUUID())},${revision},${json(data)})`,
      actor,
      true,
    ).then(JSON.parse);
  const currentRevision = Number(
    await sql(`select revision from public.payments where order_id=${q(transportOrder)}`),
  );
  const chosen = await transport('choose', currentRevision, { method: 'BANK_TRANSFER' });
  const reserved = await transport('reserve', chosen.revision, {
    fileId: randomUUID(),
    mime: 'image/png',
    size: 100,
  });
  await sql(
    `set local role authenticated;set local request.jwt.claim.sub=${q(transportCustomer)};set local storage.operation='object.upload';insert into storage.objects(bucket_id,name,metadata) values('documents',${q(reserved.path)},'{"size":100,"mimetype":"image/png"}')`,
  );
  const submitted = await transport('submit', reserved.revision, { attemptId: reserved.attemptId });
  const store = await transfer();
  await race(
    [
      command(
        'confirm_transfer',
        store.revision,
        store.id,
        { reference: 'SYNTHETIC-CROSS-DOMAIN', evidenceReference: 'SYNTHETIC' },
        staff,
      ),
      transport(
        'confirm_transfer',
        submitted.revision,
        {
          reference: 'SYNTHETIC-CROSS-DOMAIN',
          attemptId: reserved.attemptId,
          amountMinor: Number(
            await sql(
              `select amount_minor from public.payments where order_id=${q(transportOrder)}`,
            ),
          ),
          currency: 'EGP',
        },
        finance,
      ),
    ],
    1,
    'Transport and Store cannot credit the same external receipt concurrently',
  );
  assert.equal(
    await sql(
      "select count(*) from private.manual_collection_receipts where external_identity='SYNTHETICCROSSDOMAIN'",
    ),
    '1',
  );
  const loser = await sql(
    "select count(*) from private.store_payments where status='UNDER_REVIEW'",
  );
  assert(Number(loser) >= 1, 'losing Store claims retain pending payment state');
  // Explicit role loss before a new mutation is always denied, including prior replay.
  await sql(`delete from public.user_roles where profile_id=${q(staff)}`);
  await assert.rejects(command('accept', 1, same[0].id, {}, staff), (e) => e.code === '42501');
  results.push({ label: 'revoked Store staff grant denied', result: 'PASS' });
} finally {
  if (created) {
    execFileSync('docker', ['exec', container, 'dropdb', '-U', 'postgres', '--force', database], {
      stdio: 'pipe',
    });
    const remaining = execFileSync(
      'docker',
      [
        'exec',
        container,
        'psql',
        '-X',
        '-qAt',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-c',
        `select count(*) from pg_database where datname=${q(database)}`,
      ],
      { encoding: 'utf8' },
    ).trim();
    assert.equal(remaining, '0', 'independent disposable-database disposal verification');
  }
  mkdirSync('test-results/store-purchase-concurrency', { recursive: true });
  writeFileSync(
    'test-results/store-purchase-concurrency/result.json',
    JSON.stringify(
      {
        sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        migrationSha256: createHash('sha256')
          .update(readFileSync('supabase/migrations/20261019000100_store_purchase_fulfillment.sql'))
          .digest('hex'),
        results,
        cleanup: created ? 'disposable database independently verified absent' : 'not provisioned',
        credentials: 'none generated; Docker-local socket only',
      },
      null,
      2,
    ),
  );
}
