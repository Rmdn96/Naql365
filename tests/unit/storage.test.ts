import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedFileUrl } from '@/infrastructure/storage/read-file';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  lookup: vi.fn(),
  sign: vi.fn(),
  from: vi.fn(),
  bucket: vi.fn(),
}));
vi.mock('@/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    storage: { from: mocks.bucket },
  }),
}));
const fileId = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: fileId } }, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }) });
  mocks.bucket.mockReturnValue({ createSignedUrl: mocks.sign });
  mocks.lookup.mockResolvedValue({
    data: { bucket_id: 'attachments', object_name: 'tenant/user/file' },
    error: null,
  });
  mocks.sign.mockResolvedValue({
    data: { signedUrl: 'https://files.example.test/signed' },
    error: null,
  });
});
describe('signed file service', () => {
  it('rejects invalid input before querying identity or storage', async () => {
    await expect(signedFileUrl({ fileId: '../secret', bucket: 'documents' })).rejects.toMatchObject(
      { code: 'validation' },
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it('rejects an anonymous caller before file lookup', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(signedFileUrl({ fileId })).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not sign files hidden by RLS', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    await expect(signedFileUrl({ fileId })).rejects.toMatchObject({ code: 'not_found' });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('signs only the registered path with a short expiry', async () => {
    await expect(signedFileUrl({ fileId })).resolves.toBe('https://files.example.test/signed');
    expect(mocks.bucket).toHaveBeenCalledWith('attachments');
    expect(mocks.sign).toHaveBeenCalledWith('tenant/user/file', 60, { download: true });
  });
  it('redacts provider failure details', async () => {
    mocks.sign.mockResolvedValue({ data: null, error: { message: 'sensitive backend response' } });
    await expect(signedFileUrl({ fileId })).rejects.toMatchObject({
      code: 'internal',
      message: 'Unable to sign file',
    });
  });
});
