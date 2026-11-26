'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isLocale } from '@/i18n/config';
import { assertSameOrigin } from '@/application/identity/smoke-auth';
import { appUrl } from '@/infrastructure/config/server-env';
import { quoteMode } from '@/infrastructure/store/quotes';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

export async function changeQuote(
  locale: string,
  id: string,
  revision: number,
  confirm: boolean,
  _previous: string,
  form: FormData,
) {
  if (!isLocale(locale) || !quoteMode()) return 'error';
  try {
    assertSameOrigin((await headers()).get('origin'), appUrl().origin);
    const p_id = z.uuid().parse(id);
    const p_revision = z.number().int().nonnegative().parse(revision);
    const toMinor = (input: FormDataEntryValue | null) => {
      const value = z
        .string()
        .regex(/^(0|[1-9][0-9]{0,6})(\.[0-9]{1,2})?$/)
        .parse(input);
      return Math.round(Number(value) * 100);
    };
    const details = confirm
      ? { p_confirmation: z.string().trim().min(1).max(200).parse(form.get('evidence')) }
      : {
          p_offer: {
            delivery: toMinor(form.get('delivery')),
            prices: Object.fromEntries(
              Array.from(form)
                .filter(([key]) => key.startsWith('sku:'))
                .map(([key, value]) => [key.slice(4), toMinor(value)]),
            ),
          },
        };
    const client = await createSupabaseServerClient();
    const result = await client.rpc('store_review_quote', { p_id, p_revision, ...details });
    if (result.error) return 'error';
  } catch {
    return 'error';
  }
  revalidatePath('/' + locale + '/portal/store/orders');
  return 'saved';
}

export async function approveQuoteProduct(
  locale: string,
  id: string,
  revision: number,
  _previous: string,
  form: FormData,
) {
  if (!isLocale(locale) || !quoteMode()) return 'error';
  try {
    assertSameOrigin((await headers()).get('origin'), appUrl().origin);
    const action = z.enum(['publish', 'withdraw']).parse(form.get('action'));
    if (action === 'publish' && form.get('confirmed') !== 'on') return 'error';
    const client = await createSupabaseServerClient();
    const result = await client.rpc('store_approve_quote_product', {
      p_product: z.uuid().parse(id),
      p_revision: z.number().int().positive().parse(revision),
      p_approved: action === 'publish',
    });
    if (result.error) return 'error';
  } catch {
    return 'error';
  }
  revalidatePath('/' + locale + '/portal/store/catalog');
  revalidatePath('/' + locale);
  return 'saved';
}
