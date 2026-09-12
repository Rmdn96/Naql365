import { beforeEach, expect, it, vi } from 'vitest';
import { executeOperation } from '@/infrastructure/operations/service';
import { apiResult } from '@/infrastructure/requests/http';
const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn() }));
vi.mock('@/infrastructure/identity/access', () => ({ portalAccess: mocks.access }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));
const id = '13000000-0000-4000-8000-000000000001';
const input = {
  organizationId: id,
  entityId: id,
  mutationId: id,
  revision: 1,
  action: 'dispatch',
  payload: {},
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({
    status: 'authorized',
    principal: { organizationId: id, userId: id },
  });
  mocks.rpc.mockResolvedValue({
    data: { id, revision: 2, status: 'EN_ROUTE_TO_PICKUP' },
    error: null,
  });
});
it('requires the exact tenant dispatch permission before invoking SQL', async () => {
  await executeOperation(input);
  expect(mocks.access).toHaveBeenCalledWith('dispatch.manage', id);
  expect(mocks.rpc).toHaveBeenCalledWith(
    'operations_command',
    expect.objectContaining({ p_organization_id: id, p_revision: 1, p_action: 'dispatch' }),
  );
});
it('denies suspended or unauthorized staff before SQL invocation', async () => {
  mocks.access.mockResolvedValue({ status: 'forbidden' });
  const response = await apiResult(() => executeOperation(input));
  expect(response.status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('preserves database conflict authority without disclosing provider errors', async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: '23505', message: 'private internal resource details' },
  });
  const response = await apiResult(() => executeOperation(input));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'conflict' });
});
it('rejects arbitrary status and unexpected payload fields before access', async () => {
  const response = await apiResult(() =>
    executeOperation({ ...input, payload: { status: 'COMPLETED' } }),
  );
  expect(response.status).toBe(400);
  expect(mocks.access).not.toHaveBeenCalled();
});
