import { sendQuote } from '@/infrastructure/pricing/service';
import { apiResult, checkOrigin } from '@/infrastructure/requests/http';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  return apiResult(async () => {
    checkOrigin(request);
    return sendQuote((await params).id);
  });
}
