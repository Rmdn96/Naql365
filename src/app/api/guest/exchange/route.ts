import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { exchangeGuestSecret } from '@/infrastructure/guest/session';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const body = await readJson(request);
    const token =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Object.keys(body).length === 1 &&
      'token' in body
        ? body.token
        : undefined;
    return exchangeGuestSecret(token);
  });
}
