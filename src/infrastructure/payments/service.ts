import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
import {
  paymentCommand,
  paymentDetails,
  paymentResult,
  financeRow,
  clearance,
  paymentStates,
  bankConfiguration,
} from '@/domain/payments/model';

async function client(writable = false) {
  const c = await createSupabaseServerClient(writable);
  const user = await c.auth.getUser();
  if (user.error || !user.data.user) throw new AppError('unauthenticated', 'Sign in required');
  return c;
}
export function paymentFailure(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Payment unavailable');
  if (['55000', '40001', '23505'].includes(code))
    throw new AppError('conflict', 'Refresh payment state');
  if (['22023', '22P02', '23514', '23503'].includes(code))
    throw new AppError('validation', 'Invalid payment input');
  throw new AppError('internal', 'Payment unavailable');
}
export async function getPayment(orderId: string) {
  const c = await client();
  const result = await c.rpc('payment_details', { p_order: z.uuid().parse(orderId) });
  if (result.error) paymentFailure(result.error.code);
  return paymentDetails.parse(result.data);
}
export async function executePayment(input: unknown) {
  const command = paymentCommand.parse(input),
    c = await client(true);
  const result = await c.rpc('payment_command', {
    p_order: command.orderId,
    p_action: command.action,
    p_mutation: command.mutationId,
    p_revision: command.revision,
    p_payload: command.payload,
  });
  if (result.error) paymentFailure(result.error.code);
  return paymentResult.parse(result.data);
}
export async function getFinanceQueue(input: unknown) {
  const q = z
    .strictObject({
      organizationId: z.uuid(),
      status: z.enum(paymentStates).optional(),
      offset: z.number().int().min(0).max(10000).default(0),
    })
    .parse(input);
  const c = await client();
  const result = await c.rpc('finance_queue', {
    p_org: q.organizationId,
    p_offset: q.offset,
    ...(q.status ? { p_status: q.status } : {}),
  });
  if (result.error) paymentFailure(result.error.code);
  return financeRow.array().max(30).parse(result.data);
}
export async function getPaymentClearance(tripId: string) {
  const c = await client();
  const result = await c.rpc('payment_clearance', { p_trip: z.uuid().parse(tripId) });
  if (result.error) paymentFailure(result.error.code);
  return clearance.parse(result.data);
}
export async function signTransferProof(attemptId: string) {
  const c = await client();
  const result = await c.rpc('transfer_proof_path', { p_attempt: z.uuid().parse(attemptId) });
  if (result.error) paymentFailure(result.error.code);
  const file = z
    .object({
      bucket: z.literal('documents'),
      path: z.string(),
      mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
    })
    .parse(result.data);
  // Download disposition keeps uploaded PDFs away from the application's origin.
  const signed = await c.storage.from(file.bucket).createSignedUrl(file.path, 60, {
    download: file.mime === 'application/pdf' ? 'transfer-proof.pdf' : 'transfer-proof.png',
  });
  if (signed.error) throw new AppError('forbidden', 'Proof unavailable');
  return { url: signed.data.signedUrl, expiresIn: 60 };
}
export async function configureBank(input: unknown) {
  const p = bankConfiguration.parse(input),
    c = await client(true);
  const result = await c.rpc('configure_bank_account', {
    p_org: p.organizationId,
    p_market: p.marketId,
    p_id: p.id,
    p_revision: p.revision,
    p_mutation: p.mutationId,
    p_details: p.details,
  });
  if (result.error) paymentFailure(result.error.code);
  return z.object({ id: z.uuid(), revision: z.number().int() }).parse(result.data);
}
export async function getBankConfiguration(organizationId: string) {
  const c = await client(),
    org = z.uuid().parse(organizationId);
  const authority = await c.rpc('has_permission', {
    organization_id: org,
    permission_code: 'finance.accounts.manage',
  });
  if (authority.error || authority.data !== true)
    throw new AppError('forbidden', 'Bank configuration denied');
  const [banks, markets] = await Promise.all([
    c.from('bank_accounts').select('*').eq('organization_id', org).order('created_at').limit(30),
    c
      .from('markets')
      .select('id,name_ar,name_en,currency')
      .eq('organization_id', org)
      .eq('active', true)
      .limit(20),
  ]);
  if (banks.error || markets.error)
    throw new AppError('internal', 'Bank configuration unavailable');
  return { banks: banks.data, markets: markets.data };
}
