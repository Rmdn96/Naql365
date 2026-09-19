'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isLocale } from '@/i18n/config';
import { assertSameOrigin } from '@/application/identity/smoke-auth';
import { appUrl } from '@/infrastructure/config/server-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
export async function driverLogin(
  locale: string,
  _previous: { error: boolean },
  form: FormData,
): Promise<{ error: boolean }> {
  if (!isLocale(locale)) return { error: true };
  try {
    assertSameOrigin((await headers()).get('origin'), appUrl().origin);
    const credentials = z
      .strictObject({ email: z.email().max(254), password: z.string().min(12).max(128) })
      .parse({ email: form.get('email'), password: form.get('password') });
    const client = await createSupabaseServerClient(true);
    const signed = await client.auth.signInWithPassword(credentials);
    if (signed.error) return { error: true };
    const identity = await client.rpc('driver_identity');
    if (identity.error || !Array.isArray(identity.data) || !identity.data.length) {
      await client.auth.signOut({ scope: 'local' });
      return { error: true };
    }
  } catch {
    return { error: true };
  }
  redirect(`/${locale}/driver`);
}
export async function driverLogout(locale: string) {
  if (!isLocale(locale)) throw new Error('Invalid locale');
  assertSameOrigin((await headers()).get('origin'), appUrl().origin);
  const client = await createSupabaseServerClient(true);
  const result = await client.auth.signOut({ scope: 'local' });
  if (result.error) throw new Error('Sign out failed');
  redirect(`/${locale}/driver/login`);
}
