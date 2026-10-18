import { beforeEach, expect, it, vi } from 'vitest';
import { staffContext, staffAccess, staffModules } from '@/infrastructure/identity/staff-context';
const m = vi.hoisted(() => ({ user: vi.fn(), rows: vi.fn(), access: vi.fn() }));
vi.mock('@/infrastructure/config/public-env', () => ({ getPublicEnv: () => ({}) }));
vi.mock('@/infrastructure/identity/access', () => ({ portalAccess: m.access }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: m.user },
    from: () => ({ select: () => ({ eq: () => ({ eq: m.rows }) }) }),
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({ data: { user: { id: 'user' } } });
  m.rows.mockResolvedValue({ data: [{ organization_id: 'A', member_type: 'staff' }] });
  m.access.mockImplementation(async (p: string, org: string) => ({
    status: 'authorized',
    principal: { userId: 'user', organizationId: org },
  }));
});
it('uses one tenant for every module decision', async () => {
  await staffModules();
  expect(m.access.mock.calls.every((c) => c[1] === 'A')).toBe(true);
});
it('fails closed for ambiguous memberships without combining grants', async () => {
  m.rows.mockResolvedValue({
    data: [
      { organization_id: 'A', member_type: 'staff' },
      { organization_id: 'B', member_type: 'staff' },
    ],
  });
  expect((await staffContext()).status).toBe('forbidden');
  expect(m.access).not.toHaveBeenCalled();
});
it('rejects explicit organization forgery', async () => {
  expect((await staffAccess('finance.read', 'B')).status).toBe('forbidden');
  expect(m.access).not.toHaveBeenCalledWith('finance.read', 'B');
});
it.each(['customer', 'driver'])('does not treat %s as staff', async (member_type) => {
  m.rows.mockResolvedValue({ data: [{ organization_id: 'A', member_type }] });
  expect((await staffContext()).status).toBe('forbidden');
  expect(m.access).not.toHaveBeenCalled();
});
it('denies stale/absent membership', async () => {
  m.rows.mockResolvedValue({ data: [] });
  expect((await staffContext()).status).toBe('forbidden');
});
it('does not fabricate permissions after a query error', async () => {
  m.rows.mockResolvedValue({ error: { code: 'failure' } });
  await expect(staffContext()).rejects.toThrow('Workspace context unavailable');
});
it.each([
  [
    'sales',
    ['pricing.calculate'],
    { sales: true, operations: false, finance: false, support: false },
  ],
  [
    'operations',
    ['operations.manage'],
    { sales: false, operations: true, finance: false, support: false },
  ],
  [
    'finance',
    ['finance.read'],
    { sales: false, operations: false, finance: true, banks: false, support: false },
  ],
  [
    'support',
    ['support.read', 'requests.read'],
    { sales: false, operations: false, finance: false, support: true },
  ],
  ['partial support', ['support.read'], { support: false }],
] as const)('restricts %s modules to effective grants', async (_name, grants, expected) => {
  m.access.mockImplementation(async (p: string, org: string) =>
    p === 'portal.access' || (grants as readonly string[]).includes(p)
      ? { status: 'authorized', principal: { userId: 'user', organizationId: org } }
      : { status: 'forbidden' },
  );
  expect(await staffModules()).toMatchObject(expected);
});
