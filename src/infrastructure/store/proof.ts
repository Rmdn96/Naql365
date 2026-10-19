import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { normalizeSignature } from '@/infrastructure/operations/signature';
import { selectedPublicCountry } from '@/infrastructure/markets/public';
import { AppError } from '@/domain/shared/errors';
import { storeFailure } from './service';

export async function uploadStoreProof(form: FormData) {
  const p = z
    .object({
      orderId: z.uuid(),
      fileId: z.uuid(),
      reserveId: z.uuid(),
      submitId: z.uuid(),
      revision: z.coerce.number().int().nonnegative(),
      customerReference: z.string().trim().max(120).optional(),
    })
    .parse(Object.fromEntries([...form.entries()].filter(([key]) => key !== 'file')));
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > 2097152)
    throw new AppError('validation', 'Invalid Store proof');
  const c = await createSupabaseServerClient(true);
  const u = await c.auth.getUser();
  if (u.error || !u.data.user) throw new AppError('unauthenticated', 'Sign in required');
  let bytes = new Uint8Array(await file.arrayBuffer()),
    mime = file.type;
  if (mime === 'application/pdf') {
    if (
      !/^%PDF-1\.[0-7]/.test(new TextDecoder().decode(bytes.subarray(0, 8))) ||
      !/%%EOF\s*$/.test(new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024))))
    )
      throw new AppError('validation', 'Invalid PDF');
  } else {
    bytes = new Uint8Array(await normalizeSignature(bytes, mime));
    mime = 'image/png';
  }
  const country = await selectedPublicCountry();
  const reserved = await c.rpc('store_purchase_command_v1', {
    p_country: country,
    p_action: 'reserve_proof',
    p_mutation: p.reserveId,
    p_revision: p.revision,
    p_target: p.orderId,
    p_payload: {
      fileId: p.fileId,
      mime,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  });
  if (reserved.error) storeFailure(reserved.error.code);
  const reservation = z
    .object({ proofId: z.uuid(), path: z.string(), revision: z.number().int() })
    .parse(reserved.data);
  // Immutable upload; lost upload responses are resolved by SQL checking the stored object.
  await c.storage
    .from('store-proofs')
    .upload(reservation.path, bytes, { contentType: mime, upsert: false });
  const submitted = await c.rpc('store_purchase_command_v1', {
    p_country: country,
    p_action: 'submit_proof',
    p_mutation: p.submitId,
    p_revision: reservation.revision,
    p_target: p.orderId,
    p_payload: {
      proofId: p.fileId,
      ...(p.customerReference ? { customerReference: p.customerReference } : {}),
    },
  });
  if (submitted.error) storeFailure(submitted.error.code);
  return submitted.data;
}
export async function readStoreProof(id: string) {
  const c = await createSupabaseServerClient();
  const r = await c.rpc('store_proof_path_v1', { p_proof: z.uuid().parse(id) });
  if (r.error) storeFailure(r.error.code);
  const proof = z.object({ path: z.string(), mime: z.string() }).parse(r.data);
  const signed = await c.storage.from('store-proofs').createSignedUrl(proof.path, 60, {
    download: 'payment-proof' + (proof.mime === 'application/pdf' ? '.pdf' : '.png'),
  });
  if (signed.error) throw new AppError('network', 'Store proof unavailable');
  return signed.data.signedUrl;
}
