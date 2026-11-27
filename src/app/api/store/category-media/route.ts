import { apiResult, checkOrigin, readJson } from '@/infrastructure/requests/http';
import { productImageForm } from '@/infrastructure/store/media';
import { changeCategoryImage, uploadCategoryImage } from '@/infrastructure/store/category-media';

export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return uploadCategoryImage(await productImageForm(request));
  });
}

export async function PATCH(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return changeCategoryImage(await readJson(request));
  });
}
