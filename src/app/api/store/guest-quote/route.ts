import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { quoteRequest } from '@/domain/store/quote';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { quoteCatalog, quoteMode } from '@/infrastructure/store/quotes';
import { storeFailure } from '@/infrastructure/store/service';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    if (!quoteMode() || !(await quoteCatalog()).intake_enabled) {
      throw new AppError('forbidden', 'Quote requests unavailable');
    }
    const { request_id, items, ...contact } = quoteRequest.parse(await readJson(request));
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc('store_submit_quote', {
      p_request: request_id,
      p_contact: contact,
      p_items: items,
    });
    if (error?.code === 'P4091') throw new AppError('request_changed', 'Request already used');
    if (error?.code === 'PT429') throw new AppError('rate_limited', 'Please retry later');
    if (error) storeFailure(error.code);
    return {
      reference: z
        .string()
        .regex(/^Q-[a-f0-9]{32}$/)
        .parse(data),
    };
  }, 201);
}
