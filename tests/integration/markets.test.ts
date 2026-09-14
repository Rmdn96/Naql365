import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('executes Saudi and Egyptian commercial/operational commands and rejects cross-market contamination', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync('supabase/tests/market.test.sql', 'utf8').split('-- Supabase TAP report')[0]!,
    );
  } finally {
    await db.close();
  }
}, 60_000);
