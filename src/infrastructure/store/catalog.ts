import 'server-only';
import { z } from 'zod';
import { staffMarket } from '@/infrastructure/identity/staff-market';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { storeFailure } from './service';
import { AppError } from '@/domain/shared/errors';
export const catalogKind = z.enum(['products', 'categories', 'listings', 'prices']);
export async function storeCatalogAdmin(kind: unknown, after?: string) {
  const context = await staffMarket('store.catalog.read');
  if (context.market.country_code !== 'EG') throw new AppError('forbidden', 'Egypt Store only');
  const c = await createSupabaseServerClient();
  const r = await c.rpc('store_catalog_workspace_v1', {
    p_org: context.organizationId,
    p_market: context.market.id,
    p_kind: catalogKind.parse(kind),
    ...(after ? { p_after: z.uuid().parse(after) } : {}),
  });
  if (r.error) storeFailure(r.error.code);
  const access = await Promise.all(
    ['store.catalog.manage', 'store.catalog.publish'].map((p) =>
      staffAccess(p, context.organizationId),
    ),
  );
  return {
    page: z
      .object({
        items: z
          .object({
            id: z.uuid(),
            revision: z.number().int(),
            state: z.string(),
            slug: z.string().optional(),
            sku: z.string().optional(),
            content: z.object({ title_ar: z.string(), title_en: z.string() }).optional(),
            publishedContent: z
              .object({ title_ar: z.string(), title_en: z.string() })
              .nullable()
              .optional(),
            amountMinor: z.number().nullable().optional(),
            listingId: z.uuid().optional(),
            productId: z.uuid().optional(),
            parentId: z.uuid().nullable().optional(),
          })
          .array()
          .max(20),
        nextCursor: z.uuid().nullable(),
      })
      .parse(r.data),
    manage: access[0]?.status === 'authorized',
    publish: access[1]?.status === 'authorized',
  };
}
export async function storeCatalogExecute(input: unknown) {
  const p = z
    .strictObject({
      family: z.enum(['draft', 'publication']),
      operation: z.enum([
        'create_category',
        'save_category',
        'create_product',
        'save_product',
        'create_listing',
        'create_price',
        'suspend_listing',
        'suspend_product',
        'resume_product',
        'approve_category',
        'approve_price',
        'publish_listing',
      ]),
      mutationId: z.uuid(),
      target: z.uuid().optional(),
      revision: z.number().int().positive().optional(),
      payload: z.record(z.string(), z.json()),
    })
    .parse(input);
  const context = await staffMarket('store.catalog.manage');
  if (context.market.country_code !== 'EG') throw new AppError('forbidden', 'Egypt Store only');
  const c = await createSupabaseServerClient(true),
    args = {
      p_country: 'EG',
      p_family: p.family,
      p_operation: p.operation,
      p_mutation: p.mutationId,
      ...(p.target ? { p_target: p.target } : {}),
      ...(p.revision ? { p_expected: p.revision } : {}),
      p_payload: p.payload,
    };
  const r = await c.rpc('store_catalog_ui_command_v1', args);
  if (r.error) storeFailure(r.error.code);
  return r.data;
}
