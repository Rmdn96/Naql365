import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { marketCookie, publicCountry } from '@/domain/markets/public-contact';
import { staffAccess } from './staff-context';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';

/** A display preference selects an existing authorized Market; it never grants access. */
export async function staffMarket(permission: string) {
  const access = await staffAccess(permission);
  if (access.status !== 'authorized')
    throw new AppError(
      access.status === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
      'Workspace unavailable',
    );
  const selection = publicCountry.safeParse((await cookies()).get(marketCookie)?.value ?? 'SA');
  if (!selection.success) throw new AppError('forbidden', 'Market unavailable');
  const client = await createSupabaseServerClient();
  const organizationId = access.principal.organizationId;
  const result = await client
    .from('markets')
    .select('id,organization_id,country_code,name_ar,name_en,currency')
    .eq('organization_id', organizationId)
    .eq('country_code', selection.data)
    .eq('active', true)
    .maybeSingle();
  if (result.error) throw new AppError('internal', 'Market unavailable');
  const market = z
    .object({
      id: z.uuid(),
      organization_id: z.literal(organizationId),
      country_code: z.literal(selection.data),
      name_ar: z.string(),
      name_en: z.string(),
      currency: z.enum(['SAR', 'EGP']),
    })
    .safeParse(result.data);
  if (!market.success) throw new AppError('forbidden', 'Market unavailable');
  return { organizationId, market: market.data };
}

export async function staffDisplayContext() {
  const context = await staffMarket('portal.access');
  const client = await createSupabaseServerClient();
  const organization = await client
    .from('organizations')
    .select('name')
    .eq('id', context.organizationId)
    .maybeSingle();
  if (organization.error) throw new AppError('internal', 'Workspace unavailable');
  const display = z.object({ name: z.string().min(1) }).safeParse(organization.data);
  if (!display.success) throw new AppError('forbidden', 'Workspace unavailable');
  return { ...context, organizationName: display.data.name };
}
