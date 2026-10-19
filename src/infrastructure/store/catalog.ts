import 'server-only';
import { z } from 'zod';
import { staffMarket } from '@/infrastructure/identity/staff-market';
import { staffAccess } from '@/infrastructure/identity/staff-context';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { storeFailure } from './service';
import { AppError } from '@/domain/shared/errors';
export const catalogKind = z.enum([
  'products',
  'categories',
  'listings',
  'prices',
  'references',
  'offers',
  'suppliers',
  'agreements',
  'policies',
]);
export async function storeCatalogAdmin(kind: unknown, after?: string, search = '', state = '') {
  const context = await staffMarket('store.catalog.read');
  if (context.market.country_code !== 'EG') throw new AppError('forbidden', 'Egypt Store only');
  const c = await createSupabaseServerClient();
  const r = await c.rpc('store_catalog_admin_v2', {
    p_org: context.organizationId,
    p_market: context.market.id,
    p_kind: catalogKind.parse(kind),
    p_search: z.string().max(120).parse(search),
    p_state: z
      .enum(['', 'ACTIVE', 'SUSPENDED', 'DRAFT', 'PUBLISHED', 'APPROVED', 'REVOKED'])
      .parse(state),
    ...(after ? { p_after: z.uuid().parse(after) } : {}),
  });
  if (r.error) storeFailure(r.error.code);
  const access = await Promise.all(
    [
      'store.catalog.manage',
      'store.catalog.publish',
      'store.sourcing.manage',
      'store.supplier_cost.read',
      'store.catalog.policy.manage',
    ].map((p) => staffAccess(p, context.organizationId)),
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
            content: z
              .object({
                title_ar: z.string(),
                title_en: z.string(),
                description_ar: z.string().optional(),
                description_en: z.string().optional(),
                specifications: z
                  .object({
                    label_ar: z.string(),
                    label_en: z.string(),
                    value_ar: z.string(),
                    value_en: z.string(),
                  })
                  .array()
                  .optional(),
              })
              .optional(),
            publishedContent: z
              .object({ title_ar: z.string(), title_en: z.string() })
              .nullable()
              .optional(),
            amountMinor: z.number().nullable().optional(),
            comparison: z
              .object({
                retailMinor: z.number().int(),
                entitlementMinor: z.number().int(),
                productDifferenceMinor: z.number().int(),
                retailVersion: z.number().int(),
                offerVersion: z.number().int(),
              })
              .nullable()
              .optional(),
            listingId: z.uuid().optional(),
            productId: z.uuid().optional(),
            parentId: z.uuid().nullable().optional(),
            categoryId: z.uuid().optional(),
            supplierId: z.uuid().optional(),
            agreementId: z.uuid().optional(),
            presentationPolicyId: z.uuid().optional(),
            version: z.number().int().optional(),
            effectiveFrom: z.string().optional(),
            effectiveUntil: z.string().nullable().optional(),
            evidenceReference: z.string().nullable().optional(),
            observedAt: z.string().optional(),
            name: z.string().optional(),
            code: z.string().optional(),
            kind: z.string().optional(),
            offerKey: z.string().optional(),
            agreementCode: z.string().optional(),
            media: z
              .object({ src: z.string(), altAr: z.string(), altEn: z.string() })
              .array()
              .max(5)
              .optional(),
            pendingMedia: z.object({ src: z.string() }).array().max(20).optional(),
          })
          .array()
          .max(20),
        nextCursor: z.uuid().nullable(),
      })
      .parse(r.data),
    manage: access[0]?.status === 'authorized',
    publish: access[1]?.status === 'authorized',
    sourcing: access[2]?.status === 'authorized' && access[3]?.status === 'authorized',
    policies: access[4]?.status === 'authorized',
  };
}
export async function storeCatalogExecute(input: unknown) {
  const p = z
    .strictObject({
      family: z.enum(['draft', 'publication', 'sourcing', 'extension']),
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
        'save_listing',
        'save_price',
        'suspend_category',
        'revoke_price',
        'create_supplier',
        'save_supplier',
        'create_agreement',
        'save_agreement',
        'approve_agreement',
        'create_offer',
        'save_offer',
        'approve_offer',
        'revoke_offer',
        'reference_price',
        'attach_media',
      ]),
      mutationId: z.uuid(),
      target: z.uuid().optional(),
      revision: z.number().int().positive().optional(),
      payload: z.record(z.string(), z.json()),
    })
    .parse(input);
  const context = await staffMarket(
    p.family === 'sourcing' || p.operation === 'reference_price'
      ? 'store.sourcing.manage'
      : 'store.catalog.manage',
  );
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
  const r =
    p.family === 'extension'
      ? await c.rpc('store_catalog_extension_v1', {
          p_org: context.organizationId,
          p_market: context.market.id,
          p_action: p.operation,
          p_mutation: p.mutationId,
          p_target: z.uuid().parse(p.target),
          p_revision: z.number().int().positive().parse(p.revision),
          p_payload: p.payload,
        })
      : await c.rpc('store_catalog_ui_command_v1', args);
  if (r.error) storeFailure(r.error.code);
  return r.data;
}
