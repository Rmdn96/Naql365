import { beforeEach, expect, it, vi } from 'vitest';
import { mutateRequest } from '@/infrastructure/requests/service';
import { apiResult } from '@/infrastructure/requests/http';
import { blankDraft } from '@/domain/requests/intake';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), lookup: vi.fn() }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: mocks.lookup }) }),
    rpc: mocks.rpc,
  }),
}));
const id = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.lookup.mockResolvedValue({ data: [{ id, organization_id: id }], error: null });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === 'has_permission'
      ? { data: true, error: null }
      : { data: null, error: { code: 'PT409', message: 'private provider detail' } },
  );
});
it('returns a sanitized HTTP conflict for a permanent draft revision conflict', async () => {
  const result = await apiResult(() =>
    mutateRequest(id, { operation: 'save', revision: 0, mutationId: id, payload: blankDraft() }),
  );
  expect(result.status).toBe(409);
  expect(await result.json()).toEqual({ error: 'conflict' });
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
});
it('denies a suspended customer before invoking the mutation', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  const result = await apiResult(() =>
    mutateRequest(id, { operation: 'cancel', revision: 0, mutationId: id }),
  );
  expect(result.status).toBe(403);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
