import { NextResponse } from 'next/server';
import { apiResult, checkOrigin, readEvidenceForm } from '@/infrastructure/requests/http';
import { readStoreProof, uploadStoreProof } from '@/infrastructure/store/proof';
export async function POST(request: Request) {
  return apiResult(async () => {
    checkOrigin(request);
    return uploadStoreProof(await readEvidenceForm(request));
  });
}
export async function GET(request: Request) {
  // Authorization is checked before a short-lived, attachment-only private URL is issued.
  const result = await apiResult(async () => ({
    url: await readStoreProof(new URL(request.url).searchParams.get('id') ?? ''),
  }));
  if (!result.ok) return result;
  const data: { url: string } = await result.json();
  const response = NextResponse.redirect(data.url);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
