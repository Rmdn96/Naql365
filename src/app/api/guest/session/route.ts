import { apiResult } from '@/infrastructure/requests/http';
import { guestSessionClient, guestDatabaseError } from '@/infrastructure/guest/session';
import { z } from 'zod';
export async function GET() {
  return apiResult(async () => {
    const client = await guestSessionClient();
    const result = await client.rpc('guest_access_state');
    if (result.error) guestDatabaseError(result.error.code);
    return z.object({ requestId: z.uuid(), expiresAt: z.string() }).parse(result.data);
  });
}
