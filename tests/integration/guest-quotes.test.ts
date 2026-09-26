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
  const cash = (
    await db.query<{ r: { status: string; executionAllowed: boolean } }>(
      'select public.payment_command($1,\'choose\',$2,0,\'{"method":"CASH"}\') r',
      [accepted.order_id, randomUUID()],
    )
  ).rows[0]!.r;
  expect(cash.status).toBe('CASH_DUE');
  expect(cash.executionAllowed).toBe(true);
  await expect(
    db.query("select public.payment_command($1,'confirm_cash',$2,1,'{}')", [
      accepted.order_id,
      randomUUID(),
    ]),
  ).rejects.toThrow();
  const progress = (
    await db.query<{ r: Record<string, unknown> }>('select public.customer_order_progress($1) r', [
      accepted.order_id,
    ])
  ).rows[0]!.r;
  expect(progress.id).toBe(accepted.order_id);
  expect(Object.keys(progress).sort()).toEqual([
    'completedAt',
    'id',
    'market',
    'reference',
    'status',
    'trips',
  ]);
  await guest(b.token);
  expect((await db.query('select id from public.orders')).rows).toHaveLength(0);
  await expect(
    db.query('select public.customer_order_progress($1)', [accepted.order_id]),
  ).rejects.toThrow('Order unavailable');
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

test('guest transfer proof stays private and only Finance can reject or confirm it', async () => {
  const journey = await newJourney(),
    other = await newJourney();
  const version = await prepareQuote(journey.request.id);
  await db.query('select public.send_quote($1)', [version]);
  await guest(journey.token);
  const order = (
    await db.query<{ r: { order_id: string } }>(
      "select public.respond_to_quote($1,'accept',$2,null) r",
      [version, randomUUID()],
    )
  ).rows[0]!.r.order_id;
  const details = async () =>
    (await db.query<{ r: Record<string, unknown> }>('select public.payment_details($1) r', [order]))
      .rows[0]!.r;
  const command = async (
    action: string,
    revision: number,
    payload: Record<string, unknown>,
    mutation = randomUUID(),
  ) =>
    (
      await db.query<{ r: Record<string, unknown> }>(
        'select public.payment_command($1,$2,$3,$4,$5::jsonb) r',
        [order, action, mutation, revision, JSON.stringify(payload)],
      )
    ).rows[0]!.r;
  const finance = randomUUID();
  await db.exec('reset role');
  await db.query("insert into auth.users(id,email) values($1,'phase7-finance@example.invalid')", [
    finance,
  ]);
  await db.query(
    "insert into public.organization_memberships(organization_id,profile_id,member_type) values($1,$2,'staff')",
    [org, finance],
  );
  await db.query(
    "insert into public.user_roles(organization_id,profile_id,role_id) select $1,$2,id from public.roles where code='FINANCE'",
    [org, finance],
  );
  await db.query(
    `insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by)
    select organization_id,market_id,currency,'اختبار فقط','STAGING TEST ONLY','اختبار','TEST ONLY','TEST-ONLY-0000',$2 from public.orders where id=$1`,
    [order, finance],
  );
  const asFinance = async () => {
    await db.exec('reset role');
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.headers','{}',false)",
      [finance],
    );
    await db.exec('set role authenticated');
  };
  await guest(journey.token);
  expect((await details()).bank).toBeNull();
  const mutation = randomUUID();
  const chosen = await command('choose', 0, { method: 'BANK_TRANSFER' }, mutation);
  expect(chosen.status).toBe('AWAITING_TRANSFER_PROOF');
  expect(await command('choose', 0, { method: 'BANK_TRANSFER' }, mutation)).toEqual(chosen);
  expect((await details()).bank).not.toBeNull();
  await expect(command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' })).rejects.toThrow();
  let reserve = await command('reserve', 1, { fileId: randomUUID(), mime: 'image/png', size: 100 });
  await db.exec("select set_config('storage.operation','object.upload',false)");
  const upload = async (size = 100) =>
    db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2::jsonb)",
      [reserve.path, JSON.stringify({ size, mimetype: 'image/png' })],
    );
  await expect(upload(101)).rejects.toThrow();
  await guest(other.token);
  await expect(upload()).rejects.toThrow();
  await expect(details()).rejects.toThrow();
  await guest(journey.token);
  await upload();
  expect((await command('submit', 2, { attemptId: reserve.attemptId })).status).toBe(
    'UNDER_REVIEW',
  );
  await expect(
    command('confirm_transfer', 3, {
      attemptId: reserve.attemptId,
      amountMinor: 0,
      currency: 'SAR',
    }),
  ).rejects.toThrow();
  expect(
    (await db.query('select public.transfer_proof_path($1)', [reserve.attemptId])).rows,
  ).toHaveLength(1);
  for (const token of ['', other.token]) {
    await guest(token);
    expect(
      (await db.query("select id from storage.objects where bucket_id='documents'")).rows,
    ).toHaveLength(0);
    await expect(
      db.query('select public.transfer_proof_path($1)', [reserve.attemptId]),
    ).rejects.toThrow();
  }
  await asFinance();
  await command('reject_transfer', 3, {
    attemptId: reserve.attemptId,
    reason: 'TEST unreadable proof',
    note: 'TEST private Finance note',
  });
  await guest(journey.token);
  expect(JSON.stringify(await details())).toContain('TEST unreadable proof');
  expect(JSON.stringify(await details())).not.toContain('TEST private Finance note');
  reserve = await command('reserve', 4, { fileId: randomUUID(), mime: 'image/png', size: 100 });
  await upload();
  await command('submit', 5, { attemptId: reserve.attemptId });
  const total = (await details()).totalMinor;
  await asFinance();
  await expect(
    command('confirm_transfer', 6, {
      attemptId: reserve.attemptId,
      amountMinor: total,
      currency: 'EGP',
    }),
  ).rejects.toThrow();
  await command('confirm_transfer', 6, {
    attemptId: reserve.attemptId,
    amountMinor: total,
    currency: 'SAR',
  });
  await guest(journey.token);
  expect((await details()).status).toBe('PAID');
  await expect(db.query('select * from public.payment_transactions')).rejects.toThrow();
});
