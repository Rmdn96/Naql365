import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('upgrades the accepted 19 migrations without changing existing operational/commercial facts', async () => {
  const db = await foundationDatabase(19);
  try {
    const fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8')
      .split('-- Supabase TAP report')[0]!
      .replace(/rollback;\s*$/, 'commit;');
    await db.exec(fixture);
    const tables = [
      'requests',
      'request_locations',
      'quotes',
      'quote_versions',
      'quote_items',
      'orders',
      'jobs',
      'trips',
      'trip_stops',
      'assignments',
      'trip_events',
      'trip_pods',
      'drivers',
      'vehicles',
      'markets',
    ];
    const snapshot = async (table: string) =>
      (
        await db.query<{ row: Record<string, unknown> }>(
          `select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`,
        )
      ).rows.map((r) => r.row);
    const before = new Map<string, Record<string, unknown>[]>();
    for (const table of tables) before.set(table, await snapshot(table));
    for (const table of ['trips', 'trip_stops', 'assignments', 'trip_events', 'trip_pods'])
      expect(before.get(table)!.length, `${table} populated upgrade evidence`).toBeGreaterThan(0);
    for (const file of readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .slice(19))
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    for (const table of tables) {
      const old = before.get(table)!,
        after = await snapshot(table);
      expect(after.length).toBe(old.length);
      old.forEach((row, i) => {
        for (const key of Object.keys(row))
          expect(after[i]?.[key], `${table}.${key}`).toEqual(row[key]);
      });
    }
    expect(
      (
        await db.query<{ n: number }>(
          `select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`,
        )
      ).rows[0]?.n,
    ).toBe(0);
  } finally {
    await db.close();
  }
}, 60000);
