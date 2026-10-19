import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('enforces dynamic catalog administration, independent reference pricing, filtering and media isolation', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(readFileSync('supabase/tests/store_catalog_management.test.sql', 'utf8'));
  } finally {
    await db.close();
  }
});
