import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { storeCatalogExecute } from '@/infrastructure/store/catalog';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return storeCatalogExecute(await readJson(request));
  });
}
