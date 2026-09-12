import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { executeOperation } from '@/infrastructure/operations/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return executeOperation(await readJson(request));
  });
}
