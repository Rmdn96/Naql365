import { z } from 'zod';
import { publicCountry } from '@/domain/markets/public-contact';
import { guestSecret } from '@/domain/guest/capability';
import { commandResult } from '@/domain/requests/intake';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import {
  exchangeGuestSecret,
  guestDatabase,
  guestDatabaseError,
} from '@/infrastructure/guest/session';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const input = z
      .object({ country: publicCountry })
      .strict()
      .parse(await readJson(request));
    const { data, error } = await guestDatabase().rpc('start_guest_request', {
      p_country: input.country,
    });
    if (error) guestDatabaseError(error.code);
    const result = z.object({ token: guestSecret, request: commandResult }).parse(data);
    await exchangeGuestSecret(result.token);
    // Returned once for the customer's continuation link; never logged or persisted in cleartext.
    return result;
  });
}
