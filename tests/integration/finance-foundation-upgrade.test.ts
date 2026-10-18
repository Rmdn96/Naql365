import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

it('upgrades populated migration 48 without rewriting a historical confirmed payment or its evidence', async () => {
  const db = await foundationDatabase(48);
  const org = '23000000-0000-4000-8000-000000000001';
  const finance = '13000000-0000-4000-8000-000000000006';
  try {
    await db.exec(
      readFileSync('supabase/tests/phase3.test.sql', 'utf8').split(
        '-- Phase 6 explicit checkout',
      )[0]! + 'commit;',
    );
    await db.exec(`insert into auth.users(id,email) values('${finance}','upgrade-finance@example.invalid');
      insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${finance}','staff');
      insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${finance}',id from public.roles where code='FINANCE';
      insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by)
       values('${org}','5a2de9ad-d807-497a-be94-49760622db7f','SAR','اختبار','TEST ONLY','اختبار','TEST ONLY','TEST-ONLY-0000','${finance}');
      set role authenticated;
      select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',false);
      do $$ declare r jsonb; begin
       perform public.payment_command('83000000-0000-4000-8000-000000000001','choose',gen_random_uuid(),0,'{"method":"BANK_TRANSFER"}');
       r=public.payment_command('83000000-0000-4000-8000-000000000001','reserve',gen_random_uuid(),1,jsonb_build_object('fileId',gen_random_uuid(),'mime','image/png','size',100));
       perform set_config('storage.operation','object.upload',false);
       insert into storage.objects(bucket_id,name,metadata) values('documents',r->>'path','{"mimetype":"image/png","size":100}');
       perform public.payment_command('83000000-0000-4000-8000-000000000001','submit',gen_random_uuid(),2,jsonb_build_object('attemptId',r->>'attemptId'));
       perform set_config('request.jwt.claim.sub','${finance}',false);
       perform public.payment_command('83000000-0000-4000-8000-000000000001','confirm_transfer',gen_random_uuid(),3,jsonb_build_object('attemptId',r->>'attemptId','amountMinor',0,'currency','SAR','reference','HISTORICAL-RECEIPT-001'));
      end $$;
      reset role;`);
    const tables = [
      'payments',
      'payment_transactions',
      'invoices',
      'bank_transfer_attempts',
      'bank_accounts',
      'audit_logs',
      'role_permissions',
    ];
    const snapshot = async (name: string) =>
      (
        await db.query(
          `select to_jsonb(t)-'customer_reference' as row from public.${name} t order by (to_jsonb(t)-'customer_reference')::text`,
        )
      ).rows;
    const before = new Map();
    for (const name of tables) before.set(name, await snapshot(name));
    await db.exec(
      readFileSync('supabase/migrations/20261018000200_finance_market_receipts.sql', 'utf8'),
    );
    for (const name of tables) expect(await snapshot(name), name).toEqual(before.get(name));
    expect((await db.query('select id from private.manual_collection_receipts')).rows).toEqual([]);
    expect(
      (await db.query<{ status: string }>('select status from public.payments')).rows[0]!.status,
    ).toBe('PAID');
  } finally {
    await db.close();
  }
}, 60000);
