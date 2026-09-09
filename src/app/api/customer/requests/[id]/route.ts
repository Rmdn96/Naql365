import { requestDetails, mutateRequest } from '@/infrastructure/requests/service';
import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  return apiResult(async () => requestDetails((await params).id, true));
}
export async function POST(request: Request, { params }: Context) {
  return apiResult(async () => {
    checkOrigin(request);
    return mutateRequest((await params).id, await readJson(request));
  });
}
