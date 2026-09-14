import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { resolveOperationalIssue } from '@/infrastructure/operations/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return resolveOperationalIssue(await readJson(request));
  });
}
