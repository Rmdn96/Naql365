import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { isLocale } from '@/i18n/config';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/') return NextResponse.redirect(new URL('/ar', request.url));
  const locale = request.nextUrl.pathname.split('/')[1] ?? '';
  if (!isLocale(locale)) return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const env = getPublicEnv();
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${env ? ` ${new URL(env.url).origin}` : ''}${process.env.NODE_ENV === 'development' ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  const protectedRoute = /^\/(ar|en)\/(account|portal|driver|login)(\/|$)/.test(
    request.nextUrl.pathname,
  );
  if (env && protectedRoute) {
    const client = createServerClient(env.url, env.publishableKey, {
      cookieOptions: { secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/' },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          for (const { name, value } of values) request.cookies.set(name, value);
          headers.set('cookie', request.cookies.toString());
          response = NextResponse.next({ request: { headers } });
          for (const { name, value, options } of values) response.cookies.set(name, value, options);
        },
      },
    });
    await client.auth.getClaims();
  }
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/', '/ar/:path*', '/en/:path*'] };
