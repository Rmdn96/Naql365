import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/infrastructure/supabase/server', () => ({ createSupabaseServerClient: mocks.client }));
vi.mock('@/infrastructure/markets/public', () => ({ selectedPublicCountry: async () => 'EG' }));
import { GET } from '@/app/api/store/route';

it('keeps SQL and HTTP customer projections free of internal sourcing/Finance data while authorized staff retain it', async () => {
  // Entirely in-memory PGlite with the existing synthetic fixture: no Docker/cloud connection.
  const db = await foundationDatabase();
  const customer = '92000000-0000-4000-8000-000000000001';
  const staff = '92000000-0000-4000-8000-000000000002';
  let subject = customer;
  async function actor(id: string) {
    subject = id;
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
    );
  }
  async function command(
    action: string,
    revision: number,
    target: string | null,
    payload: Record<string, unknown> = {},
  ) {
    return (
      await db.query<{ r: { id: string; revision: number } }>(
        'select public.store_purchase_command_v1($1,$2,$3,$4,$5,$6) r',
        ['EG', action, randomUUID(), revision, target, JSON.stringify(payload)],
      )
    ).rows[0]!.r;
  }
  async function read(kind: string, target?: string) {
    return GET(
      new Request(`http://localhost/api/store?kind=${kind}${target ? '&target=' + target : ''}`),
    );
  }
  mocks.client.mockImplementation(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: subject } }, error: null }) },
    rpc: async (
      _name: string,
      params: { p_country: string; p_kind: string; p_target?: string; p_after?: string },
    ) => {
      try {
        const result = await db.query<{ r: unknown }>(
          'select public.store_purchase_read_v1($1,$2,$3,$4) r',
          [params.p_country, params.p_kind, params.p_target ?? null, params.p_after ?? null],
        );
        return { data: result.rows[0]!.r, error: null };
      } catch (error) {
        return { data: null, error: { code: (error as { code: string }).code } };
      }
    },
  }));
  try {
    await db.exec(
      readFileSync('supabase/tests/store_purchase.test.sql', 'utf8').split('-- FIXTURE END.')[0]! +
        '\ncommit;',
    );
    await actor(customer);
    expect(
      (await db.query<{ r: { status: string } }>("select public.store_shop_v1('EG') r")).rows[0]!.r
        .status,
    ).toBe('AVAILABLE');
    const cart = await command('cart', 0, null, {
      items: [{ listingId: '98000000-0000-4000-8000-000000000003', revision: 2, quantity: 1 }],
    });
    const placed = await command('checkout', cart.revision, null, {
      contractId: '99000000-0000-4000-8000-000000000001',
      contractRevision: 1,
      method: 'CASH',
      address: {
        name: 'Synthetic',
        phone: 'Synthetic',
        region: 'SYNTHETIC-REGION',
        line: 'Synthetic only',
      },
    });
    await actor(staff);
    let revision = placed.revision;
    for (const action of ['accept', 'send', 'prepare', 'dispatch', 'deliver'])
      revision = (await command(action, revision, placed.id)).revision;
    revision = (
      await command('report_cash', revision, placed.id, {
        reason: 'Synthetic collection',
        amountMinor: 1200,
        evidenceReference: 'PRIVATE-COLLECTION-EVIDENCE',
      })
    ).revision;
    revision = (
      await command('confirm_cash', revision, placed.id, {
        evidenceReference: 'PRIVATE-FINANCE-VERIFICATION',
      })
    ).revision;
    await command('money_request', revision, placed.id, {
      kind: 'SETTLEMENT',
      amountMinor: 1,
      reference: 'PRIVATE-SETTLEMENT-REFERENCE',
    });
    const staffResponse = await read('order', placed.id);
    expect(staffResponse.status).toBe(200);
    const staffData = await staffResponse.json();
    expect(staffData.supplierEntitlementMinor).toBe(700);
    expect(staffData.entries.length).toBeGreaterThan(0);
    expect(staffData.moneyOperations[0].reference).toBe('PRIVATE-SETTLEMENT-REFERENCE');
    expect(staffData.permissions.settle).toBe(true);
    await actor(customer);
    for (const kind of ['order', 'orders', 'cart']) {
      const response = await read(kind, kind === 'order' ? placed.id : undefined);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      const data = await response.json();
      const serialized = JSON.stringify(data);
      expect(serialized).not.toMatch(
        /supplierEntitlementMinor|supplier_id|supplierId|supplier_name|agreement_id|unit_cost|unitEntitlement|commercial_snapshot|PRIVATE-|97000000-0000-4000-8000/,
      );
      if (kind === 'order') {
        expect(data.moneyOperations).toEqual([]);
        expect(data.entries).toEqual([]);
        expect(data.permissions).toEqual({});
        expect(data.fulfillmentState).toBe('DELIVERED');
        expect(
          data.events.every(
            (event: Record<string, unknown>) => Object.keys(event).sort().join(',') === 'action,at',
          ),
        ).toBe(true);
      }
    }
    for (const kind of ['admin', 'finance', 'reconciliation'])
      expect((await read(kind)).status).toBe(403);
    await actor('92000000-0000-4000-8000-000000000004');
    expect((await read('order', placed.id)).status).toBe(403);
    await actor('92000000-0000-4000-8000-000000000005');
    expect((await read('order', placed.id)).status).toBe(403);
  } finally {
    await db.close();
    vi.clearAllMocks();
  }
});
