import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('retains the historical Schema51 two-market command contract', async () => {
  const db = await foundationDatabase(51);
  try {
    await db.exec(
      readFileSync('tests/fixtures/schema51-market.sql', 'utf8').split(
        '-- Supabase TAP report',
      )[0]!,
    );
  } finally {
    await db.close();
  }
}, 60_000);
