import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { uploadTripPod, abortTripPod, privatePodUrl } from '@/infrastructure/operations/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const length = Number(request.headers.get('content-length'));
    if (!length || length > 2200000) throw new AppError('validation', 'Bounded upload required');
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('validation', 'Signature required');
    return uploadTripPod(
      {
        tripId: form.get('tripId'),
        fileId: form.get('fileId'),
        recipient: form.get('recipient'),
        notes: form.get('notes') ?? '',
      },
      file,
    );
  });
}
export async function DELETE(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const data = z
      .object({ tripId: z.uuid(), fileId: z.uuid() })
      .strict()
      .parse(await readJson(request));
    return abortTripPod(data.tripId, data.fileId);
  });
}
export async function GET(request: Request) {
  return apiResult(() =>
    privatePodUrl(z.uuid().parse(new URL(request.url).searchParams.get('tripId'))),
  );
}
