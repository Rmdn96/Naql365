import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), upload: vi.fn() }));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload }) },
  }),
}));
import { uploadTransferProof } from '@/infrastructure/payments/proof';
const id = '13000000-0000-4000-8000-000000000001';
function form(bytes: Uint8Array, mime: string) {
  const body = new FormData();
  for (const key of ['orderId', 'fileId', 'reserveId', 'submitId']) body.set(key, id);
  body.set('revision', '1');
  body.set('file', new File([new Uint8Array(bytes)], 'controlled-proof', { type: mime }));
  return body;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.rpc.mockImplementation(async (_name: string, args: { p_action: string }) => ({
    error: null,
    data: {
      paymentId: id,
      revision: args.p_action === 'reserve' ? 2 : 3,
      status: args.p_action === 'reserve' ? 'AWAITING_TRANSFER_PROOF' : 'UNDER_REVIEW',
      method: 'BANK_TRANSFER',
      executionAllowed: false,
      attemptId: id,
      path: `${id}/${id}/${id}`,
    },
  }));
});
it('rejects malformed image/PDF and oversized proof before reserving evidence', async () => {
  for (const [bytes, mime] of [
    [Buffer.from('not an image'), 'image/png'],
    [Buffer.from('%PDF-1.4\nno EOF'), 'application/pdf'],
    [new Uint8Array(2097153), 'application/pdf'],
  ] as const) {
    await expect(uploadTransferProof(form(bytes, mime))).rejects.toMatchObject({
      code: 'validation',
    });
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it('decodes image proof, strips metadata and reserves normalized facts only', async () => {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#fff' } })
    .withMetadata({ exif: { IFD0: { Artist: 'Private fixture metadata' } } })
    .jpeg()
    .toBuffer();
  const result = await uploadTransferProof(form(bytes, 'image/jpeg'));
  expect(result.status).toBe('UNDER_REVIEW');
  expect(result.executionAllowed).toBe(false);
  const uploaded = mocks.upload.mock.calls[0]!;
  expect(uploaded[2]).toEqual({ contentType: 'image/png', upsert: false });
  const metadata = await sharp(uploaded[1] as Uint8Array).metadata();
  expect(metadata.format).toBe('png');
  expect(metadata.exif).toBeUndefined();
  expect(mocks.rpc.mock.calls[0]![1]).toMatchObject({
    p_payload: { mime: 'image/png', fileId: id },
  });
});
it('requires a valid session and rejects forged multipart fields', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(
    uploadTransferProof(form(Buffer.from('%PDF-1.4\n%%EOF'), 'application/pdf')),
  ).rejects.toMatchObject({ code: 'unauthenticated' });
  const forged = form(Buffer.from('anything'), 'image/png');
  forged.set('organizationId', id);
  await expect(uploadTransferProof(forged)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('recovers an upload response loss through authoritative finalization without overwrite', async () => {
  mocks.upload.mockResolvedValue({ error: { message: 'simulated lost response' } });
  const result = await uploadTransferProof(
    form(Buffer.from('%PDF-1.4\n%%EOF\n'), 'application/pdf'),
  );
  expect(result.status).toBe('UNDER_REVIEW');
  expect(mocks.rpc.mock.calls[1]![1]).toMatchObject({
    p_action: 'submit',
    p_mutation: id,
    p_revision: 2,
    p_payload: { attemptId: id },
  });
  expect(mocks.upload.mock.calls[0]![2]).toEqual({ contentType: 'application/pdf', upsert: false });
});
