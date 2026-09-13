import { z } from 'zod';
import { createDraft } from '@/infrastructure/requests/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const { key, marketId } = z
      .strictObject({ key: z.uuid(), marketId: z.uuid() })
      .parse(await readJson(request));
    return createDraft(key, marketId);
  });
}
