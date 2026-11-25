import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/store/guest-order/route';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/infrastructure/config/server-env', () => ({
  appUrl: () => new URL('https://store.example'),
}));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));

const valid = {
  request_id: randomUUID(),
  items: [{ listing_id: randomUUID(), quantity: 2, unit_price: 19.99 }],
  full_name: 'Fixture Guest',
  phone: '01000000001',
  governorate: 'GIZA',
  area: 'Test area',
  address: 'Fixture address',
  payment_method: 'CASH',
};
function post(body: unknown = valid, origin = 'https://store.example') {
  return POST(
    new Request('https://store.example/api/store/guest-order', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}
beforeEach(() => mocks.rpc.mockReset());

it('rejects a cross-origin request before checkout', async () => {
  expect((await post(valid, 'https://other.example')).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([
  { governorate: 'ALEXANDRIA' },
  { customer_id: randomUUID() },
  { total: 1 },
  { payment_method: 'INSTAPAY' },
])('rejects unapproved input before the RPC: %j', async (change) => {
  expect((await post({ ...valid, ...change })).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('returns only the order reference without requiring a session', async () => {
  const reference = 'S-' + 'a'.repeat(32);
  mocks.rpc.mockResolvedValue({ data: { reference }, error: null });
  const response = await post();
  const { request_id, ...payload } = valid;
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('store_guest_checkout_v1', {
    p_request: request_id,
    p_payload: payload,
  });
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ reference });
});
it.each([
  ['P4091', 409, 'request_changed'],
  ['PT409', 409, 'conflict'],
  ['PT429', 429, 'rate_limited'],
])('projects sanitized RPC failure %s', async (code, status, error) => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, details: 'private row' } });
  const response = await post();
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error });
});
