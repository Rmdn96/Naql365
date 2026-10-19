import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

it('executes Store purchasing, independent fulfillment, Finance verification, directional reconciliation and refunds without leaking supplier costs', async () => {
  const db = await foundationDatabase();
  try {
    const sql = readFileSync('supabase/tests/store_purchase.test.sql', 'utf8').split(
      '-- TAP evidence',
    )[0]!;
    await db.exec(sql + '\nrollback;');
    expect((await db.query('select id from private.store_orders')).rows).toEqual([]);
  } finally {
    await db.close();
  }
});
