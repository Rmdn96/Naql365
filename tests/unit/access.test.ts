import { beforeEach, expect, it, vi } from 'vitest';
import { portalAccess } from '@/infrastructure/identity/access';
const mocks = vi.hoisted(() => ({ env: vi.fn(), getUser: vi.fn(), query: vi.fn(), rpc: vi.fn() }));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: mocks.env }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ eq: mocks.query }) }) }),
    rpc: mocks.rpc,
  }),
}));
const userId = '10000000-0000-4000-8000-000000000001';
const organizationId = '20000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.mockReturnValue({ configured: true });
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.query.mockResolvedValue({ data: [{ organization_id: organizationId }], error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
it('never authenticates a missing environment', async () => {
  mocks.env.mockReturnValue(null);
  expect(await portalAccess('portal.access')).toEqual({ status: 'unconfigured' });
  expect(mocks.getUser).not.toHaveBeenCalled();
});
it('rejects expired or revoked identity', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'revoked' } });
  expect(await portalAccess('portal.access')).toEqual({ status: 'unauthenticated' });
  expect(mocks.query).not.toHaveBeenCalled();
});
it('uses live tenant permission RPC', async () => {
  expect(await portalAccess('portal.access')).toEqual({
    status: 'authorized',
    principal: { userId, organizationId },
  });
  expect(mocks.rpc).toHaveBeenCalledWith('has_permission', {
    organization_id: organizationId,
    permission_code: 'portal.access',
  });
});
it('denies missing membership', async () => {
  mocks.query.mockResolvedValue({ data: [], error: null });
  expect(await portalAccess('portal.access')).toEqual({ status: 'forbidden' });
});
it('denies revoked permission', async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect(await portalAccess('portal.access')).toEqual({ status: 'forbidden' });
});
it('fails closed for permission backend failure', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'database error' } });
  await expect(portalAccess('portal.access')).rejects.toMatchObject({ code: 'internal' });
});
