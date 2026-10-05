import { cookies } from 'next/headers';
import { z } from 'zod';
import { publicCountry } from '@/domain/markets/public-contact';
import { marketCookie } from '@/infrastructure/markets/public';
import { appUrl } from '@/infrastructure/config/server-env';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const input = z.strictObject({ country: publicCountry }).parse(await readJson(request));
    (await cookies()).set(marketCookie, input.country, {
      httpOnly: true,
      secure: appUrl().protocol === 'https:',
      sameSite: 'strict',
      path: '/',
      maxAge: 31536000,
    });
    return { country: input.country };
  });
}
