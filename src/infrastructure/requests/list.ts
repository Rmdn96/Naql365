import 'server-only';
import type { Locale } from '@/i18n/config';
import { customerPage } from './page-access';
export async function customerRequests(locale: Locale, page = 1) {
  const { client, customers } = await customerPage(locale);
  const { data, error } = await client
    .from('requests')
    .select(
      'id,markets(name_ar,name_en,timezone,currency),status,reference,created_at,preferred_date,services(name_ar,name_en),request_locations(kind,city)',
    )
    .in(
      'customer_id',
      customers.map((c) => c.id),
    )
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 20, page * 20);
  if (error) throw new Error('Request list unavailable');
  return data;
}
