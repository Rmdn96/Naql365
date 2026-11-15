import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { appUrl } from '@/infrastructure/config/server-env';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const locale = params.get('locale') === 'en' ? 'en' : 'ar';
  const origin = appUrl();
  // Admin invitations do not carry a browser PKCE verifier. Only the explicitly
  // supported invite token flow may establish a session without an auth code.
  const invite =
    !params.has('code') &&
    params.getAll('token_hash').length === 1 &&
    params.getAll('type').length === 1 &&
    params.get('type') === 'invite' &&
    !!tokenHash &&
    tokenHash.length <= 2048;
  const pkce = !params.has('token_hash') && !!code && code.length <= 2048;
  if ((invite || pkce) && getPublicEnv()) {
    const client = await createSupabaseServerClient(true);
    const { error } = invite
      ? await client.auth.verifyOtp({ token_hash: tokenHash!, type: 'invite' })
      : await client.auth.exchangeCodeForSession(code!);
    if (!error) {
      const response = NextResponse.redirect(
        new URL(
          invite || params.get('next') === `/${locale}/password`
            ? `/${locale}/password`
            : `/${locale}/auth-complete`,
          origin,
        ),
      );
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    }
  }
  const response = NextResponse.redirect(
    new URL(`/${locale}/login?notice=confirmation-link`, origin),
  );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
