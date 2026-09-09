import { NextResponse } from 'next/server';
import { signedFileUrl } from '@/infrastructure/storage/read-file';
import { apiResult } from '@/infrastructure/requests/http';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let url: string | undefined;
  const result = await apiResult(async () => {
    url = await signedFileUrl({ fileId: (await params).id });
    return {};
  });
  return url
    ? NextResponse.redirect(url, {
        headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
      })
    : result;
}
