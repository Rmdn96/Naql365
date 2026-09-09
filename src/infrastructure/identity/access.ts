import 'server-only';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { authorize } from '@/application/identity/authorize';
import { AppError } from '@/domain/shared/errors';
import type { AuthorizationPort } from '@/domain/identity/authorization';

export async function portalAccess(permission: string, organizationId?: string) {
  if (!getPublicEnv()) return { status: 'unconfigured' } as const;
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { status: 'unauthenticated' } as const;
  const membershipQuery = client.from('organization_memberships').select('organization_id').eq('profile_id', data.user.id).eq('status', 'active');
  const { data: memberships, error: membershipError } = await (organizationId ? membershipQuery.eq('organization_id', organizationId) : membershipQuery);
  if (membershipError) throw new AppError('internal', 'Unable to read membership');
  const port: AuthorizationPort = {
    async hasPermission(principal, permissionCode) {
      if (principal.userId !== data.user.id) return false;
      const { data: allowed, error: permissionError } = await client.rpc('has_permission', { organization_id: principal.organizationId, permission_code: permissionCode });
      if (permissionError) throw new AppError('internal', 'Unable to verify permission');
      return allowed === true;
    },
  };
  for (const membership of memberships ?? []) {
    try {
      const principal = await authorize(port, { userId: data.user.id, organizationId: membership.organization_id }, permission);
      return { status: 'authorized', principal } as const;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'forbidden') throw error;
    }
  }
  return { status: 'forbidden' } as const;
}
