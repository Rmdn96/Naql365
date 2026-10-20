import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { getPublicEnv } from '@/infrastructure/config/public-env';
import { AppError } from '@/domain/shared/errors';
import { storeCatalog, storeCommand, storeReadKind } from '@/domain/store/model';
import { catalogTrace, catalogIssueFields } from './catalog-trace';

export function storeFailure(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Store access unavailable');
  if (['PT409', '40001', '23505', '55000'].includes(code))
    throw new AppError('conflict', 'Store state changed');
  if (['22023', '22P02', '23514', '23503', '22003', '23502'].includes(code))
    throw new AppError('validation', 'Invalid Store input');
  throw new AppError('network', 'Store temporarily unavailable');
}
// Missing migration/configuration must not interrupt the accepted Transport shell.
// This is visibility only: public catalog and checkout independently enforce scope.
export const storeIsAvailable = cache(async () => {
  if (!getPublicEnv() || (await selectedPublicCountry()) !== 'EG') return false;
  try {
    const c = await createSupabaseServerClient();
    const r = await c.rpc('store_shop_v1', { p_country: 'EG', p_kind: 'categories' });
    return !r.error && z.object({ status: z.string() }).parse(r.data).status === 'AVAILABLE';
  } catch {
    return false;
  }
});
export async function storeShop(
  input: { after?: string; search?: string; slug?: string; category?: string } = {},
) {
  const environment = getPublicEnv();
  catalogTrace({
    stage: 'configuration',
    configured: !!environment,
    loopback:
      !!environment && ['localhost', '127.0.0.1'].includes(new URL(environment.url).hostname),
    ...(environment
      ? {
          backendPort:
            Number(new URL(environment.url).port) ||
            (environment.url.startsWith('https:') ? 443 : 80),
        }
      : {}),
  });
  if (!environment) return { status: 'NOT_AVAILABLE' as const, items: [], nextCursor: null };
  const query = z
    .object({
      after: z.string().max(100).optional(),
      search: z.string().max(120).optional(),
      slug: z.string().max(100).optional(),
      category: z.string().max(100).optional(),
    })
    .parse(input);
  const c = await createSupabaseServerClient();
  const country = await selectedPublicCountry();
  catalogTrace({ stage: 'request', country });
  const r = await c.rpc('store_shop_v1', {
    p_country: country,
    ...(query.after ? { p_after: query.after } : {}),
    ...(query.search ? { p_search: query.search } : {}),
    ...(query.slug ? { p_slug: query.slug } : {}),
    ...(query.category ? { p_category: query.category } : {}),
  });
  catalogTrace({
    stage: 'rpc',
    httpStatus: r.status,
    rpcError: !!r.error,
    ...(r.error?.code && /^[A-Z0-9]{5,10}$/.test(r.error.code) ? { code: r.error.code } : {}),
  });
  if (r.error) storeFailure(r.error.code);
  const projection = storeCatalog.safeParse(r.data);
  catalogTrace({
    stage: 'projection',
    valid: projection.success,
    ...(projection.success
      ? { available: projection.data.status === 'AVAILABLE', items: projection.data.items.length }
      : { invalidFields: catalogIssueFields(projection.error.issues) }),
  });
  if (!projection.success) throw projection.error;
  return projection.data;
}
export async function storeCategories() {
  if (!getPublicEnv()) return [];
  const c = await createSupabaseServerClient();
  const r = await c.rpc('store_shop_v1', {
    p_country: await selectedPublicCountry(),
    p_kind: 'categories',
  });
  if (r.error) storeFailure(r.error.code);
  return z
    .object({
      items: z
        .object({
          slug: z.string(),
          content: z.object({ title_ar: z.string(), title_en: z.string() }),
        })
        .array()
        .max(20),
    })
    .parse(r.data).items;
}
export async function storeRead(
  kind: z.infer<typeof storeReadKind>,
  target?: string,
  after?: string,
) {
  const c = await createSupabaseServerClient();
  const u = await c.auth.getUser();
  if (u.error || !u.data.user) throw new AppError('unauthenticated', 'Sign in required');
  const r = await c.rpc('store_purchase_read_v1', {
    p_country: await selectedPublicCountry(),
    p_kind: storeReadKind.parse(kind),
    ...(target ? { p_target: z.uuid().parse(target) } : {}),
    ...(after ? { p_after: z.uuid().parse(after) } : {}),
  });
  if (r.error) storeFailure(r.error.code);
  return r.data;
}
export async function storeExecute(input: unknown) {
  const p = storeCommand.parse(input),
    c = await createSupabaseServerClient(true);
  const u = await c.auth.getUser();
  if (u.error || !u.data.user) throw new AppError('unauthenticated', 'Sign in required');
  const r = await c.rpc('store_purchase_command_v1', {
    p_country: await selectedPublicCountry(),
    p_action: p.action,
    p_mutation: p.mutationId,
    p_revision: p.revision,
    ...(p.target ? { p_target: p.target } : {}),
    p_payload: p.payload,
  });
  if (r.error) storeFailure(r.error.code);
  return r.data;
}
