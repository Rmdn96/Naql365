import { guestExchange } from '@/domain/guest/capability';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { exchangeGuestSecret } from '@/infrastructure/guest/session';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const { token } = guestExchange.parse(await readJson(request));
    return exchangeGuestSecret(token);
  });
}
