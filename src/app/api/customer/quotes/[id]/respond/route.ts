import { respondToQuote } from '@/infrastructure/pricing/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  return apiResult(async () => {
    checkOrigin(request);
    return respondToQuote((await params).id, await readJson(request));
  });
}
