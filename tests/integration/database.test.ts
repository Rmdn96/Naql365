import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
it('applies all migrations and enforces tenant, customer, RBAC, storage, audit and relational invariants in PostgreSQL', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync(
        new URL('../../supabase/tests/foundation.test.sql', import.meta.url),
        'utf8',
      ).split('-- Supabase TAP report')[0]!,
    );
    const { rows } = await db.query<{ count: number }>(
      'select count(*)::int as count from public.organizations',
    );
    expect(rows[0]?.count).toBe(0); // Transactional test fixtures never survive.
  } finally {
    await db.close();
  }
});

it('enforces Phase 2 pricing, distance, quote and order invariants in PostgreSQL', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(
      readFileSync(new URL('../../supabase/tests/phase2.test.sql', import.meta.url), 'utf8'),
    );
    const { rows } = await db.query<{ count: number }>(
      'select count(*)::int as count from public.pricing_evaluations',
    );
    expect(rows[0]?.count).toBe(0);
  } finally {
    await db.close();
  }
});
