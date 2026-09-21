import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { getTracking, publishLocation } from '@/infrastructure/tracking/service';
export async function GET(request: Request) {
  return apiResult(() => getTracking(Object.fromEntries(new URL(request.url).searchParams)));
}
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return publishLocation(await readJson(request));
  });
}
