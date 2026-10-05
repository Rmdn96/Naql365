import { beforeEach, expect, it, vi } from 'vitest';
import { loginDestination } from '@/infrastructure/identity/login-destination';

const mocks = vi.hoisted(() => ({ user: vi.fn(), memberships: vi.fn(), rpc: vi.fn() }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.user },
    from: () => ({ select: () => ({ eq: mocks.memberships }) }),
    rpc: mocks.rpc,
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({
    data: { user: { id: 'actor', email: 'irrelevant@example.test' } },
  });
  mocks.memberships.mockResolvedValue({ data: [] });
  mocks.rpc.mockResolvedValue({ data: 'new' });
});
it('routes a new identity to transactional profile onboarding without writing membership', async () => {
  expect(await loginDestination()).toBe('account');
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('customer_enrollment_state');
});
it('routes staff by authoritative permission, never email or customer onboarding', async () => {
  mocks.memberships.mockResolvedValue({
    data: [{ organization_id: 'tenant', member_type: 'staff', status: 'active' }],
  });
  mocks.rpc.mockResolvedValue({ data: true });
  expect(await loginDestination()).toBe('portal');
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('has_permission', {
    organization_id: 'tenant',
    permission_code: 'portal.access',
  });
});
it('requires mapped internal driver authority', async () => {
  mocks.memberships.mockResolvedValue({ data: [{ member_type: 'driver', status: 'active' }] });
  mocks.rpc.mockResolvedValue({ data: [{ driver_id: 'mapped' }] });
  expect(await loginDestination()).toBe('driver');
  mocks.rpc.mockResolvedValue({ data: [], error: { code: '42501' } });
  expect(await loginDestination()).toBe('membership');
});
it('never converts suspended staff into customers', async () => {
  mocks.memberships.mockResolvedValue({ data: [{ member_type: 'staff', status: 'suspended' }] });
  mocks.rpc.mockResolvedValue({ data: 'unavailable' });
  expect(await loginDestination()).toBe('membership');
});
it('distinguishes incomplete customer setup from valid customer access', async () => {
  mocks.memberships.mockResolvedValue({ data: [{ member_type: 'customer', status: 'active' }] });
  mocks.rpc.mockResolvedValue({ data: 'unavailable' });
  expect(await loginDestination()).toBe('provisioning');
  mocks.rpc.mockResolvedValue({ data: 'active' });
  expect(await loginDestination()).toBe('account');
});
it('does not turn a database failure into a new customer or invalid credentials', async () => {
  mocks.memberships.mockResolvedValue({ error: { code: 'database_failure' } });
  expect(await loginDestination()).toBe('server');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('rejects invalid session before querying membership', async () => {
  mocks.user.mockResolvedValue({ data: { user: null } });
  expect(await loginDestination()).toBe('unauthenticated');
  expect(mocks.memberships).not.toHaveBeenCalled();
});
