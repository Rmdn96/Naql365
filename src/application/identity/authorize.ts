import { AppError } from '@/domain/shared/errors';
import { entityId } from '@/domain/shared/validation';
import type { AuthorizationPort, Principal } from '@/domain/identity/authorization';

export async function authorize(port: AuthorizationPort, principal: Principal | null, permission: string): Promise<Principal> {
  if (!principal) throw new AppError('unauthenticated', 'Authentication required');
  if (!entityId.safeParse(principal.organizationId).success || !entityId.safeParse(principal.userId).success)
    throw new AppError('validation', 'Invalid principal');
  if (!await port.hasPermission(principal, permission)) throw new AppError('forbidden', 'Permission required');
  return principal;
}
