import { calculatePreliminary } from '@/infrastructure/pricing/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return calculatePreliminary(await readJson(request));
  });
}
