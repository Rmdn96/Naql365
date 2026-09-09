'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isLocale } from '@/i18n/config';
import { appUrl } from '@/infrastructure/config/server-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { assertSameOrigin } from '@/application/identity/smoke-auth';
import { profileInput } from '@/domain/requests/intake';
const credentials = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export type AuthState = { status: 'idle' | 'sent' | 'error'; code?: string };
export async function customerAuth(
  locale: string,
  mode: string,
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!isLocale(locale) || !['login', 'register', 'recover', 'password'].includes(mode))
    return { status: 'error' };
  try {
    assertSameOrigin((await headers()).get('origin'), appUrl().origin);
    const client = await createSupabaseServerClient(true);
    if (mode === 'recover') {
      const email = z.email().max(254).parse(form.get('email'));
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: new URL(`/auth/callback?locale=${locale}&next=/${locale}/password`, appUrl())
          .href,
      });
      return { status: 'sent' };
    }
    if (mode === 'password') {
      const password = credentials.shape.password.parse(form.get('password'));
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return { status: 'error' };
      const changed = await client.auth.updateUser({ password });
      if (changed.error) return { status: 'error' };
      const signedOut = await client.auth.signOut({ scope: 'global' });
      if (signedOut.error) return { status: 'error' };
    } else {
      const parsed = credentials.parse({
        email: form.get('email'),
        password: form.get('password'),
      });
      if (mode === 'register') {
        // Identity only. Metadata has no authorization meaning; verified onboarding is separate.
        await client.auth.signUp({
          ...parsed,
          options: { emailRedirectTo: new URL(`/auth/callback?locale=${locale}`, appUrl()).href },
        });
        // Same result for existing accounts/provider rejection; never enumerate identities.
        return { status: 'sent' };
      }
      const { error } = await client.auth.signInWithPassword(parsed);
      if (error) return { status: 'error' };
    }
  } catch {
    return { status: 'error' };
  }
  redirect(`/${locale}/${mode === 'password' ? 'login' : 'account'}`);
}
export async function customerProfile(
  locale: string,
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!isLocale(locale)) return { status: 'error' };
  try {
    assertSameOrigin((await headers()).get('origin'), appUrl().origin);
    const profile = profileInput.parse({
      name: form.get('name'),
      phone: form.get('phone'),
      locale: form.get('locale'),
    });
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { status: 'error' };
    const result = await client.rpc('onboard_customer', {
      p_name: profile.name,
      p_phone: profile.phone,
      p_locale: profile.locale,
    });
    if (result.error) return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
  redirect(`/${locale}/account`);
}
export async function customerLogout(locale: string) {
  if (!isLocale(locale)) throw new Error('Invalid locale');
  assertSameOrigin((await headers()).get('origin'), appUrl().origin);
  const client = await createSupabaseServerClient(true);
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Sign-out failed');
  redirect(`/${locale}/login`);
}
