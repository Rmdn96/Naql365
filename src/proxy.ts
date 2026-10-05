import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { isLocale } from '@/i18n/config';
import { legalKind, legalContent } from '@/domain/legal/content';

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
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self'",
    `connect-src 'self'${env ? ` ${new URL(env.url).origin} ${new URL(env.url).origin.replace(/^http/, 'ws')}` : ''}${process.env.NODE_ENV === 'development' ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  let response = NextResponse.next({ request: { headers } });
  // Every localized page has session-aware navigation. Refresh once here,
  // preserving the provider's cookie attributes on both request and response.
  if (env) {
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
  const segments = request.nextUrl.pathname.split('/');
  if (segments[2] === 'legal') {
    const kind = legalKind.safeParse(segments[3]);
    if (!kind.success || !legalContent(kind.data, locale)) {
      // Reject before streaming starts: unpublished legal content must be a real 404.
      response = new NextResponse(locale === 'ar' ? 'الصفحة غير موجودة' : 'Page not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'Content-Security-Policy': csp,
        },
      });
    }
  }
  return response;
}
export const config = { matcher: ['/', '/ar/:path*', '/en/:path*'] };
