import { expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

test('populated Phase 6 upgrade preserves account identities and accepted commercial snapshots', async () => {
  const db = await foundationDatabase(31);
  try {
    const base = readFileSync('supabase/tests/phase3.test.sql', 'utf8').split(
      '-- Phase 6 explicit checkout',
    )[0]!;
    await db.exec(base + 'commit;');
    const snapshot = async () =>
      (
        await db.query<Record<string, unknown>>(`select
      (select jsonb_agg(to_jsonb(v) order by id) from public.quote_versions v) quotes,
      (select jsonb_agg(to_jsonb(o) order by id) from public.orders o) orders,
      (select jsonb_agg(to_jsonb(p) order by id) from public.payments p) payments,
      (select jsonb_agg(jsonb_build_object('id',id,'profile_id',profile_id,'organization_id',organization_id) order by id) from public.customers) customers,
      (select jsonb_agg(to_jsonb(m) order by organization_id,profile_id) from public.organization_memberships m) memberships`)
      ).rows;
    const before = await snapshot();
    expect(before[0]?.orders).not.toBeNull();
    for (const file of readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .slice(31))
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    expect(await snapshot()).toEqual(before);
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.customers where identity_kind<>'ACCOUNT'",
        )
      ).rows[0]!.n,
    ).toBe(0);
    await db.exec('set role anon');
    await expect(db.query("select public.start_guest_request('SA')")).rejects.toThrow(
      'Guest requests unavailable',
    );
    await expect(db.query('select * from public.orders')).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 30000);
