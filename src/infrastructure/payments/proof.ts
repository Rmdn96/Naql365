import 'server-only';
import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';
import { normalizeSignature } from '@/infrastructure/operations/signature';
import { paymentResult } from '@/domain/payments/model';
import { paymentFailure } from './service';

const uploadInput = z.strictObject({
  orderId: z.uuid(),
  fileId: z.uuid(),
  reserveId: z.uuid(),
  submitId: z.uuid(),
  revision: z.coerce.number().int().nonnegative(),
});
export async function uploadTransferProof(form: FormData) {
  const p = uploadInput.parse(
    Object.fromEntries([...form.entries()].filter(([key]) => key !== 'file')),
  );
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 1 || file.size > 2097152)
    throw new AppError('validation', 'Invalid proof size');
  const c = await createSupabaseServerClient(true),
    user = await c.auth.getUser();
  if (user.error || !user.data.user) throw new AppError('unauthenticated', 'Sign in required');
  let bytes = new Uint8Array(await file.arrayBuffer()),
    mime = file.type;
  if (mime === 'application/pdf') {
    // Structural screening only, not malware scanning or PDF sanitization. PDFs
    // stay private and are issued with attachment disposition, never embedded.
    const header = new TextDecoder().decode(bytes.subarray(0, 8));
    const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
    if (!/^%PDF-1\.[0-7]/.test(header) || !/%%EOF\s*$/.test(tail))
      throw new AppError('validation', 'Invalid PDF');
  } else {
    bytes = new Uint8Array(await normalizeSignature(bytes, mime));
    mime = 'image/png';
  }
  const reserved = await c.rpc('payment_command', {
    p_order: p.orderId,
    p_action: 'reserve',
    p_mutation: p.reserveId,
    p_revision: p.revision,
    p_payload: { fileId: p.fileId, mime, size: bytes.length },
  });
  if (reserved.error) paymentFailure(reserved.error.code);
  const reservation = paymentResult
    .extend({ attemptId: z.uuid(), path: z.string() })
    .parse(reserved.data);
  await c.storage
    .from('documents')
    .upload(reservation.path, bytes, { contentType: mime, upsert: false });
  // A response lost after upload is recovered by verifying the immutable stored
  // object in submit. No overwrite/upsert or client-reported upload success.
  const submitted = await c.rpc('payment_command', {
    p_order: p.orderId,
    p_action: 'submit',
    p_mutation: p.submitId,
    p_revision: reservation.revision,
    p_payload: { attemptId: reservation.attemptId },
  });
  if (submitted.error) paymentFailure(submitted.error.code);
  return paymentResult.parse(submitted.data);
}

export async function removeIncompleteProof(input: unknown) {
  const p = z
    .strictObject({
      orderId: z.uuid(),
      attemptId: z.uuid(),
      revision: z.number().int().nonnegative(),
      removeId: z.uuid(),
      finishId: z.uuid(),
    })
    .parse(input);
  const c = await createSupabaseServerClient(true),
    user = await c.auth.getUser();
  if (user.error || !user.data.user) throw new AppError('unauthenticated', 'Sign in required');
  const result = await c.rpc('payment_command', {
    p_order: p.orderId,
    p_action: 'remove',
    p_mutation: p.removeId,
    p_revision: p.revision,
    p_payload: { attemptId: p.attemptId },
  });
  if (result.error) paymentFailure(result.error.code);
  const removing = paymentResult.extend({ path: z.string() }).parse(result.data);
  const removed = await c.storage.from('documents').remove([removing.path]);
  if (removed.error) throw new AppError('network', 'Temporary proof removal incomplete');
  const finished = await c.rpc('payment_command', {
    p_order: p.orderId,
    p_action: 'finish_remove',
    p_mutation: p.finishId,
    p_revision: removing.revision,
    p_payload: { attemptId: p.attemptId },
  });
  if (finished.error) paymentFailure(finished.error.code);
  return paymentResult.parse(finished.data);
}
