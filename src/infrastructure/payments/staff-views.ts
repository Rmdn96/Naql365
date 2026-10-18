import 'server-only';
import { z } from 'zod';
import { staffMarket } from '@/infrastructure/identity/staff-market';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { financeRow, paymentStates } from '@/domain/payments/model';
import { paymentFailure } from './service';
import { AppError } from '@/domain/shared/errors';
import { getPayment } from './service';

export async function staffPayment(orderId: string) {
  z.uuid().parse(orderId);
  const { organizationId, market } = await staffMarket('finance.read');
  const client = await createSupabaseServerClient();
  // Existing payments RLS permits Finance reads. Scope before invoking the existing detail RPC.
  const match = await client
    .from('payments')
    .select('order_id')
    .eq('organization_id', organizationId)
    .eq('market_id', market.id)
    .eq('order_id', orderId)
    .maybeSingle();
  if (match.error) throw new AppError('internal', 'Payment unavailable');
  if (!match.data) throw new AppError('not_found', 'Payment unavailable');
  return getPayment(orderId);
}

export async function staffBankConfiguration() {
  const { organizationId, market } = await staffMarket('finance.accounts.manage');
  const client = await createSupabaseServerClient();
  // Same existing RLS and fields as bank configuration; constrain before the bounded query.
  const banks = await client
    .from('bank_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('market_id', market.id)
    .order('created_at')
    .order('id')
    .limit(30);
  if (banks.error) throw new AppError('internal', 'Bank configuration unavailable');
  return { organizationId, banks: banks.data, markets: [market] };
}

export async function staffFinanceQueue(input: unknown = {}) {
  const page = z
    .strictObject({
      status: z.enum(paymentStates).optional(),
      marketId: z.uuid().optional(),
      createdAt: z.iso.datetime({ offset: true }).optional(),
      id: z.uuid().optional(),
    })
    .refine((p) => Boolean(p.createdAt) === Boolean(p.id) && (!p.createdAt || Boolean(p.marketId)))
    .parse(input);
  const { organizationId, market } = await staffMarket('finance.read');
  const client = await createSupabaseServerClient();
  const result = await client.rpc('finance_market_queue', {
    p_org: organizationId,
    p_market: market.id,
    ...(page.status ? { p_status: page.status } : {}),
    ...(page.createdAt && page.id && page.marketId === market.id
      ? { p_before_created: page.createdAt, p_before_id: page.id }
      : {}),
  });
  if (result.error) paymentFailure(result.error.code);
  const data = z
    .object({
      items: financeRow.array().max(30),
      nextCursor: z.object({ createdAt: z.string(), id: z.uuid() }).nullable(),
    })
    .parse(result.data);
  return { ...data, marketId: market.id };
}
