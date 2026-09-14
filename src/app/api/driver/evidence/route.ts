import { z } from 'zod';
import { apiResult, checkOrigin, readEvidenceForm } from '@/infrastructure/requests/http';
import { uploadDriverEvidence, evidenceUrl } from '@/infrastructure/driver/service';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    const kind = z.enum(['pod', 'issue']).parse(new URL(request.url).searchParams.get('kind'));
    return uploadDriverEvidence(kind, await readEvidenceForm(request));
  });
}
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return apiResult(() => evidenceUrl(q.get('kind'), q.get('id')));
}
