import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { reportDriverIssue } from '@/infrastructure/driver/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return reportDriverIssue(await readJson(request));
  });
}
