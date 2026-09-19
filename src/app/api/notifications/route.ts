import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { getNotifications, markNotification } from '@/infrastructure/tracking/service';
export async function GET() {
  return apiResult(getNotifications);
}
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return markNotification(await readJson(request));
  });
}
