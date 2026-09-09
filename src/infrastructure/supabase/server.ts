import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import type { Database } from './database.types';

export async function createSupabaseServerClient(writableCookies = false) {
  const env = getPublicEnv();
  if (!env) throw new Error('Supabase environment is not configured');
  const store = await cookies();
  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        // Server Components are read-only. Proxy owns refresh; handlers explicitly opt in.
        if (writableCookies) for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });
}
