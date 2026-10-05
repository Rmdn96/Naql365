import 'server-only';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

/** Navigation only; destination pages still enforce their own authorization. */
export async function loginDestination() {
  try {
    return await resolveLoginDestination();
  } catch {
    // Do not log provider exceptions: they can include request/session details.
    return 'server';
  }
}

async function resolveLoginDestination() {
  const client = await createSupabaseServerClient();
  const identity = await client.auth.getUser();
  if (identity.error || !identity.data.user) return 'unauthenticated';
  const memberships = await client
    .from('organization_memberships')
    .select('organization_id,member_type,status')
    .eq('profile_id', identity.data.user.id);
  if (memberships.error) return 'server';
  const active = (memberships.data ?? []).filter((m) => m.status === 'active');
  for (const membership of active.filter((m) => m.member_type === 'staff')) {
    const permission = await client.rpc('has_permission', {
      organization_id: membership.organization_id,
      permission_code: 'portal.access',
    });
    if (permission.error) return 'server';
    if (permission.data === true) return 'portal';
  }
  if (active.some((m) => m.member_type === 'driver')) {
    const driver = await client.rpc('driver_identity');
    if (driver.error) return driver.error.code === '42501' ? 'membership' : 'server';
    if (Array.isArray(driver.data) && driver.data.length > 0) return 'driver';
  }
  const enrollment = await client.rpc('customer_enrollment_state');
  if (enrollment.error) return 'server';
  if (enrollment.data === 'active') return 'account';
  // New confirmed customers complete the existing transactional onboarding form.
  // Never turn an existing staff/driver or inactive membership into a customer.
  if (enrollment.data === 'new' && memberships.data?.length === 0) return 'account';
  if (active.some((m) => m.member_type === 'customer')) return 'provisioning';
  return 'membership';
}
