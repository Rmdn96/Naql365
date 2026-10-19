import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
let db: Awaited<ReturnType<typeof foundationDatabase>>;
const org = '91000000-0000-4000-8000-000000000001';
const market = '95000000-0000-4000-8000-000000000001';
const customer = '92000000-0000-4000-8000-000000000001';
const staff = '92000000-0000-4000-8000-000000000002';
const listing = '98000000-0000-4000-8000-000000000003';
const contract = '99000000-0000-4000-8000-000000000001';
const address = {
  name: 'SYNTHETIC',
  phone: 'SYNTHETIC',
  region: 'SYNTHETIC-REGION',
  line: 'Synthetic only',
};
async function actor(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function command(
  action: string,
  revision: number,
  target: string | null,
  payload: Record<string, unknown> = {},
  mutation = randomUUID(),
) {
  return (
    await db.query<{ r: Record<string, unknown> }>(
      'select public.store_purchase_command_v1($1,$2,$3,$4,$5,$6) r',
      ['EG', action, mutation, revision, target, JSON.stringify(payload)],
    )
  ).rows[0]!.r;
}
async function cart() {
  await actor(customer);
  const state = (
    await db.query<{ r: { revision: number } }>(
      "select public.store_purchase_read_v1('EG','cart') r",
    )
  ).rows[0]!.r;
  return command('cart', state.revision, null, {
    items: [{ listingId: listing, revision: 2, quantity: 1 }],
  });
}
beforeAll(async () => {
  db = await foundationDatabase();
  await db.exec(
    readFileSync('supabase/tests/store_purchase.test.sql', 'utf8').split('-- FIXTURE END.')[0]! +
      '\ncommit;',
  );
});
afterAll(async () => {
  await db?.close();
});

it('denies other tenant, Driver, unauthenticated identity, suspended membership and ambiguous organization context', async () => {
  for (const id of [
    '92000000-0000-4000-8000-000000000005',
    '92000000-0000-4000-8000-000000000006',
    '',
  ]) {
    await actor(id);
    await expect(command('cart', 0, null, { items: [] })).rejects.toMatchObject({ code: '42501' });
  }
  await db.exec(
    `reset role;begin;update public.organization_memberships set status='suspended' where profile_id='${customer}'`,
  );
  await actor(customer);
  await expect(command('cart', 0, null, { items: [] })).rejects.toMatchObject({ code: '42501' });
  await db.exec('rollback');
  await db.exec(
    `reset role;begin;insert into public.organization_memberships(organization_id,profile_id,member_type) values('91000000-0000-4000-8000-000000000002','${customer}','customer')`,
  );
  await actor(customer);
  await expect(command('cart', 0, null, { items: [] })).rejects.toMatchObject({ code: '42501' });
  await db.exec('rollback');
});
it('rejects unapproved delivery, missing contract, stale contract and unsupported payment channel', async () => {
  const c = await cart(),
    revision = Number(c.revision);
  for (const payload of [
    {
      contractId: contract,
      contractRevision: 1,
      address: { ...address, region: 'UNAPPROVED' },
      method: 'CASH',
    },
    { contractId: randomUUID(), contractRevision: 1, address, method: 'CASH' },
    { contractId: contract, contractRevision: 9, address, method: 'CASH' },
    { contractId: contract, contractRevision: 1, address, method: 'BANK' },
    {
      contractId: contract,
      contractRevision: 1,
      address,
      method: 'VODAFONE_CASH',
      destinationId: '99000000-0000-4000-8000-000000000003',
    },
  ])
    await expect(command('checkout', revision, null, payload)).rejects.toMatchObject({
      code: 'PT409',
    });
});
it('rejects stale listing, suspended product, revoked price, paused scope and revoked commercial authority at checkout', async () => {
  const c = await cart();
  const mutations = [
    `update private.store_product_market_listings set revision=revision+1 where id='${listing}'`,
    "update private.store_products set status='SUSPENDED',revision=revision+1",
    "update private.store_market_prices set status='REVOKED',revision=revision+1",
    "update private.store_policy_versions set scope_paused=true,revision=revision+1 where kind='STOREFRONT_SCOPE'",
    `update private.store_checkout_contracts set status='REVOKED' where id='${contract}'`,
  ];
  for (const sql of mutations) {
    await db.exec('reset role;begin;' + sql);
    await actor(customer);
    await expect(
      command('checkout', Number(c.revision), null, {
        contractId: contract,
        contractRevision: 1,
        address,
        method: 'CASH',
      }),
    ).rejects.toMatchObject({ code: 'PT409' });
    await db.exec('rollback');
  }
});
it('requires narrow Store grants even for global SUPER_ADMIN and keeps media commands behind publication authority', async () => {
  await db.exec(
    `reset role;begin;delete from public.user_roles where profile_id='${staff}';insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${staff}',id from public.roles where code='SUPER_ADMIN'`,
  );
  await actor(staff);
  await db.exec('savepoint denied_store_permission');
  await expect(command('media', 2, listing, { media: [] })).rejects.toMatchObject({
    code: '42501',
  });
  await db.exec('rollback to savepoint denied_store_permission');
  await expect(
    db.query("select public.store_purchase_read_v1('EG','finance')"),
  ).rejects.toMatchObject({ code: '42501' });
  await db.exec('rollback');
});
it('keeps private contracts, proofs, receipt identities and sourcing invisible to direct client queries', async () => {
  await actor(customer);
  for (const table of [
    'store_checkout_contracts',
    'store_money_entries',
    'store_money_operations',
    'store_payment_proofs',
    'manual_collection_receipts',
    'store_order_items',
  ]) {
    await expect(db.query('select * from private.' + table)).rejects.toMatchObject({
      code: '42501',
    });
  }
  await expect(command('media', 2, listing, { media: [] })).rejects.toMatchObject({
    code: '42501',
  });
  await db.exec('reset role');
  expect((await db.query('select id from private.store_orders')).rows).toEqual([]);
  expect(
    (
      await db.query(
        'select * from private.store_carts where organization_id=$1 and market_id<>$2',
        [org, market],
      )
    ).rows,
  ).toEqual([]);
});
