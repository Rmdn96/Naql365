import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
import { guestSecret } from '@/domain/guest/capability';
import { guestDatabaseError } from './session';
const command = z.strictObject({
  requestId: z.uuid(),
  action: z.enum(['inspect', 'replace', 'revoke']),
});
const result = z.object({
  guest: z.boolean(),
  active: z.boolean().optional(),
  token: guestSecret.nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});
export async function manageGuestLink(input: unknown) {
  const p = command.parse(input),
    client = await createSupabaseServerClient(p.action !== 'inspect');
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) throw new AppError('unauthenticated', 'Sign in required');
  // The database checks active membership, dedicated permission and exact tenant.
  const response = await client.rpc('manage_guest_link', {
    p_request: p.requestId,
    p_action: p.action,
  });
  if (response.error) guestDatabaseError(response.error.code);
  return result.parse(response.data);
}
