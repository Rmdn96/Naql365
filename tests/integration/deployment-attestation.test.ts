import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('reconstructs current migrations and enforces attestation security', async () => {
  expect(readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))).toHaveLength(46);
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync('supabase/tests/deployment-attestation.test.sql', 'utf8').split(
        '-- Supabase TAP report',
      )[0]!,
    );
  } finally {
    await db.close();
  }
});
it('populated 44 to 45 upgrade preserves every existing table and policy', async () => {
  const db = await foundationDatabase(44);
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
      readFileSync('supabase/migrations/20261006000100_deployment_attestation.sql', 'utf8'),
    );
    expect(await snapshot()).toEqual(before);
    expect(
      (await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows,
    ).toEqual(policies);
    expect((await db.query('select * from public.deployment_attestation()')).rows).toEqual([]);
  } finally {
    await db.close();
  }
});
