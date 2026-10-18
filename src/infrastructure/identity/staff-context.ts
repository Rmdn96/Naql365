import 'server-only';
import { cache } from 'react';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { portalAccess } from './access';
import { AppError } from '@/domain/shared/errors';
// Request-scoped only. Ambiguous organizations never combine module grants.
export const staffContext = cache(async () => {
  if (!getPublicEnv()) return { status: 'unconfigured' } as const;
  const client = await createSupabaseServerClient();
  const identity = await client.auth.getUser();
  if (identity.error || !identity.data.user) return { status: 'unauthenticated' } as const;
  const memberships = await client
    .from('organization_memberships')
    .select('organization_id,member_type')
    .eq('profile_id', identity.data.user.id)
    .eq('status', 'active');
  if (memberships.error) throw new AppError('internal', 'Workspace context unavailable');
  if (memberships.data.length !== 1 || memberships.data[0]?.member_type !== 'staff')
    return { status: 'forbidden' } as const;
  return portalAccess('portal.access', memberships.data[0]!.organization_id);
});
export async function staffAccess(permission: string, organizationId?: string) {
  const context = await staffContext();
  if (context.status !== 'authorized') return context;
  if (organizationId && organizationId !== context.principal.organizationId)
    return { status: 'forbidden' } as const;
  return portalAccess(permission, context.principal.organizationId);
}
export const staffModules = cache(async () => {
  const context = await staffContext();
  if (context.status !== 'authorized')
    return {
      context,
      sales: false,
      operations: false,
      finance: false,
      banks: false,
      support: false,
    };
  const results = await Promise.all(
    [
      'pricing.calculate',
      'operations.manage',
      'finance.read',
      'finance.accounts.manage',
      'support.read',
      'requests.read',
    ].map((p) => staffAccess(p, context.principal.organizationId)),
  );
  const allowed = results.map((r) => r.status === 'authorized');
  return {
    context,
    sales: allowed[0],
    operations: allowed[1],
    finance: allowed[2],
    banks: allowed[3],
    support: allowed[4] && allowed[5],
  };
});
