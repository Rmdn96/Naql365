import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
const org = '23000000-0000-4000-8000-000000000001';
const finance = '13000000-0000-4000-8000-000000000006';
const customer = '13000000-0000-4000-8000-000000000002';
const order = '83000000-0000-4000-8000-000000000001';
it('scopes Finance before keyset pagination, rejects unauthorized/ambiguous membership and keeps receipt claims atomic/private', async () => {
  const db = await foundationDatabase();
  try {
    const base = readFileSync('supabase/tests/phase3.test.sql', 'utf8').split(
      '-- Phase 6 explicit checkout',
    )[0]!;
    await db.exec(base + 'commit;');
    let eg = base.slice(base.indexOf('-- Explicit synthetic catalogue'));
    eg =
      eg.slice(0, eg.indexOf('insert into public.market_regions')) +
      eg.slice(eg.indexOf('insert into auth.users'));
    for (const prefix of ['130', '330', '530', '630', '730', '830'])
      eg = eg.replaceAll(prefix + '00000', String(Number(prefix) + 1) + '00000');
    eg = eg
      .replaceAll("'SA'", "'EG'")
      .replaceAll("'SAR'", "'EGP'")
      .replaceAll("'phase3'", "'phase3-eg'")
      .replaceAll('O-N365-202609-930001', 'O-N365-202609-930002');
    await db.exec(eg);
    await db.exec(`insert into auth.users(id,email) values('${finance}','foundation-finance@example.invalid');
 insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${finance}','staff');
 insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${finance}',id from public.roles where code='FINANCE';
 insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by)
 select '${org}',id,currency,'اختبار','SYNTHETIC','اختبار','SYNTHETIC','TEST-ONLY-0000','${finance}' from public.markets where organization_id='${org}';`);
    const actor = async (id: string) =>
      db.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
      );
    const market = async (country: string) =>
      (
        await db.query<{ id: string }>(
          'select id from public.markets where organization_id=$1 and country_code=$2',
          [org, country],
        )
      ).rows[0]!.id;
    const sa = await market('SA'),
      egId = await market('EG');
    const cmd = async (
      id: string,
      action: string,
      revision: number,
      payload: Record<string, unknown>,
      mutation = randomUUID(),
    ) =>
      (
        await db.query<{ r: Record<string, unknown> }>(
          'select public.payment_command($1,$2,$3,$4,$5::jsonb) r',
          [id, action, mutation, revision, JSON.stringify(payload)],
        )
      ).rows[0]!.r;
    const prepare = async (id: string, owner: string) => {
      await actor(owner);
      await cmd(id, 'choose', 0, { method: 'BANK_TRANSFER' });
      const r = await cmd(id, 'reserve', 1, { fileId: randomUUID(), mime: 'image/png', size: 100 });
      await db.exec("select set_config('storage.operation','object.upload',false)");
      await db.query(
        `insert into storage.objects(bucket_id,name,metadata) values('documents',$1,'{"size":100,"mimetype":"image/png"}')`,
        [r.path],
      );
      await expect(
        cmd(id, 'submit', 2, { attemptId: r.attemptId, customerReference: 'x'.repeat(121) }),
      ).rejects.toThrow();
      const mutation = randomUUID();
      const submitted = await cmd(
        id,
        'submit',
        2,
        { attemptId: r.attemptId, customerReference: 'CUSTOMER-UNVERIFIED-ONLY' },
        mutation,
      );
      expect(submitted.executionAllowed).toBe(false);
      expect(
        await cmd(
          id,
          'submit',
          2,
          { attemptId: r.attemptId, customerReference: 'CUSTOMER-UNVERIFIED-ONLY' },
          mutation,
        ),
      ).toEqual(submitted);
      await expect(
        cmd(id, 'submit', 2, { attemptId: r.attemptId, customerReference: 'DIFFERENT' }, mutation),
      ).rejects.toThrow();
      return r.attemptId;
    };
    const attempt = await prepare(order, customer);
    const egOrder = order.replace('83000000', '83100000');
    const egAttempt = await prepare(egOrder, customer.replace('13000000', '13100000'));
    const queue = async (
      m: string,
      status: string | null = null,
      created: string | null = null,
      id: string | null = null,
    ) =>
      (
        await db.query<{
          r: {
            items: { marketId: string; orderId: string }[];
            nextCursor: { createdAt: string; id: string } | null;
          };
        }>('select public.finance_market_queue($1,$2,$3,$4,$5,1) r', [org, m, status, created, id])
      ).rows[0]!.r;
    await actor(finance);
    expect((await queue(sa)).items.map((r) => r.orderId)).toEqual([order]);
    expect((await queue(egId)).items.map((r) => r.orderId)).toEqual([egOrder]);
    expect((await queue(egId, 'CASH_DUE')).items).toEqual([]);
    const cursor = (
      await db.query<{ created_at: string; id: string }>(
        'select created_at::text,id from public.payments where order_id=$1',
        [order],
      )
    ).rows[0]!;
    expect((await queue(sa, null, cursor.created_at, cursor.id)).items).toEqual([]);
    await db.exec('reset role');
    let third = base.slice(base.indexOf('insert into auth.users'));
    for (const prefix of ['130', '330', '530', '630', '730', '830'])
      third = third.replaceAll(prefix + '00000', String(Number(prefix) + 2) + '00000');
    third = third
      .replaceAll("'phase3'", "'phase3-third'")
      .replaceAll('O-N365-202609-930001', 'O-N365-202609-930003');
    await db.exec(third);
    await actor(customer.replace('13000000', '13200000'));
    await cmd(order.replace('83000000', '83200000'), 'choose', 0, { method: 'CASH' });
    await actor(finance);
    const first = await queue(sa);
    expect(first.nextCursor).not.toBeNull();
    const second = await queue(sa, null, first.nextCursor!.createdAt, first.nextCursor!.id);
    expect(second.nextCursor).toBeNull();
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((r) => r.orderId)).size).toBe(2);
    expect([...first.items, ...second.items].every((r) => r.marketId === sa)).toBe(true);
    expect((await queue(sa, 'CASH_DUE')).items.map((r) => r.orderId)).toEqual([
      order.replace('83000000', '83200000'),
    ]);
    await expect(queue(randomUUID())).rejects.toThrow();
    await expect(queue(sa, 'INVALID')).rejects.toThrow();
    await expect(queue(sa, null, null, randomUUID())).rejects.toThrow();
    for (const uid of [
      customer,
      customer.replace('13000000', '13100000'),
      '13000000-0000-4000-8000-000000000001',
      '13000000-0000-4000-8000-000000000003',
      '13000000-0000-4000-8000-000000000004',
    ]) {
      await actor(uid);
      await expect(queue(sa)).rejects.toThrow();
      await expect(db.query('select * from private.manual_collection_receipts')).rejects.toThrow();
    }
    await actor(finance);
    await expect(
      cmd(order, 'confirm_transfer', 3, { attemptId: attempt, amountMinor: 0, currency: 'SAR' }),
    ).rejects.toThrow();
    const mutation = randomUUID(),
      payload = {
        attemptId: attempt,
        amountMinor: 0,
        currency: 'SAR',
        reference: 'VERIFIED-EXTERNAL-001',
      };
    const paid = await cmd(order, 'confirm_transfer', 3, payload, mutation);
    expect(paid.status).toBe('PAID');
    expect(await cmd(order, 'confirm_transfer', 3, payload, mutation)).toEqual(paid);
    await expect(
      cmd(egOrder, 'confirm_transfer', 3, {
        attemptId: egAttempt,
        amountMinor: 0,
        currency: 'EGP',
        reference: 'verified external 001',
      }),
    ).rejects.toThrow();
    expect((await queue(egId, 'UNDER_REVIEW')).items).toHaveLength(1);
    await db.exec('reset role');
    expect((await db.query('select id from private.manual_collection_receipts')).rows).toHaveLength(
      1,
    );
    await expect(db.exec('delete from private.manual_collection_receipts')).rejects.toThrow(
      'immutable',
    );
    await expect(
      db.exec("update private.manual_collection_receipts set external_identity='CHANGED'"),
    ).rejects.toThrow('immutable');
    await db.exec(
      `update public.organization_memberships set status='suspended' where profile_id='${finance}'`,
    );
    await actor(finance);
    await expect(queue(sa)).rejects.toThrow();
    await db.exec(
      `reset role;update public.organization_memberships set status='active' where profile_id='${finance}';insert into public.organization_memberships(organization_id,profile_id,member_type) values('23000000-0000-4000-8000-000000000002','${finance}','staff')`,
    );
    await actor(finance);
    await expect(queue(sa)).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 60000);
