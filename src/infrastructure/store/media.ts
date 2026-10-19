import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { staffMarket } from '@/infrastructure/identity/staff-market';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { AppError } from '@/domain/shared/errors';
import { storeFailure } from './service';

export async function productImageForm(request: Request) {
  const limit = 4194304 + 65536;
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new AppError('validation', 'Product upload too large');
  if (!request.body || !request.headers.get('content-type')?.startsWith('multipart/form-data;'))
    throw new AppError('validation', 'Invalid product upload');
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.length;
    if (size > limit) {
      await reader.cancel();
      throw new AppError('validation', 'Product upload too large');
    }
    chunks.push(result.value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return new Response(body, {
    headers: { 'Content-Type': request.headers.get('content-type')! },
  }).formData();
}

export async function normalizeProductImage(bytes: Uint8Array, mime: string, width = 1600) {
  const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
  if (!expected || bytes.length < 12 || bytes.length > 4194304)
    throw new AppError('validation', 'Invalid product image');
  try {
    const image = sharp(bytes, { limitInputPixels: 40000000, animated: false });
    if ((await image.metadata()).format !== expected) throw Error('Image signature mismatch');
    const result = await image
      .rotate()
      .resize({
        width: z.number().int().min(64).max(1600).parse(width),
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    if (result.length > 2097152) throw Error('Image too large');
    return result;
  } catch {
    throw new AppError('validation', 'Invalid product image');
  }
}

export async function uploadProductImage(form: FormData) {
  const input = z
    .object({
      listingId: z.uuid(),
      revision: z.coerce.number().int().positive(),
      assetId: z.uuid(),
      reserveId: z.uuid(),
      finalizeId: z.uuid(),
      rightsReference: z.string().trim().min(1).max(200),
    })
    .parse(Object.fromEntries([...form.entries()].filter(([key]) => key !== 'file')));
  const context = await staffMarket('store.catalog.manage');
  if (context.market.country_code !== 'EG') throw new AppError('forbidden', 'Egypt Store only');
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 4194304)
    throw new AppError('validation', 'Invalid product image');
  const bytes = await normalizeProductImage(new Uint8Array(await file.arrayBuffer()), file.type);
  const client = await createSupabaseServerClient(true);
  const args = {
    p_org: context.organizationId,
    p_market: context.market.id,
    p_target: input.listingId,
    p_revision: input.revision,
  };
  const reserve = await client.rpc('store_catalog_extension_v1', {
    ...args,
    p_action: 'reserve_media',
    p_mutation: input.reserveId,
    p_payload: {
      assetId: input.assetId,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rightsReference: input.rightsReference,
    },
  });
  if (reserve.error) storeFailure(reserve.error.code);
  // Immutable object upload. A lost response is resolved by the finalization command's object check.
  await client.storage
    .from('store-product-media')
    .upload(`${input.assetId}.webp`, bytes, { contentType: 'image/webp', upsert: false });
  const stored = await client.storage.from('store-product-media').download(`${input.assetId}.webp`);
  if (
    stored.error ||
    !stored.data ||
    createHash('sha256')
      .update(new Uint8Array(await stored.data.arrayBuffer()))
      .digest('hex') !== createHash('sha256').update(bytes).digest('hex')
  )
    throw new AppError('conflict', 'Product image upload unconfirmed');
  const final = await client.rpc('store_catalog_extension_v1', {
    ...args,
    p_action: 'finalize_media',
    p_mutation: input.finalizeId,
    p_payload: { assetId: input.assetId },
  });
  if (final.error) storeFailure(final.error.code);
  return final.data;
}

export async function productImage(id: string, width = 1600) {
  const key = z.uuid().parse(id).toLowerCase();
  const client = await createSupabaseServerClient();
  // Dedicated bucket and registry-backed RLS; never a caller-supplied bucket/path or a proof URL.
  const image = await client.storage.from('store-product-media').download(`${key}.webp`);
  if (image.error || !image.data) throw new AppError('not_found', 'Image unavailable');
  return normalizeProductImage(new Uint8Array(await image.data.arrayBuffer()), 'image/webp', width);
}
