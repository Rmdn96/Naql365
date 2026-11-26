import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { quoteProduct } from '@/domain/store/quote';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

export function quoteMode() {
  return process.env.NAQL365_STORE_QUOTE_MODE === 'true';
}

export const quoteCatalog = cache(async () => {
  if (!getPublicEnv()) return { enabled: false, items: [] };
  const client = await createSupabaseServerClient();
  const result = await client.rpc('store_quote_catalog');
  if (result.error) return { enabled: false, items: [] };
  return z.object({ enabled: z.boolean(), items: quoteProduct.array() }).parse(result.data);
});
