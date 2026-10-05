'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import type { Database } from './database.types';
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  if (!env) throw new Error('Supabase environment is not configured');
  return createBrowserClient<Database>(env.url, env.publishableKey, {
    // Match the SSR/proxy scope when browser-side token refresh replaces cookies.
    cookieOptions: { secure: window.location.protocol === 'https:', sameSite: 'lax', path: '/' },
  });
}
