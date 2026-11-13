import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

it('enforces Egypt writes after upgrading populated Saudi history, without changing RLS or grants', async () => {
  const db = await foundationDatabase(51);
  try {
    await db.exec(`
 insert into auth.users(id,email,email_confirmed_at) values('e1000000-0000-4000-8000-000000000001','egypt-only@example.invalid',now());
 insert into public.organizations(id,name) values('e1000000-0000-4000-8000-000000000002','Egypt fixture'),('e1000000-0000-4000-8000-000000000009','Other tenant');
 insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values
 ('e1000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000002','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20'),
 ('e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000002','SA','السعودية','Saudi',true,'SAR','Asia/Riyadh','+966'),
 ('e1000000-0000-4000-8000-000000000008','e1000000-0000-4000-8000-000000000009','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');
 insert into private.customer_enrollment(organization_id) values('e1000000-0000-4000-8000-000000000002');
 insert into public.organization_memberships(organization_id,profile_id,member_type) values('e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','customer');
 insert into public.user_roles select 'e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',id,now() from public.roles where code='CUSTOMER';
 insert into public.customers(id,organization_id,profile_id) values('e1000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001');
 insert into public.requests(id,organization_id,customer_id,market_id) values('e1000000-0000-4000-8000-000000000006','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000004');
 `);
    const history = await db.query('select to_jsonb(r) row from public.requests r');
    const grants = await db.query(
      'select * from public.role_permissions order by role_id,permission_id',
    );
    const policies = await db.query(
      'select * from pg_policies order by schemaname,tablename,policyname',
    );
    await db.exec(readFileSync('supabase/migrations/20261107000100_egypt_only_v1.sql', 'utf8'));
    expect(
      (await db.query('select * from public.role_permissions order by role_id,permission_id')).rows,
    ).toEqual(grants.rows);
    expect(
      (await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows,
    ).toEqual(policies.rows);
    expect((await db.query('select to_jsonb(r) row from public.requests r')).rows).toEqual(
      history.rows,
    );
    await expect(
      db.exec(
        "update public.requests set market_id='e1000000-0000-4000-8000-000000000003' where id='e1000000-0000-4000-8000-000000000006'",
      ),
    ).rejects.toHaveProperty('code', '55000');
    // Every existing market-bearing application table is covered, including Finance/Store.
    const uncovered = await db.query(
      `select c.table_schema,c.table_name from information_schema.columns c join information_schema.tables t using(table_schema,table_name) where c.table_schema in('public','private') and c.column_name='market_id' and t.table_type='BASE TABLE' and c.table_name<>'audit_logs' and not exists(select 1 from pg_trigger g where g.tgrelid=(quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass and g.tgname='zz_egypt_only_write')`,
    );
    expect(uncovered.rows).toEqual([]);
    await db.exec(
      "set role authenticated; select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',false)",
    );
    expect(
      (
        await db.query(
          "select id from public.requests where id='e1000000-0000-4000-8000-000000000006'",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "select public.create_customer_request('e1000000-0000-4000-8000-000000000010','e1000000-0000-4000-8000-000000000004')",
      ),
    ).rejects.toHaveProperty('code', '22023');
    await expect(
      db.query(
        "select public.create_customer_request('e1000000-0000-4000-8000-000000000011','e1000000-0000-4000-8000-000000000008')",
      ),
    ).rejects.toHaveProperty('code', '22023');
    const egypt = await db.query(
      "select public.create_customer_request('e1000000-0000-4000-8000-000000000012','e1000000-0000-4000-8000-000000000003') result",
    );
    expect(egypt.rows).toHaveLength(1);
    const catalogue = await db.query<{ result: { country: string }[] }>(
      'select public.public_market_catalogue() result',
    );
    expect(catalogue.rows[0]!.result.map((x) => x.country)).toEqual(['EG']);
    await db.exec('reset role');
    await expect(
      db.exec(
        "update public.requests set revision=revision+1 where id='e1000000-0000-4000-8000-000000000006'",
      ),
    ).rejects.toHaveProperty('code', '42501');
    await expect(
      db.exec(
        "update public.markets set active=true where id='e1000000-0000-4000-8000-000000000004'",
      ),
    ).rejects.toHaveProperty('code', '42501');
    expect(
      (
        await db.query(
          "select to_jsonb(r) row from public.requests r where id='e1000000-0000-4000-8000-000000000006'",
        )
      ).rows,
    ).toEqual(history.rows);
  } finally {
    await db.close();
  }
}, 60000);

it('freezes populated Saudi quote/order/operations/payment history without rewriting it', async () => {
  const db = await foundationDatabase(51);
  try {
    const fixture = readFileSync('tests/fixtures/schema51-phase3.sql', 'utf8')
      .split('-- Supabase TAP report')[0]!
      .replace(/rollback;\s*$/, 'commit;');
    await db.exec(fixture);
    await db.exec('reset role');
    const tables = ['requests', 'quotes', 'quote_versions', 'orders', 'jobs', 'trips', 'payments'];
    const before = new Map<string, unknown>();
    for (const table of tables)
      before.set(
        table,
        (await db.query(`select to_jsonb(t) row from public.${table} t order by id`)).rows,
      );
    await db.exec(readFileSync('supabase/migrations/20261107000100_egypt_only_v1.sql', 'utf8'));
    for (const table of tables) {
      expect(before.get(table)).not.toEqual([]);
      expect(
        (await db.query(`select to_jsonb(t) row from public.${table} t order by id`)).rows,
      ).toEqual(before.get(table));
      const rows = await db.query(`select id from public.${table} where market_id is not null`);
      if (rows.rows.length)
        await expect(
          db.exec(`update public.${table} set market_id=market_id where market_id is not null`),
        ).rejects.toThrow();
    }
    await expect(
      db.exec(
        `insert into public.quality_alerts(organization_id,trip_id) select organization_id,id from public.trips limit 1`,
      ),
    ).rejects.toHaveProperty('code', '42501');
    await expect(
      db.exec(`select public.record_mvp_event('homepage_viewed','SA','home')`),
    ).rejects.toHaveProperty('code', '22023');
  } finally {
    await db.close();
  }
}, 60000);
