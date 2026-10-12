import 'server-only';
import { z } from 'zod';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
const cursor = z.object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() });
const result = z.object({
  items: z
    .array(
      z.object({
        reference: z.string(),
        contactName: z.string(),
        contactPhone: z.string(),
        contactEmail: z.string(),
        serviceAr: z.string().nullable(),
        serviceEn: z.string().nullable(),
        pickupCity: z.string().nullable(),
        deliveryCity: z.string().nullable(),
        journey: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .max(30),
  nextCursor: cursor.nullable(),
});
export async function supportQueue(country: 'SA' | 'EG', before?: string) {
  const access = await staffAccess('support.read');
  if (access.status !== 'authorized') throw new AppError('forbidden', 'Support unavailable');
  const second = await staffAccess('requests.read', access.principal.organizationId);
  if (second.status !== 'authorized') throw new AppError('forbidden', 'Support unavailable');
  const c = await createSupabaseServerClient();
  const market = await c
    .from('markets')
    .select('id')
    .eq('organization_id', access.principal.organizationId)
    .eq('country_code', country)
    .eq('active', true)
    .maybeSingle();
  if (market.error) throw new AppError('internal', 'Market unavailable');
  if (!market.data) return null;
  let page: z.infer<typeof cursor> | undefined;
  if (before) {
    try {
      page = cursor.parse(JSON.parse(before));
    } catch {
      throw new AppError('validation', 'Invalid support page');
    }
  }
  const rows = await c.rpc('support_request_queue', {
    p_org: access.principal.organizationId,
    p_market: market.data.id,
    ...(page ? { p_before_created: page.createdAt, p_before_id: page.id } : {}),
    p_limit: 30,
  });
  if (rows.error)
    throw new AppError(
      rows.error.code === '42501' ? 'forbidden' : 'internal',
      'Support unavailable',
    );
  return result.parse(rows.data);
}
