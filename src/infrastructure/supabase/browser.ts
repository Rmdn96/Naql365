'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import type { Database } from './database.types';
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  if (!env) throw new Error('Supabase environment is not configured');
  return createBrowserClient<Database>(env.url, env.publishableKey);
}
