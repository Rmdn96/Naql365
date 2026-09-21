import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('upgrades populated 27-migration data without inferring money and enforces the approved legacy boundary', async () => {
  const db = await foundationDatabase(27);
  try {
    const fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
      .split('-- Supabase TAP report')[0]!
      .replace(/rollback;\s*$/, 'commit;');
    await db.exec(fixture);
    const tables = [
      'quote_versions',
      'orders',
      'jobs',
      'trips',
      'trip_stops',
      'assignments',
      'trip_pods',
    ];
    const snapshot = async (table: string) =>
      (
        await db.query<{ value: unknown }>(
          `select to_jsonb(t) value from public.${table} t order by id`,
        )
      ).rows;
    const before = new Map<string, unknown>();
    for (const table of tables) {
      const rows = await snapshot(table);
      expect(rows.length).toBeGreaterThan(0);
      before.set(table, rows);
    }
    for (const migration of readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .slice(27))
      await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
    for (const table of tables) expect(await snapshot(table), table).toEqual(before.get(table));
    expect((await db.query('select id from public.payments')).rows).toHaveLength(0);
    // Already-started trips retain their accepted timestamps; updating an unrelated
    // operational field does not introduce a retroactive financial blocker.
    await db.exec('update public.trips set updated_at=now() where started_at is not null');
    await expect(
      db.exec(`insert into public.trips(organization_id,job_id,reference,started_at)
      select organization_id,id,'T-N365-202609-939999',now() from public.jobs limit 1`),
    ).rejects.toThrow('Payment execution clearance required');
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',false);
      select public.payment_command('83000000-0000-4000-8000-000000000001','choose',gen_random_uuid(),0,'{"method":"CASH"}');reset role;`);
    expect(
      (await db.query<{ status: string }>('select status from public.payments')).rows[0]?.status,
    ).toBe('CASH_DUE');
    expect((await db.query('select id from public.invoices')).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 60000);
