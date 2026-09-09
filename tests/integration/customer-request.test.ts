import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('reconstructs and enforces customer onboarding, persisted intake, immutability and negative authorization in PostgreSQL', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync(
        new URL('../../supabase/tests/customer_request.test.sql', import.meta.url),
        'utf8',
      ).split('-- Supabase TAP report')[0]!,
    );
  } finally {
    await db.close();
  }
});
