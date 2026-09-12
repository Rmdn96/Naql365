import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

const migration =
  readFileSync('supabase/migrations/20260913000100_market_foundation.sql', 'utf8') +
  '\n' +
  readFileSync('supabase/migrations/20260913000200_market_commands.sql', 'utf8');
it('reconstructs the market schema from an empty accepted foundation', async () => {
  const db = await foundationDatabase(13);
  try {
    await db.exec(`begin; ${migration} commit;`);
    const result = await db.query<{ n: number }>('select count(*)::int n from public.markets');
    expect(result.rows[0]?.n).toBe(0);
  } finally {
    await db.close();
  }
});

it('upgrades populated accepted commercial history without changing any prior field or trigger state', async () => {
  const db = await foundationDatabase(13);
  try {
    const fixture = readFileSync('supabase/tests/phase2.test.sql', 'utf8')
      .split('-- Supabase TAP report')[0]!
      .replace(/rollback;\s*$/, 'commit;');
    await db.exec(fixture);
    const tables = [
      'requests',
      'request_locations',
      'distance_snapshots',
      'pricing_evaluations',
      'pricing_evaluation_components',
      'quotes',
      'quote_versions',
      'quote_items',
      'quote_pricing_details',
      'orders',
    ];
    const snapshot = async (table: string) =>
      (
        await db.query<{ row: Record<string, unknown> }>(
          `select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`,
        )
      ).rows.map((r) => r.row);
    const before = new Map(
      await Promise.all(tables.map(async (table) => [table, await snapshot(table)] as const)),
    );
    const triggers = await db.query(
      'select tgrelid,tgname,tgenabled from pg_trigger where not tgisinternal order by tgrelid,tgname',
    );
    await db.exec(`begin; ${migration} commit;`);
    for (const table of tables) {
      const old = before.get(table)!;
      expect(old.length, `${table} fixture populated`).toBeGreaterThan(0);
      const keys = Object.keys(old[0]!);
      const after = (await snapshot(table)).map((row) =>
        Object.fromEntries(keys.map((key) => [key, row[key]])),
      );
      expect(after.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual(
        old.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      );
      const wrong = await db.query<{ n: number }>(
        `select count(*)::int n from public.${table} t join public.markets m on m.id=t.market_id where m.country_code<>'SA'`,
      );
      expect(wrong.rows[0]?.n).toBe(0);
    }
    const afterTriggers = await db.query(
      'select tgrelid,tgname,tgenabled from pg_trigger where not tgisinternal order by tgrelid,tgname',
    );
    for (const trigger of triggers.rows) expect(afterTriggers.rows).toContainEqual(trigger);
  } finally {
    await db.close();
  }
}, 60_000);
