import { z } from 'zod';
import { manageGuestLink } from '@/infrastructure/guest/staff';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const input = z
      .strictObject({ requestId: z.uuid(), action: z.enum(['replace', 'revoke']) })
      .parse(await readJson(request));
    return manageGuestLink(input);
  });
}
