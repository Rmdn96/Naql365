// Independent LOCAL PostgreSQL connections only; no URLs or cloud credentials.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
const org = '61000000-0000-4000-8000-000000000001';
const market = '64000000-0000-4000-8000-000000000001';
const actor = '62000000-0000-4000-8000-000000000001';
const container = 'supabase_db_naql365';
const evidence = 'test-results/store-catalog-concurrency';
const results = [];
const storeTables = [
  'store_supplier_reference_prices',
  'store_product_media',
  'store_policy_versions',
  'store_suppliers',
  'store_supplier_agreements',
  'store_categories',
  'store_products',
  'store_product_market_listings',
  'store_supplier_offers',
  'store_market_prices',
  'store_events',
  'store_command_receipts',
  // Migration 50 adds restrictive child FKs. Empty children still participate in
  // the LOCAL-only, ownership-checked teardown; do not weaken their constraints.
  'store_checkout_contracts',
  'store_carts',
  'store_orders',
  'store_order_items',
  'store_payments',
  'store_payment_proofs',
  'store_purchase_receipts',
  'store_purchase_events',
  'store_money_operations',
  'store_money_entries',
  'manual_collection_receipts',
];
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const json = (v) => q(JSON.stringify(v)) + '::jsonb';
function connection(name, authenticated = false) {
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
      'postgres',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let output = '',
    errors = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (errors += d));
  const done = new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error('Local PostgreSQL unavailable')));
    child.on('exit', (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(
            Object.assign(new Error('Local catalog SQL failed'), {
              sqlstate: errors.match(/ERROR:\s+(\w{5})/)?.[1],
              safeDetail: errors.replaceAll(/DETAIL:[^\n]*/g, 'DETAIL: [withheld]'),
            }),
          ),
    );
  });
  child.stdin.write(
    `\\set VERBOSITY sqlstate\nset application_name=${q(name)};begin;${authenticated ? `set local role authenticated;set local request.jwt.claim.sub=${q(actor)};` : ''}`,
  );
  return { child, done };
}
function sql(statement, authenticated = false) {
  const c = connection('store-observer-' + randomUUID(), authenticated);
  c.child.stdin.end(statement + ';commit;\n');
  return c.done;
}
function assert(ok, label) {
  if (!ok) throw new Error('Catalog concurrency assertion: ' + label);
}
function command(operation, id, revision, payload, mutation = randomUUID()) {
  return `select public.store_catalog_draft_command_v1(${q(org)},${q(market)},${q(operation)},${q(mutation)},${id ? q(id) : 'null'},${revision ?? 'null'},${json(payload)})`;
}
const mutex = `select pg_advisory_xact_lock(hashtextextended('naql365:store:catalog:v1:${org}',0))`;
async function waitFor(predicate, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Barrier timeout: ' + label);
}
async function race(label, expressions, duringWait) {
  const holderName = 'store-holder-' + randomUUID();
  const holder = connection(holderName);
  holder.child.stdin.write(mutex + ';\n');
  await waitFor(
    async () =>
      (await sql(
        `select exists(select 1 from pg_stat_activity where application_name=${q(holderName)} and state='idle in transaction')`,
      )) === 't',
    'mutex acquired',
  );
  const names = expressions.map(() => 'store-contender-' + randomUUID());
  const calls = expressions.map((expression, i) => {
    const c = connection(names[i], true);
    c.child.stdin.end(expression + ';commit;\n');
    return c.done.then(
      (value) => ({ ok: true, value }),
      (e) => ({ ok: false, sqlstate: e.sqlstate }),
    );
  });
  try {
    await waitFor(
      async () =>
        Number(
          await sql(
            `select count(*) from pg_stat_activity where application_name=any(array[${names.map(q).join(',')}]) and wait_event='advisory'`,
          ),
        ) === calls.length,
      'independent contenders blocked',
    );
    if (duringWait) await duringWait();
  } finally {
    holder.child.stdin.end('commit;\n');
    await holder.done;
  }
  const outcomes = await Promise.all(calls);
  results.push({ label, outcomes: outcomes.map((x) => ({ ok: x.ok, sqlstate: x.sqlstate })) });
  return outcomes;
}
let setup = false;
try {
  const existing = await sql(
    'select ' + storeTables.map((t) => `(select count(*) from private.${t})`).join('+'),
  );
  assert(existing === '0', 'refuse to overwrite any existing Store scope/data');
  const source = readFileSync('supabase/tests/store_catalog.test.sql', 'utf8');
  const prefix = source
    .split('set local role authenticated;')[0]
    .replace(/^([\s\S]*?)begin;/, '$1');
  await sql(prefix);
  setup = true;
  const content = { title_ar: 'اختبار تزامن', title_en: 'Owned concurrency' };
  const mutation = randomUUID();
  let outcomes = await race('CF30 same mutation same intent', [
    command('create_category', null, null, { slug: 'race-shared', content }, mutation),
    command('create_category', null, null, { slug: 'race-shared', content }, mutation),
  ]);
  assert(
    outcomes.every((x) => x.ok),
    'same intent success and replay',
  );
  const parsed = outcomes.map((x) => JSON.parse(x.value));
  assert(
    parsed[0].id === parsed[1].id && parsed.filter((x) => x.replayed).length === 1,
    'one original and one replay',
  );
  assert(
    (await sql(
      `select count(*) from private.store_command_receipts where mutation_id=${q(mutation)}`,
    )) === '1',
    'one committed receipt',
  );
  assert(
    (await sql(
      `select count(*) from private.store_events e join private.store_command_receipts r on r.id=e.command_receipt_id where r.mutation_id=${q(mutation)}`,
    )) === '1',
    'one committed event',
  );
  const id = parsed[0].id;
  outcomes = await race('CF32 stale revision', [
    command('save_category', id, 1, { content }),
    command('save_category', id, 1, { content: { ...content, title_en: 'Another draft' } }),
  ]);
  assert(
    outcomes.filter((x) => x.ok).length === 1 && outcomes.some((x) => x.sqlstate === 'PT409'),
    'one version winner and safe conflict',
  );
  const a = JSON.parse(
    await sql(command('create_category', null, null, { slug: 'cycle-a', content }), true),
  ).id;
  const b = JSON.parse(
    await sql(command('create_category', null, null, { slug: 'cycle-b', content }), true),
  ).id;
  outcomes = await race('CF29 A/B reparent cycle', [
    command('save_category', a, 1, { parent_id: b, content }),
    command('save_category', b, 1, { parent_id: a, content }),
  ]);
  assert(
    outcomes.filter((x) => x.ok).length === 1 && outcomes.some((x) => x.sqlstate === '22023'),
    'cycle prevented under shared mutex',
  );
  const conflicting = randomUUID();
  outcomes = await race('CF31 same mutation different intent', [
    command('create_category', null, null, { slug: 'intent-a', content }, conflicting),
    command('create_category', null, null, { slug: 'intent-b', content }, conflicting),
  ]);
  assert(
    outcomes.filter((x) => x.ok).length === 1 && outcomes.some((x) => x.sqlstate === 'PT409'),
    'different intent conflicts',
  );
  const managedProduct = JSON.parse(
    await sql(
      command('create_product', null, null, {
        sku: 'CATALOG-RACE-31',
        slug: 'catalog-race-31',
        category_id: id,
        content,
      }),
      true,
    ),
  ).id;
  const managedSupplier = JSON.parse(
    await sql(
      'select public.store_sourcing_command_v1(' +
        q(org) +
        ',' +
        q(market) +
        ",'create_supplier'," +
        q(randomUUID()) +
        ',null,null,' +
        json({ reference: 'race-supplier', name: 'Synthetic only' }) +
        ')',
      true,
    ),
  ).id;
  const extension = (action, target, revision, payload, mutation = randomUUID()) =>
    'select public.store_catalog_extension_v1(' +
    q(org) +
    ',' +
    q(market) +
    ',' +
    q(action) +
    ',' +
    q(mutation) +
    ',' +
    q(target) +
    ',' +
    revision +
    ',' +
    json(payload) +
    ')';
  const observation = {
    supplierId: managedSupplier,
    version: 1,
    amountMinor: 5000,
    observedAt: '2026-10-19Z',
    evidenceReference: 'SYNTHETIC local only',
  };
  const referenceMutation = randomUUID();
  outcomes = await race('CM01 reference observation same intent', [
    extension('reference_price', managedProduct, 1, observation, referenceMutation),
    extension('reference_price', managedProduct, 1, observation, referenceMutation),
  ]);
  assert(
    outcomes.every((x) => x.ok),
    'identical observation callers acknowledged',
  );
  assert(
    (await sql('select count(*) from private.store_supplier_reference_prices')) === '1',
    'one observation after concurrent replay',
  );
  outcomes = await race('CM02 unique supplier reference version', [
    extension('reference_price', managedProduct, 1, { ...observation, version: 2 }),
    extension('reference_price', managedProduct, 1, {
      ...observation,
      version: 2,
      amountMinor: 5100,
    }),
  ]);
  assert(
    outcomes.filter((x) => x.ok).length === 1 && outcomes.some((x) => x.sqlstate === '23505'),
    'one observation version winner',
  );
  const managedListing = JSON.parse(
    await sql(command('create_listing', null, null, { product_id: managedProduct }), true),
  ).id;
  outcomes = await race('CM03 concurrent image selection revision', [
    extension('attach_media', managedListing, 1, { media: [] }),
    extension('attach_media', managedListing, 1, { media: [] }),
  ]);
  assert(
    outcomes.filter((x) => x.ok).length === 1 && outcomes.some((x) => x.sqlstate === 'PT409'),
    'one image revision winner',
  );
  outcomes = await race(
    'CF36 revoke membership while waiting',
    [command('create_category', null, null, { slug: 'revoked-never-created', content })],
    async () => {
      await sql(
        `update public.organization_memberships set status='suspended' where organization_id=${q(org)} and profile_id=${q(actor)}`,
      );
    },
  );
  assert(outcomes[0].sqlstate === '42501', 'fresh authorization after wait');
  assert(
    (await sql(
      "select count(*) from private.store_categories where slug='revoked-never-created'",
    )) === '0',
    'revoked command has no resource',
  );
  await sql(
    `update public.organization_memberships set status='active' where organization_id=${q(org)} and profile_id=${q(actor)}`,
  );
  // Committed replay is also reauthorized, including after a mutex wait.
  outcomes = await race(
    'CF36 revoked replay',
    [command('create_category', null, null, { slug: 'race-shared', content }, mutation)],
    async () => {
      await sql(
        `update public.organization_memberships set status='suspended' where organization_id=${q(org)} and profile_id=${q(actor)}`,
      );
    },
  );
  assert(outcomes[0].sqlstate === '42501', 'cached replay denied after role loss');
  await sql(
    `update public.organization_memberships set status='active' where organization_id=${q(org)} and profile_id=${q(actor)}`,
  );
  const deniedMutation = randomUUID();
  outcomes = await race(
    'CF36 effective permission revoked while waiting',
    [
      command(
        'create_category',
        null,
        null,
        { slug: 'permission-never-created', content },
        deniedMutation,
      ),
    ],
    async () => {
      await sql(
        "delete from public.role_permissions where role_id='63000000-0000-4000-8000-000000000001' and permission_id=(select id from public.permissions where code='store.catalog.manage')",
      );
    },
  );
  assert(outcomes[0].sqlstate === '42501', 'effective grant rechecked after lock');
  await sql(
    "insert into public.role_permissions(role_id,permission_id) select '63000000-0000-4000-8000-000000000001',id from public.permissions where code='store.catalog.manage'",
  );
  const call = (family, operation, target, revision, payload) =>
    `select public.${family}(${q(org)},${q(market)},${q(operation)},${q(randomUUID())},${target ? q(target) : 'null'},${revision ?? 'null'},${json(payload)})`;
  const perform = async (family, operation, target, revision, payload) =>
    JSON.parse(await sql(call(family, operation, target, revision, payload), true));
  const draft = 'store_catalog_draft_command_v1',
    publication = 'store_catalog_publication_command_v1',
    sourcing = 'store_sourcing_command_v1',
    policy = 'store_catalog_policy_command_v1';
  const category = (
    await perform(draft, 'create_category', null, null, { slug: 'published-category', content })
  ).id;
  await perform(publication, 'approve_category', category, 1, { parent_revision: null });
  const product = (
    await perform(draft, 'create_product', null, null, {
      sku: 'RACE-1',
      slug: 'race-product',
      category_id: category,
      content,
    })
  ).id;
  const listing = (await perform(draft, 'create_listing', null, null, { product_id: product })).id;
  const policies = [];
  for (const kind of [
    'PUBLICATION_IDENTITY',
    'RETAIL_PRESENTATION',
    'DELIVERY_PRESENTATION',
    'RETURNS_PRESENTATION',
  ]) {
    const id = (
      await perform(policy, 'create_policy', null, null, {
        kind,
        policy_code: kind.toLowerCase(),
        version: 1,
        content: { ...content, body_ar: 'اختبار فقط', body_en: 'Synthetic only' },
        effective_from: '2026-01-01T00:00:00Z',
        evidence_ref: 'LOCAL-NOT-LEGAL',
      })
    ).id;
    await perform(policy, 'approve_policy', id, 1, {});
    policies.push(id);
  }
  const supplier = (
    await perform(sourcing, 'create_supplier', null, null, {
      reference: 'RACE-SOURCE',
      name: 'Owned synthetic',
    })
  ).id;
  const agreement = (
    await perform(sourcing, 'create_agreement', null, null, {
      supplier_id: supplier,
      agreement_code: 'RACE',
      version: 1,
      terms: { reference: 'LOCAL', summary: 'PRIVATE-SYNTHETIC' },
      effective_from: '2026-01-01T00:00:00Z',
      evidence_ref: 'LOCAL',
    })
  ).id;
  await perform(sourcing, 'approve_agreement', agreement, 1, {});
  const offer = (
    await perform(sourcing, 'create_offer', null, null, {
      supplier_id: supplier,
      product_id: product,
      agreement_id: agreement,
      offer_key: 'RACE',
      version: 1,
      unit_cost_minor: 1234,
      effective_from: '2026-01-01T00:00:00Z',
      evidence_ref: 'LOCAL',
    })
  ).id;
  await perform(sourcing, 'approve_offer', offer, 1, {});
  const price = (
    await perform(draft, 'create_price', null, null, {
      listing_id: listing,
      version: 1,
      amount_minor: 5678,
      presentation_policy_id: policies[1],
      effective_from: '2026-01-01T00:00:00Z',
    })
  ).id;
  const publishPayload = {
    product_revision: 1,
    category_revision: 2,
    price_id: price,
    price_revision: 2,
    offer_id: offer,
    offer_revision: 2,
    identity_policy_id: policies[0],
    identity_policy_revision: 2,
    delivery_policy_id: policies[2],
    delivery_policy_revision: 2,
    returns_policy_id: policies[3],
    returns_policy_revision: 2,
  };
  outcomes = await race('CF34 publish versus price approval', [
    call(publication, 'publish_listing', listing, 1, publishPayload),
    call(publication, 'approve_price', price, 1, {}),
  ]);
  assert(
    outcomes[1].ok && (outcomes[0].ok || outcomes[0].sqlstate === 'PT409'),
    'atomic publication or safe version conflict',
  );
  if (!outcomes[0].ok) await perform(publication, 'publish_listing', listing, 1, publishPayload);
  assert(
    (await sql(
      `select amount_minor from private.store_market_prices where id=(select selected_price_id from private.store_product_market_listings where id=${q(listing)})`,
    )) === '5678',
    'third connection observes exact selected price',
  );
  outcomes = await race('CF35 publish versus source revocation', [
    call(publication, 'publish_listing', listing, 2, publishPayload),
    call(sourcing, 'revoke_offer', offer, 2, { reason: 'Owned race' }),
  ]);
  assert(
    outcomes[1].ok && (outcomes[0].ok || outcomes[0].sqlstate === 'PT409'),
    'source revocation serialized',
  );
  const visible = JSON.parse(await sql('select public.store_catalog_public_v1()'));
  assert(
    visible.items.length === 0,
    'new independent public read excludes revoked selected source',
  );
  const committed = JSON.parse(
    await sql(command('create_category', null, null, { slug: 'lost-response', content }), true),
  );
  const receiptCount = await sql('select count(*) from private.store_command_receipts');
  const aborting = connection('store-abort-' + randomUUID(), true);
  aborting.child.stdin.end(
    command('create_category', null, null, { slug: 'aborted-resource', content }) + ';rollback;\n',
  );
  await aborting.done;
  assert(
    (await sql('select count(*) from private.store_command_receipts')) === receiptCount &&
      (await sql("select count(*) from private.store_categories where slug='aborted-resource'")) ===
        '0',
    'CF33 rollback removes resource/event/receipt atomically',
  );
  assert(committed.revision === 1, 'committed create acknowledged independently');
  results.push({ label: 'CF33 transaction abort', result: 'PASS' });
  assert(
    (await sql('select count(*) from private.store_events')) ===
      (await sql('select count(*) from private.store_command_receipts')),
    'third connection observes complete receipt/event pairs',
  );
  console.log(
    'Store catalog scenarios PASS: ' +
      results.length +
      '; independent barrier races: ' +
      results.filter((r) => r.outcomes).length +
      '; rollback scenario: 1',
  );
} finally {
  if (setup) {
    // Disposable LOCAL database only. Refuse cleanup if unrelated Store records exist.
    const fixtureOnly = await sql(
      'select ' +
        storeTables
          .map((t) => `not exists(select 1 from private.${t} where organization_id<>${q(org)})`)
          .join(' and '),
    );
    assert(fixtureOnly === 't', 'cleanup ownership guard');
    await sql(`truncate ${storeTables.map((t) => 'private.' + t).join(',')};
      drop function public.store_test_error(text,text,text,text);drop function public.store_test_check(text,boolean,text);drop table public.store_test_results;
      delete from public.user_roles where profile_id::text like '62000000%';
      delete from public.role_permissions where role_id::text like '63000000%';delete from public.roles where id::text like '63000000%';
      delete from public.organization_memberships where profile_id::text like '62000000%';
      delete from auth.users where id::text like '62000000%';
      delete from public.markets where organization_id::text like '61000000%';
      delete from public.audit_logs where organization_id::text like '61000000%';
      delete from public.organizations where id::text like '61000000%';`);
    const clean = await sql(
      'select ' +
        storeTables.map((t) => `(select count(*) from private.${t})`).join('+') +
        "+(select count(*) from auth.users where id::text like '62000000%')+(select count(*) from public.profiles where id::text like '62000000%')+(select count(*) from public.roles where id::text like '63000000%')+(select count(*) from public.organization_memberships where profile_id::text like '62000000%')+(select count(*) from public.organizations where id::text like '61000000%')",
    );
    assert(clean === '0', 'independent cleanup verification');
    results.push({
      label: 'CF42 cleanup independently verified',
      result: 'PASS',
      credentials: 'none created; local Docker PostgreSQL only',
    });
  }
  mkdirSync(evidence, { recursive: true });
  writeFileSync(
    evidence + '/result.json',
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        sourceMode: 'local worktree; migration hash is the tested artifact identity',
        migrationSha256: createHash('sha256')
          .update(readFileSync('supabase/migrations/20261018000100_store_catalog_foundation.sql'))
          .digest('hex'),
        head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
