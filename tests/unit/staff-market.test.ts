import { beforeEach, expect, it, vi } from 'vitest';
import { staffDisplayContext, staffMarket } from '@/infrastructure/identity/staff-market';
import { salesQueue, salesRequestDetails } from '@/infrastructure/pricing/service';
import { staffPayment, staffBankConfiguration } from '@/infrastructure/payments/staff-views';

const org = '13000000-0000-4000-8000-000000000001';
const sa = '13000000-0000-4000-8000-000000000002';
const eg = '13000000-0000-4000-8000-000000000003';
const m = vi.hoisted(() => ({
  country: 'SA' as string | undefined,
  access: vi.fn(),
  payment: vi.fn(),
  rows: {} as Record<string, Record<string, unknown>[]>,
  queries: [] as { table: string; filters: [string, unknown][]; calls: string[] }[],
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: m.country }) }) }));
vi.mock('@/infrastructure/identity/staff-context', () => ({ staffAccess: m.access }));
vi.mock('@/infrastructure/payments/service', () => ({ getPayment: m.payment }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      const entry = { table, filters: [] as [string, unknown][], calls: [] as string[] };
      m.queries.push(entry);
      const rows = () =>
        (m.rows[table] ?? []).filter((r) => entry.filters.every(([k, v]) => r[k] === v));
      const query = {
        select: () => query,
        eq: (k: string, v: unknown) => {
          entry.filters.push([k, v]);
          entry.calls.push('eq:' + k);
          return query;
        },
        order: () => query,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        limit: async (n: number) => {
          entry.calls.push('limit');
          return { data: rows().slice(0, n), error: null };
        },
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  m.country = 'SA';
  m.queries = [];
  m.access.mockResolvedValue({ status: 'authorized', principal: { organizationId: org } });
  m.rows = {
    organizations: [{ id: org, name: 'Synthetic organization' }],
    markets: [
      {
        id: sa,
        organization_id: org,
        country_code: 'SA',
        active: true,
        name_ar: 'السعودية',
        name_en: 'Saudi Arabia',
        currency: 'SAR',
      },
      {
        id: eg,
        organization_id: org,
        country_code: 'EG',
        active: true,
        name_ar: 'مصر',
        name_en: 'Egypt',
        currency: 'EGP',
      },
    ],
    requests: [
      ...Array.from({ length: 110 }, (_, i) => ({
        id: String(i),
        organization_id: org,
        market_id: sa,
        status: 'SUBMITTED',
      })),
      { id: eg, organization_id: org, market_id: eg, status: 'SUBMITTED' },
      { id: 'foreign', organization_id: eg, market_id: eg, status: 'SUBMITTED' },
    ],
  };
});

it.each([
  ['SA', sa, 100],
  ['EG', eg, 1],
] as const)(
  '%s filters tenant and Market before the bounded Sales window',
  async (country, id, count) => {
    m.country = country;
    const rows = await salesQueue();
    expect(rows).toHaveLength(count);
    expect(rows.every((r) => r.market_id === id)).toBe(true);
    const q = m.queries.find((q) => q.table === 'requests')!;
    expect(q.filters).toContainEqual(['organization_id', org]);
    expect(q.calls.indexOf('eq:market_id')).toBeLessThan(q.calls.indexOf('limit'));
    expect(m.access).toHaveBeenCalledWith('pricing.calculate');
  },
);
it('switching Market changes the server dataset rather than reusing the previous window', async () => {
  expect(await salesQueue()).toHaveLength(100);
  m.country = 'EG';
  expect(await salesQueue()).toHaveLength(1);
  expect(await salesQueue()).toHaveLength(1); // subsequent navigation retains the preference
});
it('denies a direct Sales detail for a different Market', async () => {
  await expect(salesRequestDetails(eg)).rejects.toMatchObject({ code: 'not_found' });
});
it('denies invalid Market instead of silently displaying SA', async () => {
  m.country = 'XX';
  await expect(salesQueue()).rejects.toMatchObject({ code: 'forbidden' });
  expect(m.queries).toHaveLength(0);
});
it.each(['foreign organization', 'inactive', 'missing'])('denies a %s Market', async (state) => {
  m.rows.markets =
    state === 'missing'
      ? []
      : [
          {
            ...m.rows.markets![0],
            ...(state === 'inactive' ? { active: false } : { organization_id: eg }),
          },
        ];
  await expect(staffMarket('finance.read')).rejects.toMatchObject({ code: 'forbidden' });
  expect(m.access).toHaveBeenCalledWith('finance.read');
});
it.each(['suspended', 'revoked', 'missing Sales permission'])(
  '%s cannot query Market or Sales data',
  async () => {
    m.access.mockResolvedValue({ status: 'forbidden' });
    await expect(salesQueue()).rejects.toMatchObject({ code: 'forbidden' });
    expect(m.queries).toHaveLength(0);
  },
);
it('returns safe server-approved display names without private organization identifiers', async () => {
  const display = await staffDisplayContext();
  expect(display.organizationName).toBe('Synthetic organization');
  expect(display.market.name_en).toBe('Saudi Arabia');
  expect(m.queries.find((q) => q.table === 'organizations')?.filters).toEqual([['id', org]]);
});

it.each([
  ['SA', sa],
  ['EG', eg],
] as const)('scopes bank configuration on the server to %s', async (country, marketId) => {
  m.country = country;
  m.rows.bank_accounts = [
    { id: sa, organization_id: org, market_id: sa },
    { id: eg, organization_id: org, market_id: eg },
    { id: 'foreign', organization_id: eg, market_id: marketId },
  ];
  const data = await staffBankConfiguration();
  expect(m.access).toHaveBeenCalledWith('finance.accounts.manage');
  expect(data.banks).toHaveLength(1);
  expect(data.banks![0]!.market_id).toBe(marketId);
  expect(data.markets.map((m) => m.id)).toEqual([marketId]);
  const q = m.queries.find((q) => q.table === 'bank_accounts')!;
  expect(q.calls.indexOf('eq:market_id')).toBeLessThan(q.calls.indexOf('limit'));
});
it('denies a foreign Market payment before reading payment details', async () => {
  m.rows.payments = [{ order_id: eg, organization_id: org, market_id: eg }];
  await expect(staffPayment(eg)).rejects.toMatchObject({ code: 'not_found' });
  expect(m.payment).not.toHaveBeenCalled();
});
it('denies a foreign organization payment before reading payment details', async () => {
  m.rows.payments = [{ order_id: eg, organization_id: eg, market_id: sa }];
  await expect(staffPayment(eg)).rejects.toMatchObject({ code: 'not_found' });
  expect(m.payment).not.toHaveBeenCalled();
});
it('reads an authorized payment only after the scoped RLS lookup', async () => {
  m.rows.payments = [{ order_id: eg, organization_id: org, market_id: sa }];
  m.payment.mockResolvedValue({ reference: 'Synthetic payment' });
  expect(await staffPayment(eg)).toEqual({ reference: 'Synthetic payment' });
  expect(m.access).toHaveBeenCalledWith('finance.read');
  expect(m.payment).toHaveBeenCalledWith(eg);
});
it('denies restricted Finance and bank readers before querying data', async () => {
  m.access.mockResolvedValue({ status: 'forbidden' });
  await expect(staffPayment(eg)).rejects.toMatchObject({ code: 'forbidden' });
  await expect(staffBankConfiguration()).rejects.toMatchObject({ code: 'forbidden' });
  expect(m.queries).toHaveLength(0);
  expect(m.payment).not.toHaveBeenCalled();
});
