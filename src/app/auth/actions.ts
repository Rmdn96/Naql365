'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { appUrl } from '@/infrastructure/config/server-env';
import { stagingAuthEnabled } from '@/infrastructure/config/deployment-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { assertSameOrigin, smokeSignIn } from '@/application/identity/smoke-auth';
import { signInInput } from '@/domain/shared/validation';

export async function smokePkceLogin(
  locale: string,
  _previous: { submitted: boolean },
  form: FormData,
): Promise<{ submitted: boolean }> {
  if (!isLocale(locale) || !stagingAuthEnabled() || !getPublicEnv()) return { submitted: false };
  assertSameOrigin((await headers()).get('origin'), appUrl().origin);
  const email = signInInput.shape.email.safeParse(form.get('email'));
  if (!email.success) return { submitted: false };
  const client = await createSupabaseServerClient(true);
  // SSR persists the PKCE verifier; only existing, controlled Staging identities can sign in.
  await client.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: new URL(`/auth/callback?locale=${locale}`, appUrl()).href,
    },
  });
  // Do not disclose account existence or provider errors.
  return { submitted: true };
}

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
