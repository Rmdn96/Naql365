import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
import { blankDraft } from '@/domain/requests/intake';

let db: Awaited<ReturnType<typeof foundationDatabase>>;
const org = '21000000-0000-4000-8000-000000000001',
  sales = '11000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  db = await foundationDatabase();
  await db.exec(
    readFileSync('supabase/tests/phase2.test.sql', 'utf8').split(
      'set local role authenticated;',
    )[0]! + 'commit;',
  );
  await db.query('insert into private.customer_enrollment(organization_id) values($1)', [org]);
  await db.query('insert into private.guest_policy(organization_id,enabled) values($1,true)', [
    org,
  ]);
}, 30000);
afterAll(async () => {
  await db.close();
});
async function guest(token = '') {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub','',false),set_config('request.headers',$1,false)",
    [JSON.stringify({ 'x-naql365-guest': token })],
  );
  await db.exec('set role anon');
}
async function newJourney() {
  await guest();
  const journey = (
    await db.query<{ r: { token: string; request: { id: string } } }>(
      "select public.start_guest_request('SA') r",
    )
  ).rows[0]!.r;
  await guest(journey.token);
  const city = (
    await db.query<{ id: string }>(
      'select id from public.market_cities where organization_id=$1 order by code limit 1',
      [org],
    )
  ).rows[0]!.id;
  const payload = {
    ...blankDraft(),
    service_id: '41000000-0000-4000-8000-000000000001',
    description: 'TEST move',
    contact_name: 'TEST Guest',
    contact_phone: '+966500000001',
    preferred_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time_window: 'flexible',
    items: [{ description: 'TEST box', quantity: 1, notes: '' }],
  };
  payload.pickup = {
    ...payload.pickup,
    city_id: city,
    city: 'TEST city',
    address: 'TEST pickup',
    floor: 0,
    elevator: true,
  };
  payload.delivery = {
    ...payload.delivery,
    city_id: city,
    city: 'TEST city',
    address: 'TEST delivery',
    floor: 0,
    elevator: true,
  };
  await db.query("select public.request_command('save',$1,0,$2,$3::jsonb)", [
    journey.request.id,
    randomUUID(),
    JSON.stringify(payload),
  ]);
  await db.query("select public.request_command('submit',$1,1,$2,'{}')", [
    journey.request.id,
    randomUUID(),
  ]);
  return journey;
}
async function prepareQuote(requestId: string) {
  await db.exec('reset role');
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.headers','{}',false)",
    [sales],
  );
  await db.exec('set role authenticated');
  const mutation = randomUUID(),
    version = randomUUID();
  await db.query(
    "select public.calculate_preliminary_price($1,12.5,null,'61000000-0000-4000-8000-000000000001',1,$2)",
    [requestId, mutation],
  );
  const evaluation = (
    await db.query<{ id: string }>(
      'select id from public.pricing_evaluations where mutation_id=$1',
      [mutation],
    )
  ).rows[0]!.id;
  await db.query('select public.create_quote_draft($1,0,null,172800,$2)', [evaluation, version]);
  return version;
}
test('guest accepts an immutable staff-priced Quote through the existing exactly-one Order transaction', async () => {
  const a = await newJourney(),
    b = await newJourney();
  const version = await prepareQuote(a.request.id);
  await guest(a.token);
  expect((await db.query('select id from public.quote_versions')).rows).toHaveLength(0);
  await expect(db.query('select public.view_customer_quote($1)', [version])).rejects.toThrow();
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sales]);
  await db.exec('set role authenticated');
  await db.query('select public.send_quote($1)', [version]);
  await guest(b.token);
  expect((await db.query('select id from public.quote_versions')).rows).toHaveLength(0);
  await expect(
    db.query("select public.respond_to_quote($1,'accept',$2,null)", [version, randomUUID()]),
  ).rejects.toThrow('Quote unavailable');
  await guest(a.token);
  await expect(db.query('select * from public.quote_pricing_details')).rejects.toThrow();
  await expect(db.query('select * from public.pricing_evaluations')).rejects.toThrow();
  await expect(
    db.query(
      "select public.calculate_preliminary_price($1,1,null,'61000000-0000-4000-8000-000000000001',1,$2)",
      [a.request.id, randomUUID()],
    ),
  ).rejects.toThrow();
  const view = (
    await db.query<{ r: { status: string } }>('select public.view_customer_quote($1) r', [version])
  ).rows[0]!.r;
  expect(view.status).toBe('VIEWED');
  const accept = async () =>
    (
      await db.query<{ r: { status: string; order_id: string } }>(
        "select public.respond_to_quote($1,'accept',$2,null) r",
        [version, randomUUID()],
      )
    ).rows[0]!.r;
  const accepted = await accept();
  expect(accepted.status).toBe('ACCEPTED');
  expect(await accept()).toEqual(accepted);
  expect((await db.query('select id from public.orders')).rows).toHaveLength(1);
  await guest(b.token);
  expect((await db.query('select id from public.orders')).rows).toHaveLength(0);
});
test('guest rejection creates no Order and capability audit does not store secrets', async () => {
  const journey = await newJourney(),
    version = await prepareQuote(journey.request.id);
  await db.query('select public.send_quote($1)', [version]);
  await guest(journey.token);
  await db.query("select public.respond_to_quote($1,'reject',$2,'TEST customer decision')", [
    version,
    randomUUID(),
  ]);
  expect((await db.query('select id from public.orders')).rows).toHaveLength(0);
  await db.exec('reset role');
  const audit = (
    await db.query<{ metadata: Record<string, unknown> }>(
      'select metadata from public.audit_logs where entity_id=$1 and action=$2',
      [version, 'quote.rejected'],
    )
  ).rows;
  expect(audit).toHaveLength(1);
  expect(audit[0]!.metadata.guest_grant_id).toBeTypeOf('string');
  expect(JSON.stringify(audit)).not.toContain(journey.token);
});
