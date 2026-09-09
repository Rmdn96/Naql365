'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { appUrl } from '@/infrastructure/config/server-env';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { assertSameOrigin, smokeSignIn } from '@/application/identity/smoke-auth';

export async function smokeLogin(
  locale: string,
  _previous: { failed: boolean },
  form: FormData,
): Promise<{ failed: boolean }> {
  if (!isLocale(locale) || !stagingAuthEnabled() || !getPublicEnv()) return { failed: true };
  try {
    assertSameOrigin((await headers()).get('origin'), appUrl().origin);
    const client = await createSupabaseServerClient(true);
    await smokeSignIn(
      {
        async signIn(email, password) {
          return !(await client.auth.signInWithPassword({ email, password })).error;
        },
        async signOut() {
          return !(await client.auth.signOut({ scope: 'local' })).error;
        },
      },
      { email: form.get('email'), password: form.get('password') },
    );
  } catch {
    return { failed: true };
  }
  redirect(`/${locale}/account`);
}

export async function smokeLogout(locale: string) {
  if (!isLocale(locale) || !stagingAuthEnabled()) throw new Error('Auth smoke unavailable');
  assertSameOrigin((await headers()).get('origin'), appUrl().origin);
  const client = await createSupabaseServerClient(true);
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Sign-out failed');
  redirect(`/${locale}/login`);
}
