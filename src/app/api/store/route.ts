import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { storeExecute, storeRead } from '@/infrastructure/store/service';
import { storeReadKind } from '@/domain/store/model';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return storeExecute(await readJson(request));
  });
}
export async function GET(request: Request) {
  return apiResult(async () => {
    const q = new URL(request.url).searchParams;
    return storeRead(
      storeReadKind.parse(q.get('kind')),
      q.get('target') ?? undefined,
      q.get('after') ?? undefined,
    );
  });
}
