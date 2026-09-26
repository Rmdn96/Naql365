import { respondToQuote } from '@/infrastructure/pricing/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResult(async () => {
    checkOrigin(request);
    return respondToQuote((await params).id, await readJson(request), true);
  });
}
