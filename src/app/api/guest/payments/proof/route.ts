import { apiResult, checkOrigin, readEvidenceForm, readJson } from '@/infrastructure/requests/http';
import { uploadTransferProof, removeIncompleteProof } from '@/infrastructure/payments/proof';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return uploadTransferProof(await readEvidenceForm(request), true);
  });
}
export async function DELETE(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return removeIncompleteProof(await readJson(request), true);
  });
}
