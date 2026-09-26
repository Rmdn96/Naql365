import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
import { createGuestSecret, guestVerifier } from '@/infrastructure/guest/secret';
import { blankDraft } from '@/domain/requests/intake';

let db: Awaited<ReturnType<typeof foundationDatabase>>;
const org = randomUUID(),
  market = randomUUID(),
  customer = randomUUID(),
  request = randomUUID();
const token = createGuestSecret();
let grant: string;

beforeAll(async () => {
  db = await foundationDatabase();
  await db.query('insert into public.organizations(id,name) values($1,$2)', [org, 'TEST ONLY']);
  await db.query(
    `insert into public.markets(id,organization_id,country_code,name_ar,name_en,currency,timezone,phone_country_code)
    values($1,$2,'SA','اختبار','TEST','SAR','Asia/Riyadh','+966')`,
    [market, org],
  );
  await db.query(
    "insert into public.customers(id,organization_id,identity_kind) values($1,$2,'GUEST')",
    [customer, org],
  );
  await db.query(
    'insert into public.requests(id,organization_id,market_id,customer_id) values($1,$2,$3,$4)',
    [request, org, market, customer],
  );
  grant = (
    await db.query<{ id: string }>(
      `insert into private.guest_access_grants(organization_id,customer_id,request_id,verifier,expires_at)
    values($1,$2,$3,decode($4,'hex'),clock_timestamp()+interval '1 day') returning id`,
      [org, customer, request, guestVerifier(token)],
    )
  ).rows[0]!.id;
}, 30000);
afterAll(async () => {
  await db.close();
});

async function context(secret: string) {
  await db.query("select set_config('request.headers',$1,false)", [
    JSON.stringify({ 'x-naql365-guest': secret }),
  ]);
  return (
    await db.query<{ id: string | null; request_id: string | null }>(
      'select (g).id,(g).request_id from (select private.guest_context() g) c',
    )
  ).rows[0]!;
}

test('grant binds one exact tenant/customer/request and stores only a verifier', async () => {
  expect(await context(token)).toEqual({ id: grant, request_id: request });
  const row = (
    await db.query<{ verifier: string }>(
      "select encode(verifier,'hex') verifier from private.guest_access_grants where id=$1",
      [grant],
    )
  ).rows[0]!;
  expect(row.verifier).toBe(guestVerifier(token));
  expect(row.verifier).not.toBe(token);
  for (const invalid of [
    '',
    request,
    'N365-202609-000001',
    createGuestSecret(),
    token.toUpperCase(),
    row.verifier,
  ])
    expect((await context(invalid)).id).toBeNull();
  await db.query("select set_config('request.headers','not-json',false)");
  expect(
    (await db.query<{ id: string | null }>('select (private.guest_context()).id')).rows[0]!.id,
  ).toBeNull();
});

test('anon and authenticated cannot read verifier, issue grants or call private capability helpers', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query('select * from private.guest_access_grants')).rejects.toThrow();
      await expect(db.query('select private.guest_context()')).rejects.toThrow();
      await expect(db.query('select private.lock_guest_context()')).rejects.toThrow();
      await expect(db.query("update public.customers set identity_kind='GUEST'")).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  }
});

test('guest shape and cross-customer grant relationship are enforced structurally', async () => {
  await expect(
    db.query('insert into public.customers(organization_id) values($1)', [org]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.customers set identity_kind='ACCOUNT' where id=$1", [customer]),
  ).rejects.toThrow();
  await expect(
    db.query('update private.guest_access_grants set request_id=$1 where id=$2', [
      randomUUID(),
      grant,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query('update private.guest_access_grants set verifier=sha256($1::bytea) where id=$2', [
      'different',
      grant,
    ]),
  ).rejects.toThrow();
});

test('revocation denies reads and queued commands; a revoked grant cannot be restored', async () => {
  await context(token);
  expect(
    (await db.query<{ id: string }>('select (private.lock_guest_context()).id')).rows[0]!.id,
  ).toBe(grant);
  await db.query(
    'update private.guest_access_grants set revoked_at=clock_timestamp() where id=$1',
    [grant],
  );
  expect((await context(token)).id).toBeNull();
  await expect(db.query('select private.lock_guest_context()')).rejects.toThrow(
    'Journey unavailable',
  );
  await expect(
    db.query('update private.guest_access_grants set revoked_at=null where id=$1', [grant]),
  ).rejects.toThrow('Revocation is permanent');
});

test('expired replacement is denied without modifying commercial journey', async () => {
  const expired = createGuestSecret();
  await db.query(
    `insert into private.guest_access_grants(organization_id,customer_id,request_id,verifier,created_at,expires_at)
    values($1,$2,$3,decode($4,'hex'),clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day')`,
    [org, customer, request, guestVerifier(expired)],
  );
  expect((await context(expired)).id).toBeNull();
  expect(
    (
      await db.query<{ status: string }>('select status from public.requests where id=$1', [
        request,
      ])
    ).rows[0]!.status,
  ).toBe('DRAFT');
});

test('anonymous creation is opt-in, globally bounded and uses the shared scoped Request command', async () => {
  await db.exec('set role anon');
  await expect(db.query("select public.start_guest_request('SA')")).rejects.toThrow(
    'Guest requests unavailable',
  );
  await db.exec('reset role');
  await db.query('update public.markets set active=true where id=$1', [market]);
  await db.query('insert into private.customer_enrollment(organization_id) values($1)', [org]);
  await db.query(
    'insert into private.guest_policy(organization_id,enabled,creations_per_hour) values($1,true,2)',
    [org],
  );
  await db.exec('set role anon');
  try {
    const start = async () =>
      (
        await db.query<{ r: { token: string; request: { id: string; revision: number } } }>(
          "select public.start_guest_request('SA') r",
        )
      ).rows[0]!.r;
    const first = await start(),
      second = await start();
    expect(first.token).toMatch(/^g1_[0-9a-f]{64}$/);
    expect(second.token).not.toBe(first.token);
    await expect(start()).rejects.toThrow('Please retry later');
    await db.query("select set_config('request.headers',$1,false)", [
      JSON.stringify({ 'x-naql365-guest': first.token }),
    ]);
    await expect(db.query('select * from public.requests')).rejects.toThrow();
    const mutate = async (
      id: string,
      action: string,
      revision = 0,
      payload: unknown = {},
      mutation = randomUUID(),
    ) =>
      (
        await db.query<{ r: { id: string; revision: number; status: string } }>(
          'select public.request_command($1,$2,$3,$4,$5::jsonb) r',
          [action, id, revision, mutation, JSON.stringify(payload)],
        )
      ).rows[0]!.r;
    await expect(mutate(second.request.id, 'cancel')).rejects.toThrow('Request unavailable');
    await expect(mutate(first.request.id, 'submit')).rejects.toThrow('Complete the request');
    const payload = { ...blankDraft(), contact_name: 'TEST Guest', contact_phone: '+966500000001' };
    const mutation = randomUUID();
    const saved = await mutate(first.request.id, 'save', 0, payload, mutation);
    expect(saved.revision).toBe(1);
    expect(await mutate(first.request.id, 'save', 0, payload, mutation)).toEqual(saved);
    expect((await mutate(first.request.id, 'cancel', 1)).status).toBe('CANCELLED');
    await expect(mutate(first.request.id, 'create')).rejects.toThrow(
      'Guest journey already exists',
    );
  } finally {
    await db.exec('reset role');
  }
  const rows = await db.query<{ n: number }>('select count(*)::int n from auth.users');
  expect(rows.rows[0]!.n).toBe(0);
});
