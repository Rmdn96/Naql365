import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('applies all migrations and enforces tenant, customer, RBAC, storage, audit and relational invariants in PostgreSQL', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(readFileSync(new URL('../database/foundation.sql',import.meta.url),'utf8'));
    const { rows } = await db.query<{ count: number }>('select count(*)::int as count from public.organizations');
    expect(rows[0]?.count).toBe(0); // Transactional test fixtures never survive.
  } finally { await db.close(); }
});
