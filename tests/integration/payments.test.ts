import { beforeEach, afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
let db: Awaited<ReturnType<typeof foundationDatabase>>;
const org = '23000000-0000-4000-8000-000000000001',
  order = '83000000-0000-4000-8000-000000000001',
  customer = '13000000-0000-4000-8000-000000000002',
  staff = '13000000-0000-4000-8000-000000000001',
  sales = '13000000-0000-4000-8000-000000000003',
  peer = '13000000-0000-4000-8000-000000000005',
  other = '13000000-0000-4000-8000-000000000004';
const finance = '13000000-0000-4000-8000-000000000006',
  market = '5a2de9ad-d807-497a-be94-49760622db7f';
async function actor(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function command(
  action: string,
  revision: number,
  payload: Record<string, unknown> = {},
  mutation = randomUUID(),
) {
  const r = await db.query<{ r: Record<string, unknown> }>(
    'select public.payment_command($1,$2,$3,$4,$5::jsonb) r',
    [order, action, mutation, revision, JSON.stringify(payload)],
  );
  return r.rows[0]!.r;
}
async function details() {
  return (
    await db.query<{ r: Record<string, unknown> }>('select public.payment_details($1) r', [order])
  ).rows[0]!.r;
}
beforeEach(async () => {
  db = await foundationDatabase();
  const base = readFileSync('supabase/tests/phase3.test.sql', 'utf8').split(
    '-- Phase 6 explicit checkout',
  )[0]!;
  await db.exec(base + 'commit;');
  await db.exec(`insert into auth.users(id,email) values('${finance}','finance@example.invalid');insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${finance}','staff');insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${finance}',id from public.roles where code='FINANCE';
 insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by) values('${org}','${market}','SAR','اختبار فقط','STAGING TEST ONLY','اختبار','TEST ONLY','TEST-ONLY-0000','${finance}');`);
  await actor(customer);
}, 30000);
afterEach(async () => {
  await db.close();
});
it('cash remains due, owner replay is safe, full confirmation is Finance-only, receipt immutable', async () => {
  const mutation = randomUUID(),
    p = await command('choose', 0, { method: 'CASH' }, mutation);
  expect(p.status).toBe('CASH_DUE');
  expect(p.executionAllowed).toBe(true);
  expect(await command('choose', 0, { method: 'CASH' }, mutation)).toEqual(p);
  await expect(command('choose', 0, { method: 'BANK_TRANSFER' }, mutation)).rejects.toThrow();
  for (const id of [customer, staff, sales, peer, other]) {
    await actor(id);
    await expect(command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' })).rejects.toThrow();
  }
  await actor(finance);
  await expect(command('confirm_cash', 1, { amountMinor: 1, currency: 'SAR' })).rejects.toThrow();
  await expect(command('confirm_cash', 1, { amountMinor: 0, currency: 'EGP' })).rejects.toThrow();
  const receiptMutation = randomUUID(),
    paid = await command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' }, receiptMutation);
  expect(paid.status).toBe('PAID');
  expect(
    await command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' }, receiptMutation),
  ).toEqual(paid);
  await expect(command('confirm_cash', 2, { amountMinor: 0, currency: 'SAR' })).rejects.toThrow();
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.invoices where kind='PAYMENT_RECEIPT'",
      )
    ).rows[0]!.n,
  ).toBe(1);
  await db.exec('reset role');
  await expect(
    db.exec("update public.invoices set total_minor=1 where kind='PAYMENT_RECEIPT'"),
  ).rejects.toThrow();
});
it('transfer attempts remain private, rejection allows reupload, proof never means paid', async () => {
  expect((await command('choose', 0, { method: 'BANK_TRANSFER' })).executionAllowed).toBe(false);
  const reserve = await command('reserve', 1, {
    fileId: randomUUID(),
    mime: 'image/png',
    size: 100,
  });
  await db.exec(`select set_config('storage.operation','object.upload',false)`);
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2::jsonb)",
    [reserve.path, JSON.stringify({ size: 100, mimetype: 'image/png' })],
  );
  const submitted = await command('submit', 2, { attemptId: reserve.attemptId });
  expect(submitted.status).toBe('UNDER_REVIEW');
  expect(submitted.executionAllowed).toBe(false);
  await expect(command('choose', 3, { method: 'CASH' })).rejects.toThrow();
  await expect(
    command('confirm_transfer', 3, {
      attemptId: reserve.attemptId,
      amountMinor: 0,
      currency: 'SAR',
    }),
  ).rejects.toThrow();
  for (const id of [staff, sales, peer, other]) {
    await actor(id);
    expect(
      (await db.query("select id from storage.objects where bucket_id='documents'")).rows,
    ).toHaveLength(0);
    await expect(
      db.query('select public.transfer_proof_path($1)', [reserve.attemptId]),
    ).rejects.toThrow();
  }
  await actor(finance);
  expect(
    (await db.query("select id from storage.objects where bucket_id='documents'")).rows,
  ).toHaveLength(1);
  await expect(
    command('reject_transfer', 3, { attemptId: reserve.attemptId, reason: '' }),
  ).rejects.toThrow();
  await command('reject_transfer', 3, {
    attemptId: reserve.attemptId,
    reason: 'Please provide a readable proof',
    note: 'Private Finance note',
  });
  await actor(customer);
  const d = await details();
  expect(JSON.stringify(d)).toContain('Please provide');
  expect(JSON.stringify(d)).not.toContain('Private Finance note');
  const next = await command('reserve', 4, {
    fileId: randomUUID(),
    mime: 'application/pdf',
    size: 120,
  });
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values('documents',$1,$2::jsonb)",
    [next.path, JSON.stringify({ size: 120, mimetype: 'application/pdf' })],
  );
  await command('submit', 5, { attemptId: next.attemptId });
  await actor(finance);
  await expect(
    command('confirm_transfer', 6, {
      attemptId: reserve.attemptId,
      amountMinor: 0,
      currency: 'SAR',
    }),
  ).rejects.toThrow();
  expect(
    (
      await command('confirm_transfer', 6, {
        attemptId: next.attemptId,
        amountMinor: 0,
        currency: 'SAR',
      })
    ).executionAllowed,
  ).toBe(true);
  expect((await db.query('select * from public.bank_transfer_attempts')).rows).toHaveLength(2);
});
it('new physical start requires clearance and first start freezes the chosen method', async () => {
  await db.exec(
    `reset role;insert into public.jobs(id,organization_id,order_id,reference) values('93000000-0000-4000-8000-000000000001','${org}','${order}','J-N365-202609-930001');insert into public.trips(id,organization_id,job_id,reference) values('94000000-0000-4000-8000-000000000001','${org}','93000000-0000-4000-8000-000000000001','T-N365-202609-930001');`,
  );
  await expect(
    db.exec(
      "update public.trips set started_at=now() where id='94000000-0000-4000-8000-000000000001'",
    ),
  ).rejects.toThrow('Payment execution clearance required');
  await actor(customer);
  await command('choose', 0, { method: 'BANK_TRANSFER' });
  await db.exec('reset role');
  await expect(
    db.exec(
      "update public.trips set started_at=now() where id='94000000-0000-4000-8000-000000000001'",
    ),
  ).rejects.toThrow('Payment execution clearance required');
  await actor(customer);
  await command('choose', 1, { method: 'CASH' });
  await db.exec(
    "reset role;update public.trips set started_at=now() where id='94000000-0000-4000-8000-000000000001'",
  );
  await actor(customer);
  await expect(command('choose', 2, { method: 'BANK_TRANSFER' })).rejects.toThrow(
    'Payment method frozen',
  );
});
it('rejects forged checkout facts, peer access and raw financial mutation', async () => {
  for (const payload of [
    { method: 'CASH', currency: 'EGP' },
    { method: 'CASH', amountMinor: 1 },
    { method: 'CARD' },
    { method: 'BANK_TRANSFER', bankAccountId: randomUUID() },
  ])
    await expect(command('choose', 0, payload)).rejects.toThrow();
  await actor(peer);
  await expect(command('choose', 0, { method: 'CASH' })).rejects.toThrow();
  await expect(details()).rejects.toThrow();
  await actor(customer);
  await expect(
    db.query('insert into public.payments(organization_id,order_id) values($1,$2)', [org, order]),
  ).rejects.toThrow();
  await command('choose', 0, { method: 'BANK_TRANSFER' });
  await expect(
    command('reserve', 1, { fileId: randomUUID(), mime: 'text/html', size: 100 }),
  ).rejects.toThrow();
  await expect(
    command('reserve', 1, { fileId: randomUUID(), mime: 'image/png', size: 4000000 }),
  ).rejects.toThrow();
});
it('revokes suspended Finance/customer access and retains private rejection evidence', async () => {
  await command('choose', 0, { method: 'CASH' });
  await db.exec(
    `reset role;update public.organization_memberships set status='suspended' where profile_id='${finance}';`,
  );
  await actor(finance);
  await expect(command('confirm_cash', 1, { amountMinor: 0, currency: 'SAR' })).rejects.toThrow();
  await expect(details()).rejects.toThrow();
  await db.exec(
    `reset role;update public.organization_memberships set status='suspended' where profile_id='${customer}';`,
  );
  await actor(customer);
  await expect(details()).rejects.toThrow();
  await expect(command('choose', 1, { method: 'CASH' })).rejects.toThrow();
});
it('preserves bank provenance and permits recovery of incomplete uploads only', async () => {
  await command('choose', 0, { method: 'BANK_TRANSFER' });
  const r = await command('reserve', 1, { fileId: randomUUID(), mime: 'image/png', size: 80 });
  await db.exec(
    `reset role;update public.bank_accounts set bank_name_en='CHANGED TEST BANK' where organization_id='${org}';`,
  );
  await actor(customer);
  const d = await details();
  expect(JSON.stringify(d.attempts)).toContain('STAGING TEST ONLY');
  expect(JSON.stringify(d.attempts)).not.toContain('CHANGED TEST BANK');
  const removing = await command('remove', 2, { attemptId: r.attemptId });
  expect(removing.path).toBe(r.path);
  expect((await command('remove', 3, { attemptId: r.attemptId })).revision).toBe(3);
  await command('finish_remove', 3, { attemptId: r.attemptId });
  expect((await details()).attempts).toEqual([]);
  await command('choose', 4, { method: 'CASH' });
});
it('rejects ambiguous method/state facts and cross-Market bank selection', async () => {
  await db.exec('reset role');
  await expect(
    db.query(
      `insert into public.payments(organization_id,order_id,status) values($1,$2,'CASH_DUE')`,
      [org, order],
    ),
  ).rejects.toThrow();
  await db.exec(`update public.bank_accounts set active=false where organization_id='${org}'`);
  const egypt = randomUUID();
  await db.query(
    `insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values($1,$2,'EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20')`,
    [egypt, org],
  );
  await db.query(
    `insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by) values($1,$2,'EGP','اختبار','EG TEST ONLY','اختبار','TEST','TEST-EG-0000',$3)`,
    [org, egypt, finance],
  );
  await actor(customer);
  await expect(command('choose', 0, { method: 'BANK_TRANSFER' })).rejects.toThrow(
    'Bank instructions unavailable',
  );
});
it('bank administration is separately privileged, scoped, revisioned and replay safe', async () => {
  const bank = randomUUID(),
    mutation = randomUUID();
  const details = {
    bankNameAr: 'اختبار',
    bankNameEn: 'TEST ONLY',
    beneficiaryAr: 'اختبار',
    beneficiaryEn: 'TEST ONLY',
    accountNumber: 'TEST-SECONDARY',
    active: true,
    primary: false,
  };
  const configure = (data: object = details, revision = 0) =>
    db.query('select public.configure_bank_account($1,$2,$3,$4,$5,$6::jsonb) r', [
      org,
      market,
      bank,
      revision,
      mutation,
      JSON.stringify(data),
    ]);
  for (const role of [customer, finance, staff, sales, other]) {
    await actor(role);
    await expect(configure()).rejects.toThrow('Bank configuration permission required');
  }
  await db.exec(
    `reset role;insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${staff}',id from public.roles where code='SUPER_ADMIN';`,
  );
  await actor(staff);
  await expect(configure({ ...details, currency: 'EGP' })).rejects.toThrow();
  await expect(configure({ ...details, bankNameAr: 42 })).rejects.toThrow();
  const first = await configure();
  expect((await configure()).rows).toEqual(first.rows);
  expect(
    (
      await db.query<{ currency: string }>(
        'select currency from public.bank_accounts where id=$1',
        [bank],
      )
    ).rows[0]?.currency,
  ).toBe('SAR');
  await expect(configure({ ...details, accountNumber: 'FORGED-REPLAY' })).rejects.toThrow(
    'Mutation identity reused',
  );
});
