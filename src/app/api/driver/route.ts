import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { executeDriver } from '@/infrastructure/driver/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return executeDriver(await readJson(request));
  });
}
