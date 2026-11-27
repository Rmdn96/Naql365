import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { staffMarket } from '@/infrastructure/identity/staff-market';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
import { normalizeProductImage, uploadVerifiedStoreImage } from './media';
import { storeFailure } from './service';

const identity = z.object({
  categoryId: z.uuid(),
  revision: z.coerce.number().int().positive(),
  assetId: z.uuid(),
});

async function categoryImageCommand(input: z.infer<typeof identity>) {
  const context = await staffMarket('store.catalog.manage');
  if (context.market.country_code !== 'EG') throw new AppError('forbidden', 'Egypt Store only');
  const client = await createSupabaseServerClient(true);
  const command = async (action: string, payload: Record<string, string | number> = {}) => {
    const { error } = await client.rpc('store_category_image_command', {
      p_org: context.organizationId,
      p_market: context.market.id,
      p_category: input.categoryId,
      p_revision: input.revision,
      p_action: action,
      p_asset: input.assetId,
      p_payload: payload,
    });
    if (error) storeFailure(error.code);
  };
  return { client, command };
}

export async function uploadCategoryImage(form: FormData) {
  const input = identity
    .extend({ rightsReference: z.string().trim().min(1).max(200) })
    .parse(Object.fromEntries(form));
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 4194304)
    throw new AppError('validation', 'Invalid category image');
  const { client, command } = await categoryImageCommand(input);
  const bytes = await normalizeProductImage(
    new Uint8Array(await file.arrayBuffer()),
    file.type,
    800,
  );
  await command('reserve', {
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    rights: input.rightsReference,
  });
  await uploadVerifiedStoreImage(client, 'category/' + input.assetId + '.webp', bytes);
  await command('finish');
  return { saved: true };
}

export async function changeCategoryImage(raw: unknown) {
  const input = identity.extend({ action: z.enum(['remove', 'approve']) }).parse(raw);
  const { command } = await categoryImageCommand(input);
  await command(input.action);
  return { saved: true };
}
