import { apiResult, checkOrigin } from '@/infrastructure/requests/http';
import { uploadProductImage, productImageForm } from '@/infrastructure/store/media';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return uploadProductImage(await productImageForm(request));
  });
}
