import { createQuoteDraft } from '@/infrastructure/pricing/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return createQuoteDraft(await readJson(request));
  });
}
