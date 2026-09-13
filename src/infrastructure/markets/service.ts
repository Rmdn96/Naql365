import 'server-only';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { marketSchema } from '@/domain/markets/model';
import { AppError } from '@/domain/shared/errors';

export async function availableMarkets() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from('markets')
    .select('*')
    .eq('active', true)
    .order('country_code');
  if (error) throw new AppError('internal', 'Market catalogue unavailable');
  return marketSchema.array().parse(data);
}
