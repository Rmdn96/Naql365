import { quoteMode } from '@/infrastructure/store/quotes';
import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { guestCheckout } from '@/domain/store/guest-checkout';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { storeFailure } from '@/infrastructure/store/service';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    if (quoteMode()) throw new AppError('forbidden', 'Fixed-price checkout unavailable');
    const { request_id, ...payload } = guestCheckout.parse(await readJson(request));
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc('store_guest_checkout_v1', {
      p_request: request_id,
      p_payload: payload,
    });
    if (error?.code === 'P4091') throw new AppError('request_changed', 'Request already used');
    if (error?.code === 'PT429') throw new AppError('rate_limited', 'Please retry later');
    if (error) storeFailure(error.code);
    return z.strictObject({ reference: z.string().regex(/^S-[a-f0-9]{32}$/) }).parse(data);
  }, 201);
}
