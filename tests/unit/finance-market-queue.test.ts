import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ market: vi.fn(), rpc: vi.fn() }));
vi.mock('@/infrastructure/identity/staff-market', () => ({ staffMarket: m.market }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ rpc: m.rpc }),
}));
import { staffFinanceQueue } from '@/infrastructure/payments/staff-views';
const org = '23000000-0000-4000-8000-000000000001',
  sa = '13000000-0000-4000-8000-000000000001',
  eg = '13000000-0000-4000-8000-000000000002';
beforeEach(() => {
  vi.clearAllMocks();
  m.market.mockResolvedValue({ organizationId: org, market: { id: sa } });
  m.rpc.mockResolvedValue({ data: { items: [], nextCursor: null }, error: null });
});
it.each([sa, eg])('uses server-selected Market %s, with status inside RPC', async (marketId) => {
  m.market.mockResolvedValue({ organizationId: org, market: { id: marketId } });
  await expect(staffFinanceQueue({ status: 'UNDER_REVIEW' })).resolves.toMatchObject({
    items: [],
    marketId,
  });
  expect(m.market).toHaveBeenCalledWith('finance.read');
  expect(m.rpc).toHaveBeenCalledWith('finance_market_queue', {
    p_org: org,
    p_market: marketId,
    p_status: 'UNDER_REVIEW',
  });
});
it('retains the status filter but resets a cursor belonging to a previous selected Market', async () => {
  await staffFinanceQueue({
    status: 'PAID',
    marketId: eg,
    id: eg,
    createdAt: '2026-10-18T10:00:00Z',
  });
  expect(m.rpc).toHaveBeenCalledWith('finance_market_queue', {
    p_org: org,
    p_market: sa,
    p_status: 'PAID',
  });
  await staffFinanceQueue({
    status: 'PAID',
    marketId: sa,
    id: eg,
    createdAt: '2026-10-18T10:00:00Z',
  });
  expect(m.rpc).toHaveBeenLastCalledWith('finance_market_queue', {
    p_org: org,
    p_market: sa,
    p_status: 'PAID',
    p_before_id: eg,
    p_before_created: '2026-10-18T10:00:00Z',
  });
});
it.each([
  { organizationId: eg },
  { status: 'INVALID' },
  { id: eg },
  { createdAt: '2026-10-18T10:00:00Z', id: eg },
])('rejects forged or incomplete filters before RPC: %j', async (input) => {
  await expect(staffFinanceQueue(input)).rejects.toThrow();
  expect(m.rpc).not.toHaveBeenCalled();
});
it('fails closed before querying when canonical staff context denies access', async () => {
  m.market.mockRejectedValue(new Error('Denied'));
  await expect(staffFinanceQueue()).rejects.toThrow('Denied');
  expect(m.rpc).not.toHaveBeenCalled();
});
