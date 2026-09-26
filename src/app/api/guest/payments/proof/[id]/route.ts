import { apiResult } from '@/infrastructure/requests/http';
import { signTransferProof } from '@/infrastructure/payments/service';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return apiResult(async () => signTransferProof((await context.params).id, true));
}
