import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { executePayment } from '@/infrastructure/payments/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return executePayment(await readJson(request), true);
  });
}
