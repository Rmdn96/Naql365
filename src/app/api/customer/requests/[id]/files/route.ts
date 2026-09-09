import { z } from 'zod';
import { uploadAttachment, removeAttachment } from '@/infrastructure/requests/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { AppError } from '@/domain/shared/errors';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  return apiResult(async () => {
    checkOrigin(request);
    const length = Number(request.headers.get('content-length'));
    if (!Number.isSafeInteger(length) || length <= 0 || length > 3 * 1024 * 1024 + 65536)
      throw new AppError('validation', 'Upload size invalid');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('validation', 'File required');
    return uploadAttachment((await params).id, z.uuid().parse(form.get('fileId')), file);
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return apiResult(async () => {
    checkOrigin(request);
    const { fileId } = z.strictObject({ fileId: z.uuid() }).parse(await readJson(request));
    return removeAttachment((await params).id, fileId);
  });
}
