import { test, expect } from '../staging/fixtures';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

function client(token?: string) {
  return createClient(process.env.STAGING_TEST_API_URL!, process.env.STAGING_TEST_PUBLIC_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: token ? { 'x-naql365-guest': token } : {} },
  });
}

test('hosted guest creation replay and capability isolation fail closed', async ({ page }) => {
  const journeys = [];
  for (const country of ['SA', 'EG']) {
    const token = `g1_${randomBytes(32).toString('hex')}`;
    appendFileSync(
      process.env.STAGING_PHASE7_FIXTURE_LEDGER!,
      JSON.stringify({
        verifier: createHash('sha256').update(token).digest('hex'),
      }) + '\n',
    );
    const args = { p_country: country, p_creation_token: token };
    const results = await Promise.all([
      client().rpc('start_guest_request', args),
      client().rpc('start_guest_request', args),
    ]);
    expect(results.every((r) => !r.error)).toBe(true);
    expect(results[0]!.data.request.id).toBe(results[1]!.data.request.id);
    journeys.push({ token, id: results[0]!.data.request.id as string });
  }
  const [a, b] = journeys;
  const authorized = client(a!.token);
  const own = await authorized.from('requests').select('id').eq('id', a!.id);
  expect(own.error).toBeNull();
  expect(own.data).toHaveLength(1);
  expect((await authorized.from('requests').select('id').eq('id', b!.id)).data).toEqual([]);
  expect(
    (
      await authorized.rpc('request_command', {
        p_operation: 'save',
        p_request_id: b!.id,
        p_revision: 0,
        p_mutation_id: randomUUID(),
        p_payload: {},
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await authorized.rpc('manage_guest_link', { p_request: a!.id, p_action: 'replace' })).error,
  ).not.toBeNull();
  expect(
    (
      await authorized
        .from('user_roles')
        .insert({ profile_id: randomUUID(), role_id: randomUUID() })
    ).error,
  ).not.toBeNull();
  for (const token of [
    undefined,
    'malformed',
    `g1_${randomBytes(32).toString('hex')}`,
    a!.id,
    'N365-202609-00001',
  ]) {
    expect((await client(token).rpc('guest_access_state')).error).not.toBeNull();
  }
  await page.goto('/en/guest');
  for (const token of ['malformed', `g1_${randomBytes(32).toString('hex')}`, a!.id]) {
    const status = await page.evaluate(
      async (token) =>
        (
          await fetch('/api/guest/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
        ).status,
      token,
    );
    expect(status).toBe(403);
  }
  expect((await page.context().cookies()).some((c) => c.name.includes('naql365_guest'))).toBe(
    false,
  );
});
