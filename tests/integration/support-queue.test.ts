import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('support queue enforces both permissions, isolation, bounded keysets and exact field exposure', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync('supabase/tests/support_queue.test.sql', 'utf8').split(
        '-- Supabase TAP report',
      )[0]!,
    );
    expect(
      (await db.query<{ count: number }>('select count(*)::int count from public.organizations'))
        .rows[0]?.count,
    ).toBe(0);
  } finally {
    await db.close();
  }
});
it('populated 46 to 47 preserves every existing record, policy and role grant', async () => {
  const db = await foundationDatabase(46);
  try {
    const fixture = readFileSync('supabase/tests/phase3.test.sql', 'utf8').split(
      '-- Phase 6 explicit checkout',
    )[0]!;
    await db.exec(fixture + 'commit;');
    const tables = (
      await db.query<{ schema: string; name: string }>(
        "select schemaname as schema, tablename as name from pg_tables where schemaname in ('public','private','auth','storage') order by 1,2",
      )
    ).rows;
    const snapshot = async () => {
      const result = [];
      for (const table of tables)
        result.push(
          (
            await db.query(
              `select to_jsonb(t)::text as data from "${table.schema}"."${table.name}" t order by to_jsonb(t)::text`,
            )
          ).rows,
        );
      return result;
    };
    const before = await snapshot();
    const policies = (
      await db.query('select * from pg_policies order by schemaname,tablename,policyname')
    ).rows;
    await db.exec(
      readFileSync('supabase/migrations/20261012000100_support_request_queue.sql', 'utf8'),
    );
    expect(await snapshot()).toEqual(before);
    expect(
      (await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows,
    ).toEqual(policies);
  } finally {
    await db.close();
  }
});
