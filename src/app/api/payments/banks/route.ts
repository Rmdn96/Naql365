import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { configureBank } from '@/infrastructure/payments/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return configureBank(await readJson(request));
  });
}
