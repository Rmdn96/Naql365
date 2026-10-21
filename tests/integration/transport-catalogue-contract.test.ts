import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/infrastructure/guest/session', () => ({ guestDatabase: () => ({ rpc: mock.rpc }) }));
vi.mock('@/infrastructure/config/public-env', () => ({
  getPublicEnv: () => ({ configured: true }),
}));
import { publicCatalogue } from '@/infrastructure/markets/public';
let db: Awaited<ReturnType<typeof foundationDatabase>>;
beforeAll(async () => {
  db = await foundationDatabase();
  await db.exec(
    readFileSync('supabase/tests/phase2.test.sql', 'utf8').split(
      'set local role authenticated;',
    )[0]! + 'commit;',
  );
  await db.exec(
    "insert into private.customer_enrollment(organization_id) values('21000000-0000-4000-8000-000000000001');set role anon;",
  );
  mock.rpc.mockImplementation(async (name: string) => {
    expect(name).toBe('public_market_catalogue');
    const result = await db.query<{ data: unknown }>(
      'select public.public_market_catalogue() data',
    );
    return { data: result.rows[0]!.data, error: null, status: 200 };
  });
}, 30000);
afterAll(async () => {
  await db?.close();
});
test('retained Guest concurrency fixture satisfies the actual anonymous Transport catalogue contract', async () => {
  const catalogue = await publicCatalogue();
  expect(catalogue).toHaveLength(1);
  expect(catalogue[0]?.services).toHaveLength(1);
  expect(catalogue[0]?.cities).toHaveLength(2);
  expect(catalogue[0]?.country).toBe('SA');
});
