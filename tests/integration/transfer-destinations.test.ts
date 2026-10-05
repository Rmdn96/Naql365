import { expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
import { paymentDetails } from '@/domain/payments/model';

test('Egypt destinations are privileged, Market-scoped, selectable and frozen in proof history', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync('supabase/tests/market.test.sql', 'utf8')
        .split('-- Supabase TAP report')[0]!
        .replace('rollback;', 'commit;'),
    );
    const org = '23500000-0000-4000-8000-000000000001',
      sa = '33500000-0000-4000-8000-000000000001',
      eg = '33500000-0000-4000-8000-000000000002';
    const actor = async (staff: boolean) =>
      db.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','13500000-0000-4000-8000-00000000000${staff ? 1 : 2}',false)`,
      );
    const accounts = [randomUUID(), randomUUID()];
    const configure = (market: string, id: string, type: string, revision = 0) =>
      db.query('select public.configure_bank_account($1,$2,$3,$4,$5,$6::jsonb)', [
        org,
        market,
        id,
        revision,
        randomUUID(),
        JSON.stringify({
          destinationType: type,
          bankNameAr: 'اختبار فقط',
          bankNameEn: `TEST ${type}`,
          beneficiaryAr: 'اختبار',
          beneficiaryEn: 'TEST ONLY',
          accountNumber: 'TEST-DESTINATION',
          active: true,
          primary: false,
        }),
      ]);
    await actor(false);
    await expect(configure(eg, accounts[0]!, 'VODAFONE_CASH')).rejects.toThrow('permission');
    await actor(true);
    await expect(configure(sa, accounts[0]!, 'VODAFONE_CASH')).rejects.toThrow('Egypt transfer');
    await expect(configure(eg, accounts[0]!, 'UNSUPPORTED')).rejects.toThrow();
    await configure(eg, accounts[0]!, 'VODAFONE_CASH');
    await configure(eg, accounts[1]!, 'INSTAPAY');
    const orders = (
      await db.query<{ id: string; currency: string }>('select id,currency from public.orders')
    ).rows;
    const order = orders.find((o) => o.currency === 'EGP')!.id;
    const saOrder = orders.find((o) => o.currency === 'SAR')!.id;
    const command = (action: string, revision: number, payload: object, target = order) =>
      db.query<{ r: { revision: number; attemptId: string } }>(
        'select public.payment_command($1,$2,$3,$4,$5::jsonb) r',
        [target, action, randomUUID(), revision, JSON.stringify(payload)],
      );
    const details = async () =>
      paymentDetails.parse(
        (await db.query<{ r: unknown }>('select public.payment_details($1) r', [order])).rows[0]!.r,
      );
    await actor(false);
    const initial = await details();
    expect(initial.bank).toBeNull();
    expect(initial.destinations.map((d) => d.type).sort()).toEqual(['INSTAPAY', 'VODAFONE_CASH']);
    expect(JSON.stringify(initial.destinations)).not.toContain('TEST-DESTINATION');
    await expect(
      command('choose', 0, { method: 'BANK_TRANSFER', destinationId: accounts[0] }, saOrder),
    ).rejects.toThrow();
    await expect(
      command('choose', 0, { method: 'CASH', destinationId: accounts[0] }),
    ).rejects.toThrow();
    await command('choose', 0, { method: 'BANK_TRANSFER', destinationId: accounts[0] });
    expect((await details()).bank?.destinationType).toBe('VODAFONE_CASH');
    await command('choose', 1, { method: 'BANK_TRANSFER', destinationId: accounts[1] });
    expect((await details()).bank?.destinationType).toBe('INSTAPAY');
    await command('reserve', 2, { fileId: randomUUID(), mime: 'image/png', size: 100 });
    await expect(
      command('choose', 3, { method: 'BANK_TRANSFER', destinationId: accounts[0] }),
    ).rejects.toThrow('frozen');
    await actor(true);
    await configure(eg, accounts[1]!, 'VODAFONE_CASH', 0);
    await actor(false);
    expect((await details()).attempts[0]?.bank.destinationType).toBe('INSTAPAY');
  } finally {
    await db.close();
  }
}, 60000);
