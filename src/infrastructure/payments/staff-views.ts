import 'server-only';
import { z } from 'zod';
import { staffMarket } from '@/infrastructure/identity/staff-market';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
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
