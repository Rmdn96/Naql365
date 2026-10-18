import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

it('enforces catalog permissions, private costs, selected versions, publication and durable mutation receipts without exposing a Store', async () => {
  const db = await foundationDatabase();
  try {
    const sql = readFileSync(
      new URL('../../supabase/tests/store_catalog.test.sql', import.meta.url),
      'utf8',
    ).split('-- TAP evidence')[0]!;
    await db.exec(sql + '\nrollback;');
    const { rows } = await db.query<{ scopes: number; state: string }>(
      "select (select count(*)::int from private.store_policy_versions) scopes, public.store_catalog_public_v1()->>'status' state",
    );
    expect(rows[0]).toEqual({ scopes: 0, state: 'NOT_AVAILABLE' });
  } finally {
    await db.close();
  }
});
