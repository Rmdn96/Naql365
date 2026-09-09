import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { appUrl } from '@/infrastructure/config/server-env';
import { safeRedirect } from '@/application/identity/redirects';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const origin = appUrl();
  if (code && code.length <= 2048 && getPublicEnv()) {
    const client = await createSupabaseServerClient(true);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(
        new URL(safeRedirect(request.nextUrl.searchParams.get('next'), locale), origin),
      );
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }
  }
  const response = NextResponse.redirect(new URL(`/${locale}/login`, origin));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
