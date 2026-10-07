import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
test('populated 45 to 46 preserves sent/accepted quote, order, distance and automatic evaluation snapshots', async () => {
  const db = await foundationDatabase(45);
  try {
    const fixture = readFileSync('supabase/tests/phase2.test.sql', 'utf8')
      .split('-- Supabase TAP report')[0]!
      .replace(/rollback;\s*$/, 'commit;');
    await db.exec(fixture);
    const snapshot = async () =>
      (
        await db.query<{ orders: unknown }>(`select
 (select jsonb_agg(to_jsonb(t) order by id) from public.quote_versions t) quotes,
 (select jsonb_agg(to_jsonb(t) order by id) from public.orders t) orders,
 (select jsonb_agg(to_jsonb(t) order by id) from public.distance_snapshots t) distances,
 (select jsonb_agg(to_jsonb(t) order by id) from public.pricing_evaluations t) evaluations,
 (select jsonb_agg(to_jsonb(t) order by id) from public.quote_items t) items`)
      ).rows;
    const before = await snapshot();
    expect(before[0]?.orders).not.toBeNull();
    await db.exec(
      readFileSync(
        'supabase/migrations/20261007000100_manual_pricing_directional_coverage.sql',
        'utf8',
      ),
    );
    expect(await snapshot()).toEqual(before);
    expect(
      (
        await db.query(
          "select * from public.quote_pricing_details where pricing_mode<>'AUTOMATED' or evaluation_id is null",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.pricing_settings where pricing_mode<>'AUTOMATED'"))
        .rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 30000);
